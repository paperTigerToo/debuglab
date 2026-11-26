import type { AccessLogLine, Dashboard, Deploy } from '../engine/types'
import { defineIncident } from '../engine/types'
import { access, appLog, clock, kubectlTable, pad, podsTable, psqlTable, round, runningPod, samples, topTable, wobble } from './build'

// Connection Pool Exhaustion: nothing was deployed. At 15:02 the payments service, run by another
// team, slows from 200 milliseconds a charge to about 20 seconds. pantry-api's checkout opens a
// database transaction, marks the order awaiting_payment, and only then calls payments, waiting up
// to 30 seconds while it holds the connection. Checkouts soon hold all 10 connections in every pod's
// pool, and every other request waits 5 seconds for one and fails with 503. The pods, their health
// checks and PostgreSQL all look healthy and nearly idle: the service is not busy, it is waiting.
//
// Named states:
//   exhausted     payments is slow and every pool is full of stuck checkouts (the start).
//   failing-fast  the Learner lowered the payments timeout: checkouts fail in 2 seconds, everything else recovers.
//   restarted     the Learner restarted the pods: fresh pools, filled again by stuck checkouts within a minute.

// ---------------------------------------------------------------------------------------------
// Pods

/** A pantry-api pod, with its age and CPU when the Learner looks. Waiting pods use almost no CPU. */
type Pod = { pod: string; node: string; ip: string; age: string; cpu: string; memory: string }

const livePods: Pod[] = [
  { pod: 'pantry-api-8c5d7f9b64-jx2mq', node: 'node-a', ip: '10.42.0.81', age: '2d', cpu: '9m', memory: '171Mi' },
  { pod: 'pantry-api-8c5d7f9b64-p7wcz', node: 'node-b', ip: '10.42.1.90', age: '2d', cpu: '11m', memory: '168Mi' },
  { pod: 'pantry-api-8c5d7f9b64-t4kdn', node: 'node-c', ip: '10.42.2.77', age: '2d', cpu: '8m', memory: '174Mi' },
]
// Changing the environment or restarting changes the pod template, so each makes a new ReplicaSet with new pods.
const failingFastPods: Pod[] = [
  { pod: 'pantry-api-4f6b9d8c72-b8nrx', node: 'node-a', ip: '10.42.0.93', age: '71s', cpu: '96m', memory: '133Mi' },
  { pod: 'pantry-api-4f6b9d8c72-h5vqk', node: 'node-b', ip: '10.42.1.97', age: '50s', cpu: '102m', memory: '129Mi' },
  { pod: 'pantry-api-4f6b9d8c72-s2xwm', node: 'node-c', ip: '10.42.2.84', age: '29s', cpu: '91m', memory: '126Mi' },
]
const restartedPods: Pod[] = [
  { pod: 'pantry-api-7d9c5b6f48-c4wzl', node: 'node-a', ip: '10.42.0.94', age: '71s', cpu: '14m', memory: '131Mi' },
  { pod: 'pantry-api-7d9c5b6f48-k8mhp', node: 'node-b', ip: '10.42.1.98', age: '50s', cpu: '12m', memory: '128Mi' },
  { pod: 'pantry-api-7d9c5b6f48-v2qjt', node: 'node-c', ip: '10.42.2.85', age: '29s', cpu: '15m', memory: '127Mi' },
]

const postgres = { pod: 'postgres-0', ip: '10.42.0.12', node: 'node-a' }
const redis = { pod: 'redis-7c9d5b8f6-hq2lw', ip: '10.42.2.7', node: 'node-c' }
const podRows = (api: Pod[]) => [...api.map((p) => runningPod(p, p.age)), runningPod(postgres, '53d'), runningPod(redis, '53d')]
const datastores = ['pod/postgres-0', 'pod/redis-7c9d5b8f6-hq2lw', 'deployment/pantry-api', 'deployment/redis']

/** `kubectl top pods`: the API pods, and PostgreSQL using `dbCpu`. */
const topPods = (api: Pod[], dbCpu: string) =>
  topTable([
    ...api.map((p) => ({ name: p.pod, cpu: p.cpu, memory: p.memory })),
    { name: postgres.pod, cpu: dbCpu, memory: '1302Mi' },
    { name: redis.pod, cpu: '10m', memory: '41Mi' },
  ])

// ---------------------------------------------------------------------------------------------
// The Deployment's configuration

const envLine = (name: string, value: string) => `      ${pad(`${name}:`, 30)}${value}`

const environment = (paymentsTimeout: string) =>
  [
    envLine('NODE_ENV', 'production'),
    envLine('DATABASE_URL', "<set to the key 'url' in secret 'pantry-db'>  Optional: false"),
    envLine('DB_POOL_SIZE', '10'),
    envLine('DB_POOL_ACQUIRE_TIMEOUT_MS', '5000'),
    envLine('REDIS_URL', 'redis://redis:6379'),
    envLine('PAYMENTS_URL', 'http://payments.payments.svc.cluster.local'),
    envLine('PAYMENTS_TIMEOUT_MS', paymentsTimeout),
    envLine('CHECKOUT_ENABLED', 'true'),
  ].join('\n')

/** The line that shows how long pantry-api is willing to wait for payments. */
const LONG_TIMEOUT = envLine('PAYMENTS_TIMEOUT_MS', '30000')

function describeDeployment(rollout: { revision: number; newRs: string; oldRs: string; paymentsTimeout: string; restartedAt?: string }): string {
  return `Name:                   pantry-api
Namespace:              pantry
Labels:                 app=pantry-api
Annotations:            deployment.kubernetes.io/revision: ${rollout.revision}
                        kubernetes.io/change-cause: release v2.16.1: keep orders_customer_id_idx
Selector:               app=pantry-api
Replicas:               3 desired | 3 updated | 3 total | 3 available | 0 unavailable
StrategyType:           RollingUpdate
Pod Template:
  Labels:  app=pantry-api${rollout.restartedAt ? `\n  Annotations:  kubectl.kubernetes.io/restartedAt: ${rollout.restartedAt}` : ''}
  Containers:
   api:
    Image:      registry.example.com/pantry/api:2.16.1
    Port:       8080/TCP
    Limits:
      cpu:     1
      memory:  512Mi
    Requests:
      cpu:      250m
      memory:   256Mi
    Liveness:   http-get http://:8080/healthz delay=10s timeout=1s period=10s #success=1 #failure=3
    Readiness:  http-get http://:8080/healthz delay=5s timeout=1s period=5s #success=1 #failure=3
    Environment:
${environment(rollout.paymentsTimeout)}
Conditions:
  Type           Status  Reason
  ----           ------  ------
  Available      True    MinimumReplicasAvailable
  Progressing    True    NewReplicaSetAvailable
OldReplicaSets:  ${rollout.oldRs} (0/0 replicas created)
NewReplicaSet:   ${rollout.newRs} (3/3 replicas created)`
}

const LIVE_RS = 'pantry-api-8c5d7f9b64'
const FAILING_FAST_RS = 'pantry-api-4f6b9d8c72'
const RESTARTED_RS = 'pantry-api-7d9c5b6f48'

// ---------------------------------------------------------------------------------------------
// pantry-api's logs

const { line, request } = appLog('2026-11-26')

/** A request that waited the full 5 seconds for a database connection and gave up. */
const poolTimeout = (time: string, path: string, waiting: number) =>
  [
    line(time, 'error', 'timed out waiting for a database connection', {
      waitMs: 5000,
      pool: { size: 10, inUse: 10, idle: 0, waiting },
    }),
    request(time, 'GET', path, 5003, 503),
  ]

/** A checkout whose charge took far longer than usual, while its order's transaction stayed open. */
const slowCharge = (time: string, orderId: number, ms: number) => [
  line(time, 'warn', 'payments request slow', { orderId, ms }),
  request(time, 'POST', '/api/checkout', ms + 31),
]

const startup = (time: string) =>
  [
    line(`${time}.402`, 'info', 'pantry-api v2.16.1 starting', { node: 'v22.11.0' }),
    line(`${time}.488`, 'info', 'connected to postgres', { pool: 10, acquireTimeoutMs: 5000 }),
    line(`${time}.511`, 'info', 'listening', { port: 8080 }),
  ].join('\n')

/** The last couple of minutes of one pod's log. `seed` varies the details between pods. */
function exhaustedLogs(seed: number): string {
  const paths = ['/api/products?category=bakery', '/api/cart', '/api/products/4411', '/api/orders?limit=10', '/api/products?category=dairy']
  // Charges finish every so often; in between, every request that needs the database waits and fails.
  const earlier = [
    ...slowCharge(`15:12:4${seed}.117`, 880412 + seed, 19840 + seed * 311),
    ...poolTimeout(`15:12:4${seed + 2}.530`, paths[seed % 5]!, 31 + seed),
    ...slowCharge(`15:12:5${seed}.902`, 880433 + seed, 21207 - seed * 97),
    request(`15:12:5${seed + 1}.208`, 'GET', '/healthz', 1),
    ...slowCharge(`15:13:0${seed}.311`, 880451 + seed, 18966 + seed * 53),
  ]
  // The last twenty lines: only requests giving up on the pool, and the health check passing in between.
  const latest = Array.from({ length: 9 }, (_, i) => {
    const time = `15:13:${String(10 + i * 4 + seed).padStart(2, '0')}.${String(140 + i * 87).padStart(3, '0')}`
    return poolTimeout(time, paths[(i + seed) % 5]!, 34 + i + seed)
  }).flat()
  return [...earlier, ...latest.slice(0, 16), request('15:13:47.208', 'GET', '/healthz', 1), ...latest.slice(16)].join('\n')
}

const failingFastLogs = [
  startup('15:14:03'),
  line('15:14:41.205', 'warn', 'payments request timed out', { orderId: 880502, timeoutMs: 2000 }),
  request('15:14:41.209', 'POST', '/api/checkout', 2006, 503),
  request('15:14:41.880', 'GET', '/api/products?category=bakery', 24),
  request('15:14:42.415', 'GET', '/api/cart', 11),
  request('15:14:43.118', 'GET', '/api/products/4411', 9),
  line('15:14:44.901', 'warn', 'payments request timed out', { orderId: 880507, timeoutMs: 2000 }),
  request('15:14:44.905', 'POST', '/api/checkout', 2004, 503),
  request('15:14:45.207', 'GET', '/healthz', 1),
  request('15:14:45.733', 'GET', '/api/orders?limit=10', 14),
].join('\n')

const restartedLogs = [
  startup('15:14:03'),
  request('15:14:04.880', 'GET', '/api/products?category=bakery', 25),
  request('15:14:05.415', 'GET', '/api/cart', 12),
  ...poolTimeout('15:14:41.530', '/api/products?category=dairy', 12),
  ...slowCharge('15:14:46.117', 880511, 20120),
  ...poolTimeout('15:14:47.020', '/api/cart', 19),
].join('\n')

// ---------------------------------------------------------------------------------------------
// PostgreSQL

const STUCK_QUERY = "SELECT pid, client_addr, now() - xact_start AS in_transaction, query FROM pg_stat_activity WHERE state = 'idle in transaction'"

/** pantry-api's checkout marks the order, then calls payments inside the same open transaction. */
const MARK_ORDER = 'UPDATE orders SET status = $1, updated_at = now() WHERE id = $2'

function stuckTransactions(pods: Pod[]): string {
  const rows = pods.flatMap((p, podIndex) =>
    Array.from({ length: 10 }, (_, i) => {
      const n = podIndex * 10 + i
      const seconds = (19.8 - ((n * 7) % 20)).toFixed(3)
      return [String(61204 + n * 13), p.ip, `00:00:${seconds.padStart(6, '0')}${String(211 + n * 17).slice(-3)}`, MARK_ORDER]
    }),
  )
  return psqlTable(['pid', 'client_addr', 'in_transaction', 'query'], rows)
}

const STATES_QUERY = 'SELECT state, count(*) FROM pg_stat_activity GROUP BY state'
const connectionStates = (idleInTransaction: number, idle: number) =>
  psqlTable(
    ['state', 'count'],
    [
      ...(idleInTransaction > 0 ? [['idle in transaction', String(idleInTransaction)]] : []),
      ['idle', String(idle)],
      ['active', '1'],
      // PostgreSQL's own background processes have no state.
      ['', '6'],
    ],
  )

// ---------------------------------------------------------------------------------------------
// Dashboard: one sample a minute from 14:45. Payments slows down at 15:02.

const label = clock('14:45')
const SLOW_AT = 17
const NOW = 30 // 15:15: the first sample after the Learner acts

type Phase = 'before' | 'exhausted' | 'fast' | 'refilling'

function signals(phases: Phase[]): Dashboard['signals'] {
  // Within a few minutes of payments slowing, checkouts hold every connection.
  const held = (i: number) => Math.min(1, Math.max(0, (i - SLOW_AT + 1) / 4))
  const fill = (p: Phase, i: number) => (p === 'exhausted' ? held(i) : p === 'refilling' ? Math.min(1, (i - NOW + 1) / 2) : 0)
  const requests = phases.map((_, i) => round(178 + wobble(i, 8), 0))
  const errors = phases.map((p, i) =>
    round(p === 'fast' ? 2.1 + wobble(i, 0.3) : 0.2 + Math.abs(wobble(i, 0.12)) + 41 * fill(p, i), 1),
  )
  const latency = phases.map((p, i) => round(92 + wobble(i, 6) + 4900 * fill(p, i), 0))
  const saturation = phases.map((p, i) => round(p === 'fast' ? 21 + wobble(i, 3) : 18 + wobble(i, 2) + 82 * fill(p, i), 0))
  return { requests, errors, latency, saturation: saturation.map((s) => Math.min(100, s)) }
}

const timeline = (length: number, phaseAt: (i: number) => Phase) => samples(length, label, phaseAt, signals)
/** Before payments slows the pools are fine; from then on they fill up. */
const untilNow = (i: number): Phase => (i < SLOW_AT ? 'before' : 'exhausted')

const history: Deploy[] = [
  { revision: 49, version: 'v2.16.1', at: 'Tue 24 Nov 16:05 UTC', by: 'ci: pipeline #1957' },
  { revision: 48, version: 'v2.16.0', at: 'Tue 24 Nov 11:20 UTC', by: 'ci: pipeline #1951' },
  { revision: 47, version: 'v2.15.1', at: 'Fri 20 Nov 15:02 UTC', by: 'ci: pipeline #1922' },
]

// The upstream addresses nginx forwards to, one per pod.
const [toJx2mq, toP7wcz, toT4kdn] = livePods.map((p) => `${p.ip}:8080`) as [string, string, string]
const [toB8nrx, toH5vqk, toS2xwm] = failingFastPods.map((p) => `${p.ip}:8080`) as [string, string, string]

const exhaustedTraffic: AccessLogLine[] = [
  access('15:13:10', 'GET', '/api/products?category=bakery', 503, 5004, toJx2mq),
  access('15:13:11', 'GET', '/api/cart', 503, 5003, toP7wcz),
  access('15:13:12', 'GET', '/', 200, 4, toT4kdn),
  access('15:13:13', 'POST', '/api/checkout', 200, 19871, toP7wcz),
  access('15:13:14', 'GET', '/api/products/4411', 503, 5003, toT4kdn),
  access('15:13:15', 'GET', '/api/orders?limit=10', 503, 5004, toJx2mq),
  access('15:13:17', 'GET', '/healthz', 200, 1, toJx2mq),
  access('15:13:18', 'GET', '/api/products?category=dairy', 503, 5003, toP7wcz),
  access('15:13:19', 'POST', '/api/checkout', 200, 21238, toT4kdn),
  access('15:13:21', 'GET', '/api/cart', 503, 5005, toJx2mq),
  access('15:13:22', 'GET', '/api/account', 401, 3, toT4kdn),
  access('15:13:24', 'GET', '/api/products?category=produce', 503, 5003, toP7wcz),
]

const failingFastTraffic: AccessLogLine[] = [
  access('15:19:02', 'GET', '/api/products?category=bakery', 200, 25, toB8nrx),
  access('15:19:03', 'POST', '/api/checkout', 503, 2007, toH5vqk),
  access('15:19:04', 'GET', '/api/cart', 200, 12, toS2xwm),
  access('15:19:05', 'GET', '/api/orders?limit=10', 200, 15, toB8nrx),
  access('15:19:07', 'GET', '/api/products/4411', 200, 10, toH5vqk),
  access('15:19:08', 'POST', '/api/checkout', 503, 2005, toS2xwm),
]

const saturationOf = 'API database connections in use'
const failing = 'pantry-api is returning server errors on about 41% of requests.'

const dashboard = {
  exhausted: {
    alert: { status: 'firing', summary: failing },
    saturationOf,
    ...timeline(NOW, untilNow),
    markers: [],
    deploys: history,
    logs: exhaustedTraffic,
  },
  'failing-fast': {
    alert: {
      status: 'resolved',
      summary: 'Resolved at 15:21: server errors back under 5% for 3 minutes. Checkouts still fail, fast, while payments is slow.',
    },
    saturationOf,
    ...timeline(NOW + 6, (i) => (i < NOW ? untilNow(i) : 'fast')),
    markers: [{ at: NOW, label: 'PAYMENTS_TIMEOUT_MS=2000' }],
    deploys: [{ revision: 50, version: 'v2.16.1', at: 'Today 15:14 UTC', by: 'you: kubectl set env' }, ...history],
    logs: [...exhaustedTraffic.slice(-4), ...failingFastTraffic],
  },
  restarted: {
    alert: { status: 'firing', summary: 'Still failing after the restart: server errors on about 40% of requests again.' },
    saturationOf,
    ...timeline(NOW + 4, (i) => (i < NOW ? untilNow(i) : 'refilling')),
    markers: [{ at: NOW, label: 'restart' }],
    deploys: [{ revision: 50, version: 'v2.16.1', at: 'Today 15:14 UTC', by: 'you: kubectl rollout restart' }, ...history],
    logs: exhaustedTraffic,
  },
} satisfies Record<string, Dashboard>

// ---------------------------------------------------------------------------------------------

/** Output while the pools are full: before any Mitigation, and again a minute after a restart. */
const whileStuck = <T,>(value: T) => ({ exhausted: value, restarted: value })

/** pantry-api's log reveals the full pool and, among its earlier lines, the slow charges. */
const fromApiLogs = [
  { finding: 'pool-exhausted' as const, seenIn: 'timed out waiting for a database connection' },
  { finding: 'payments-slow' as const, seenIn: '"msg":"payments request slow"' },
]

const failFast = (timeout: string) => ({
  match: [`kubectl set env deployment/pantry-api PAYMENTS_TIMEOUT_MS=${timeout}`],
  output: whileStuck('deployment.apps/pantry-api env updated'),
  mutating: {
    warning: `Set PAYMENTS_TIMEOUT_MS to ${timeout} on the pantry-api Deployment. Changing the environment rolls out new pods, and the stuck checkouts' transactions end with the old ones.`,
    to: 'failing-fast' as const,
    destroys: ['stuck-transactions' as const],
    consequence: `New pods wait at most ${Number(timeout) / 1000} seconds for payments. A charge that takes longer fails at once, its transaction ends and its connection goes back to the pool. Browsing, carts and order history recover within a minute; checkouts still fail while payments is slow, but quickly and with a clear error.`,
  },
})

export const connectionPool = defineIncident({
  id: 'connection-pool-exhaustion',
  title: 'Connection Pool Exhaustion',
  difficulty: 4,
  namespace: 'pantry',
  alert: {
    name: 'PantryApiHighErrorRate',
    severity: 'page',
    condition: '5xx responses above 5% of requests for 5 minutes',
    startedAt: '15:09 UTC',
    summary: failing,
  },
  briefing:
    'You are on call for Pantry: pantry-api on Kubernetes, with PostgreSQL, Redis and an nginx load balancer in front. Checkout charges cards through a payments service another team runs. Nothing has been deployed since Tuesday, yet the error alert has paged you. You can open a shell in postgres-0.',
  states: ['exhausted', 'failing-fast', 'restarted'],
  initialState: 'exhausted',
  findings: {
    'nothing-busy': {
      summary: 'Nothing is busy: the pantry-api pods use about 10m of CPU and PostgreSQL 27m, yet requests fail.',
    },
    'pool-exhausted': {
      summary: 'Requests fail after waiting 5 seconds for a database connection: all 10 in each pod’s pool are in use.',
    },
    'stuck-in-transaction': {
      summary: 'All 30 pantry-api connections sit idle in transaction, for up to 20 seconds, after marking an order.',
    },
    'payments-slow': {
      summary: 'Each call to the payments service takes about 20 seconds, while the checkout waits.',
    },
    'long-timeout': {
      summary: 'pantry-api waits up to 30 seconds for payments: PAYMENTS_TIMEOUT_MS is 30000.',
    },
  },
  evidence: {
    'stuck-transactions': {
      summary: 'The connections stuck idle in transaction: who held them, for how long, and what they had just done.',
      lost: 'the pods that held those transactions were replaced, so PostgreSQL ended them. What held the connections can only be inferred now.',
    },
  },
  resources: {
    exhausted: [...livePods.map((p) => `pod/${p.pod}`), ...datastores],
    'failing-fast': [...failingFastPods.map((p) => `pod/${p.pod}`), ...datastores],
    restarted: [...restartedPods.map((p) => `pod/${p.pod}`), ...datastores],
  },
  shellPodPrefix: 'postgres-0',
  commands: [
    // --- Reading the cluster -----------------------------------------------------------------
    {
      match: ['kubectl get pods'],
      output: {
        exhausted: podsTable(podRows(livePods)),
        'failing-fast': podsTable(podRows(failingFastPods)),
        restarted: podsTable(podRows(restartedPods)),
      },
    },
    {
      match: ['kubectl get pods -o wide'],
      output: {
        exhausted: podsTable(podRows(livePods), true),
        'failing-fast': podsTable(podRows(failingFastPods), true),
        restarted: podsTable(podRows(restartedPods), true),
      },
    },
    {
      match: ['kubectl top pods'],
      output: {
        exhausted: topPods(livePods, '27m'),
        'failing-fast': topPods(failingFastPods, '231m'),
        restarted: topPods(restartedPods, '33m'),
      },
      reveals: [{ finding: 'nothing-busy', seenIn: '27m' }],
    },
    {
      match: ['kubectl top nodes'],
      output: kubectlTable([
        ['NAME', 'CPU(cores)', 'CPU(%)', 'MEMORY(bytes)', 'MEMORY(%)'],
        ['node-a', '311m', '7%', '3398Mi', '43%'],
        ['node-b', '204m', '5%', '2251Mi', '28%'],
        ['node-c', '198m', '4%', '2307Mi', '29%'],
      ]),
    },
    {
      match: ['kubectl get deployments'],
      output: kubectlTable([
        ['NAME', 'READY', 'UP-TO-DATE', 'AVAILABLE', 'AGE'],
        ['pantry-api', '3/3', '3', '3', '224d'],
        ['redis', '1/1', '1', '1', '224d'],
      ]),
    },
    {
      match: ['kubectl get events', 'kubectl events', 'kubectl get events --sort-by=.lastTimestamp'],
      output: {
        exhausted: 'No resources found in pantry namespace.',
        'failing-fast': kubectlTable([
          ['LAST SEEN', 'TYPE', 'REASON', 'OBJECT', 'MESSAGE'],
          ['73s', 'Normal', 'ScalingReplicaSet', 'deployment/pantry-api', `Scaled up replica set ${FAILING_FAST_RS} to 1 from 0`],
          ['71s', 'Normal', 'Started', `pod/${failingFastPods[0]!.pod}`, 'Started container api'],
          ['69s', 'Normal', 'Killing', `pod/${livePods[0]!.pod}`, 'Stopping container api'],
          ['50s', 'Normal', 'Started', `pod/${failingFastPods[1]!.pod}`, 'Started container api'],
          ['29s', 'Normal', 'Started', `pod/${failingFastPods[2]!.pod}`, 'Started container api'],
          ['27s', 'Normal', 'Killing', `pod/${livePods[2]!.pod}`, 'Stopping container api'],
        ]),
        restarted: kubectlTable([
          ['LAST SEEN', 'TYPE', 'REASON', 'OBJECT', 'MESSAGE'],
          ['73s', 'Normal', 'ScalingReplicaSet', 'deployment/pantry-api', `Scaled up replica set ${RESTARTED_RS} to 1 from 0`],
          ['71s', 'Normal', 'Started', `pod/${restartedPods[0]!.pod}`, 'Started container api'],
          ['69s', 'Normal', 'Killing', `pod/${livePods[0]!.pod}`, 'Stopping container api'],
          ['50s', 'Normal', 'Started', `pod/${restartedPods[1]!.pod}`, 'Started container api'],
          ['29s', 'Normal', 'Started', `pod/${restartedPods[2]!.pod}`, 'Started container api'],
          ['27s', 'Normal', 'Killing', `pod/${livePods[2]!.pod}`, 'Stopping container api'],
        ]),
      },
    },
    {
      match: ['kubectl describe deployment/pantry-api'],
      output: {
        exhausted: describeDeployment({ revision: 49, newRs: LIVE_RS, oldRs: 'pantry-api-9d7c5f8b42', paymentsTimeout: '30000' }),
        'failing-fast': describeDeployment({ revision: 50, newRs: FAILING_FAST_RS, oldRs: LIVE_RS, paymentsTimeout: '2000' }),
        restarted: describeDeployment({ revision: 50, newRs: RESTARTED_RS, oldRs: LIVE_RS, paymentsTimeout: '30000', restartedAt: '2026-11-26T15:14:02Z' }),
      },
      reveals: [{ finding: 'long-timeout', seenIn: LONG_TIMEOUT }],
    },
    {
      match: ['kubectl rollout history deployment/pantry-api'],
      output: {
        exhausted: `deployment.apps/pantry-api
REVISION  CHANGE-CAUSE
47        release v2.15.1
48        release v2.16.0: migration 0042 drops unused indexes
49        release v2.16.1: keep orders_customer_id_idx`,
        'failing-fast': `deployment.apps/pantry-api
REVISION  CHANGE-CAUSE
47        release v2.15.1
48        release v2.16.0: migration 0042 drops unused indexes
49        release v2.16.1: keep orders_customer_id_idx
50        release v2.16.1: keep orders_customer_id_idx`,
        restarted: `deployment.apps/pantry-api
REVISION  CHANGE-CAUSE
47        release v2.15.1
48        release v2.16.0: migration 0042 drops unused indexes
49        release v2.16.1: keep orders_customer_id_idx
50        release v2.16.1: keep orders_customer_id_idx`,
      },
    },
    {
      match: ['kubectl logs deployment/pantry-api', `kubectl logs pod/${livePods[0]!.pod}`],
      output: { exhausted: exhaustedLogs(0) },
      reveals: fromApiLogs,
    },
    ...livePods.slice(1).map((p, i) => ({
      match: [`kubectl logs pod/${p.pod}`],
      output: { exhausted: exhaustedLogs(i + 1) },
      reveals: fromApiLogs,
    })),
    {
      match: ['kubectl logs deployment/pantry-api', ...failingFastPods.map((p) => `kubectl logs pod/${p.pod}`)],
      output: { 'failing-fast': failingFastLogs },
    },
    {
      match: ['kubectl logs deployment/pantry-api', ...restartedPods.map((p) => `kubectl logs pod/${p.pod}`)],
      output: { restarted: restartedLogs },
      reveals: fromApiLogs,
    },
    {
      match: ['curl https://pantry.example.com/healthz', 'curl -s https://pantry.example.com/healthz'],
      output: '{"status":"ok","version":"2.16.1"}',
    },
    {
      match: ['curl https://pantry.example.com/api/products?category=bakery', 'curl -s https://pantry.example.com/api/products?category=bakery'],
      output: {
        ...whileStuck('{"error":"service busy, try again","code":"POOL_TIMEOUT"}'),
        'failing-fast': '{"products":[{"id":2210,"name":"Sourdough loaf","priceCents":450},{"id":2214,"name":"Seeded rye","priceCents":395}],"page":1}',
      },
    },

    // --- Changing the cluster ------------------------------------------------------------------
    failFast('2000'),
    failFast('1000'),
    failFast('3000'),
    {
      match: ['kubectl rollout restart deployment/pantry-api'],
      output: { exhausted: 'deployment.apps/pantry-api restarted' },
      mutating: {
        warning: 'Restart every pantry-api pod, one at a time, with the same release and configuration. The stuck checkouts’ transactions end with the old pods.',
        to: 'restarted',
        destroys: ['stuck-transactions' as const],
        consequence:
          'The new pods start with empty pools and serve everything for about a minute. Then new checkouts call the still-slow payments service, each holding a connection while it waits, and the pools fill up again. Nothing has changed about how pantry-api waits.',
      },
    },

    // --- Inside postgres-0 ---------------------------------------------------------------------
    {
      match: [`psql -U pantry -c "${STUCK_QUERY}"`],
      where: 'container',
      output: { exhausted: stuckTransactions(livePods), 'failing-fast': stuckTransactions([]), restarted: stuckTransactions(restartedPods) },
      evidence: 'stuck-transactions',
      reveals: [{ finding: 'stuck-in-transaction', seenIn: '(30 rows)' }],
    },
    {
      match: [`psql -U pantry -c "${STATES_QUERY}"`],
      where: 'container',
      output: { exhausted: connectionStates(30, 4), 'failing-fast': connectionStates(0, 31), restarted: connectionStates(30, 4) },
    },
    {
      match: ['psql -U pantry -c "SHOW max_connections"'],
      where: 'container',
      // SHOW returns text, which psql aligns left.
      output: ' max_connections\n-----------------\n 100\n(1 row)',
    },
  ],
  dashboard,
  expertPath: [
    {
      command: 'kubectl top pods',
      why: 'Requests are failing. Is anything actually busy: the API, or the database it uses?',
      reaches: ['nothing-busy'],
    },
    {
      command: 'kubectl logs deployment/pantry-api --tail=20',
      why: 'Nothing is working hard, so the service is waiting for something. What do the failing requests say?',
      reaches: ['pool-exhausted'],
    },
    {
      command: `kubectl exec postgres-0 -- psql -U pantry -c "${STUCK_QUERY}" | tee stuck-transactions.txt`,
      why: 'Every connection is in use, yet the database is idle. What are the connections doing? Keep a copy: any Mitigation ends them.',
      reaches: ['stuck-in-transaction'],
      achieves: { captured: 'stuck-transactions' },
    },
    {
      command: 'kubectl logs deployment/pantry-api | grep payments',
      why: 'The connections wait inside checkout transactions. What does checkout wait for in the middle of one?',
      reaches: ['payments-slow'],
    },
    {
      command: 'kubectl describe deployment/pantry-api',
      why: 'Payments is slow, and pantry-api waits for it. How long is pantry-api willing to wait?',
      reaches: ['long-timeout'],
    },
    {
      command: 'kubectl set env deployment/pantry-api PAYMENTS_TIMEOUT_MS=2000',
      why: 'Stop the harm: make checkout give up quickly, so it hands its connection back and the rest of the site can use it.',
      achieves: { state: 'failing-fast' },
    },
  ],
  hints: [
    {
      goal: { finding: 'nothing-busy' },
      question: 'Requests are failing. Is anything working hard: the pantry-api pods, or PostgreSQL?',
      playbook: 'what-is-using-cpu-and-memory',
      command: 'kubectl top pods',
    },
    {
      goal: { finding: 'pool-exhausted' },
      question: 'Nothing is busy, so pantry-api must be waiting for something. What do the failing requests report?',
      playbook: 'is-the-service-waiting-for-database-connections',
      command: 'kubectl logs deployment/pantry-api --tail=20',
    },
    {
      goal: { captured: 'stuck-transactions' },
      question: 'Every connection is taken, yet PostgreSQL is idle. What are those connections doing? Keep a copy before anything changes.',
      playbook: 'what-is-the-database-doing-right-now',
      command: `kubectl exec postgres-0 -- psql -U pantry -c "${STUCK_QUERY}" | tee stuck-transactions.txt`,
    },
    {
      goal: { finding: 'payments-slow' },
      question: 'Checkouts hold their connections inside open transactions. What are they waiting for?',
      playbook: 'is-a-dependency-slow',
      command: 'kubectl logs deployment/pantry-api | grep payments',
    },
    {
      goal: { finding: 'long-timeout' },
      question: 'Payments is slow. How long is pantry-api configured to wait for it?',
      playbook: 'what-configuration-is-a-container-running-with',
      command: 'kubectl describe deployment/pantry-api',
    },
    {
      goal: { state: 'failing-fast' },
      question: 'You cannot speed up payments. How can pantry-api stop letting slow charges hold every connection?',
      playbook: 'how-do-i-change-a-setting-without-a-release',
      command: 'kubectl set env deployment/pantry-api PAYMENTS_TIMEOUT_MS=2000',
    },
  ],
  rootCauses: [
    {
      id: 'database-overloaded',
      label: 'PostgreSQL is overloaded and cannot keep up with queries.',
      contradictedBy: [
        { finding: 'nothing-busy', why: 'PostgreSQL is using 27m of CPU, almost nothing. It is not slow; nobody is asking it anything.' },
        { finding: 'stuck-in-transaction', why: 'Its connections are idle, waiting for pantry-api to finish their transactions, not running queries.' },
      ],
    },
    {
      id: 'held-connections',
      label:
        'Checkout holds a database connection in an open transaction while it waits up to 30 seconds for payments. Payments slowed, so checkouts held every connection and all other requests timed out waiting for one.',
      correct: true,
    },
    {
      id: 'pool-too-small',
      label: 'A pool of 10 connections per pod is too small for normal traffic.',
      contradictedBy: [
        {
          finding: 'stuck-in-transaction',
          why: 'The connections are not busy serving traffic: they sit idle inside transactions for up to 20 seconds. A bigger pool would fill with stuck checkouts the same way.',
        },
      ],
    },
    {
      id: 'payments-down',
      label: 'The payments service is down, so checkout fails.',
      contradictedBy: [
        {
          finding: 'payments-slow',
          why: 'Payments is slow, not down: charges succeed after about 20 seconds. What fails the product pages is pantry-api holding a database connection for each of those 20 seconds.',
        },
      ],
    },
    {
      id: 'bad-release',
      label: 'A recent release broke pantry-api’s database access.',
      contradictedBy: [
        {
          finding: 'stuck-in-transaction',
          why: 'Database access works: every stuck connection has just run its UPDATE successfully and is waiting on pantry-api. And nothing has been released since Tuesday, while the errors began at 15:03.',
        },
      ],
    },
  ],
  mitigations: [
    {
      id: 'fail-fast',
      label: 'Lower the payments timeout to 2 seconds',
      verdict: 'best',
      explanation:
        'Checkouts stop holding connections for 20 seconds, so browsing, carts and order history recover within a minute. Charges slower than 2 seconds now fail, so some checkouts that would have succeeded slowly fail instead; that is the price of keeping the rest of the site up until payments recovers.',
    },
    {
      id: 'checkout-off',
      label: 'Turn checkout off with CHECKOUT_ENABLED=false',
      verdict: 'works',
      explanation:
        'Nothing holds connections any more, so the rest of the site recovers. But nobody can even try to pay, including the customers whose charges would have gone through.',
    },
    {
      id: 'restart',
      label: 'Restart the pantry-api pods',
      verdict: 'no-effect',
      explanation:
        'The pools are empty for about a minute, then slow checkouts fill them again. The restart also ends the stuck transactions you needed to see.',
    },
    {
      id: 'scale-up',
      label: 'Scale pantry-api up to six replicas',
      verdict: 'no-effect',
      explanation:
        'Six pools fill the same way as three, a little later, and twice as many connections sit idle in PostgreSQL.',
    },
    {
      id: 'bigger-pool',
      label: 'Raise the pool to 40 connections per pod',
      verdict: 'harmful',
      explanation:
        'More checkouts can wait at once, so 120 connections pile up against PostgreSQL’s limit of 100. The database then refuses new connections from everyone, including other services and your own psql.',
    },
  ],
  postmortem: {
    summary:
      'The payments service slowed to about 20 seconds a charge. pantry-api held a database connection for the whole of each charge, ran out of connections, and failed about 41% of all requests for 12 minutes.',
    impact:
      'From 15:03 to 15:15 UTC product pages, carts and order history failed with 503 after a 5-second wait for about 41% of requests. Checkouts that got a connection took about 20 seconds. Nothing had been deployed.',
    timeline: [
      { at: '15:02', event: 'The payments service, run by another team, slows from 200 milliseconds a charge to about 20 seconds.' },
      { at: '15:03', event: 'Checkouts hold pantry-api’s database connections while they wait. Every other request starts timing out after 5 seconds.' },
      { at: '15:09', event: 'PantryApiHighErrorRate fires. On-call is paged.' },
      { at: '15:12', event: 'On-call finds idle pods, a full connection pool and 30 connections idle in transaction, and saves pg_stat_activity.' },
      { at: '15:14', event: 'The logs show 20-second payment calls; the Deployment allows 30. On-call sets PAYMENTS_TIMEOUT_MS to 2000.' },
      { at: '15:15', event: 'New pods fail slow charges after 2 seconds. Browsing recovers; the alert resolves at 15:21.' },
      { at: '15:40', event: 'The payments team resolves their incident. Checkouts succeed again.' },
    ],
    rootCause:
      'Checkout opened a database transaction, marked the order awaiting_payment, then called payments before committing, holding its connection for as long as the call took. The payments timeout was 30 seconds, far longer than the 5 seconds other requests would wait for a connection. When payments slowed, checkouts held all 30 connections and the rest of the site starved.',
    resolution:
      'Lowered PAYMENTS_TIMEOUT_MS to 2000 at 15:14, so slow charges fail fast and free their connections. Checkout will commit the order before calling payments, and confirm the payment in a second, short transaction.',
    actionItems: [
      'Never hold a database transaction open across a call to another service. Commit first, then call, then record the result.',
      'Keep timeouts on calls to dependencies shorter than what callers of this service will wait.',
      'Add a circuit breaker on payments, so a slow dependency is cut off before it ties up resources.',
      'Set idle_in_transaction_session_timeout in PostgreSQL, and alert on requests waiting for a pool connection.',
    ],
  },
  prevention: [
    'Do not hold scarce resources, such as database connections or locks, while waiting on the network. A slow dependency then slows only the requests that need it.',
    'Give every outbound call a timeout that fits the caller’s own deadline. A 30-second timeout behind a 5-second pool wait guaranteed starvation.',
    'Isolate dependencies: a circuit breaker, or a separate pool for checkout, keeps one slow service from taking the whole site down with it.',
    'Watch saturation of every finite resource, not only CPU. The pool was at 100% while every CPU graph looked calm.',
  ],
  links: {
    concepts: ['investigating-by-hypothesis', 'observability', 'golden-signals-and-alerting', 'prevention'],
    resources: ['sre-cascading-failures', 'fowler-circuit-breaker', 'node-postgres-pool', 'pg-client-config', 'kubectl-set-env'],
  },
})
