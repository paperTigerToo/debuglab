import type { AccessLogLine, Dashboard, Deploy } from '../engine/types'
import { defineIncident } from '../engine/types'
import { access, appLog, clock, pad, podsTable, round, topTable, unavailable503, wobble, type PodRow } from './build'

// Memory Leak: release v2.15.0 of pantry-api, out since yesterday evening, added an in-memory cache
// for product search results. It has no size limit or expiry and its key includes the shopper's
// session, so almost every search adds an entry that is never read again. Each container's memory
// climbs until it crosses its 512Mi limit and the kernel kills it (OOMKilled, exit code 137);
// Kubernetes restarts it and the climb begins again. Requests in flight on a killed container fail.
//
// Named states:
//   leaking      v2.15.0 is live; containers are OOMKilled every 35 to 40 minutes (the start).
//   restarted    the Learner restarted the pods: fresh processes, empty caches, the same leak.
//   rolled-back  the Learner rolled back to v2.14.1, which has no search cache; memory stays flat.
//   outage       the Learner deleted or scaled away pantry-api; every request fails.

// ---------------------------------------------------------------------------------------------
// Pods

type Pod = {
  pod: string
  node: string
  nodeIp: string
  ip: string
  /** When the pod was created. */
  created: string
  /** The current container: when it started, its restarts and memory now. */
  started: string
  restarts: number
  lastRestart: string
  memory: string
  cpu: string
  /** The container before this one, which was OOMKilled. */
  previous: { started: string; finished: string }
}

const leakingPods: Pod[] = [
  {
    pod: 'pantry-api-7f9c6d5b48-kq7wz',
    node: 'node-a',
    nodeIp: '10.0.1.20',
    ip: '10.42.0.57',
    created: 'Wed, 18 Nov 2026 17:40:22',
    started: 'Thu, 19 Nov 2026 09:40:14',
    restarts: 5,
    lastRestart: '6m ago',
    memory: '185Mi',
    cpu: '71m',
    previous: { started: 'Thu, 19 Nov 2026 09:00:31', finished: 'Thu, 19 Nov 2026 09:40:12' },
  },
  {
    pod: 'pantry-api-7f9c6d5b48-n2x8v',
    node: 'node-b',
    nodeIp: '10.0.1.21',
    ip: '10.42.1.63',
    created: 'Wed, 18 Nov 2026 17:40:51',
    started: 'Thu, 19 Nov 2026 09:10:39',
    restarts: 4,
    lastRestart: '36m ago',
    memory: '487Mi',
    cpu: '164m',
    previous: { started: 'Thu, 19 Nov 2026 08:30:44', finished: 'Thu, 19 Nov 2026 09:10:37' },
  },
  {
    pod: 'pantry-api-7f9c6d5b48-t5hzr',
    node: 'node-c',
    nodeIp: '10.0.1.22',
    ip: '10.42.2.44',
    created: 'Wed, 18 Nov 2026 17:41:19',
    started: 'Thu, 19 Nov 2026 09:30:04',
    restarts: 5,
    lastRestart: '16m ago',
    memory: '307Mi',
    cpu: '102m',
    previous: { started: 'Thu, 19 Nov 2026 08:50:18', finished: 'Thu, 19 Nov 2026 09:30:02' },
  },
]

// `kubectl rollout restart` stamps the pod template, so the restarted pods have a new ReplicaSet and new names.
// Both sets start about 74 seconds before the Learner looks, one pod after another as the rollout proceeds.
const restartedPods = [
  { pod: 'pantry-api-6b8d9c4f72-hm4qx', node: 'node-a', ip: '10.42.0.61', memory: '163Mi', cpu: '88m', age: '74s' },
  { pod: 'pantry-api-6b8d9c4f72-r7wn5', node: 'node-b', ip: '10.42.1.70', memory: '158Mi', cpu: '93m', age: '52s' },
  { pod: 'pantry-api-6b8d9c4f72-zc2jt', node: 'node-c', ip: '10.42.2.51', memory: '151Mi', cpu: '85m', age: '31s' },
]
const rolledBackPods = [
  { pod: 'pantry-api-5c8d9f7b46-b4xpl', node: 'node-a', ip: '10.42.0.62', memory: '139Mi', cpu: '79m', age: '74s' },
  { pod: 'pantry-api-5c8d9f7b46-g8kzs', node: 'node-b', ip: '10.42.1.71', memory: '142Mi', cpu: '84m', age: '52s' },
  { pod: 'pantry-api-5c8d9f7b46-w2nfd', node: 'node-c', ip: '10.42.2.52', memory: '136Mi', cpu: '77m', age: '31s' },
]
const LEAKING_RS = 'pantry-api-7f9c6d5b48'
const RESTARTED_RS = 'pantry-api-6b8d9c4f72'
const ROLLED_BACK_RS = 'pantry-api-5c8d9f7b46'

const datastoreRows: PodRow[] = [
  { name: 'postgres-0', ready: '1/1', status: 'Running', restarts: '0', age: '46d', ip: '10.42.0.12', node: 'node-a' },
  { name: 'redis-7c9d5b8f6-hq2lw', ready: '1/1', status: 'Running', restarts: '0', age: '46d', ip: '10.42.2.7', node: 'node-c' },
]

const leakingRows: PodRow[] = leakingPods.map((p) => ({
  name: p.pod,
  ready: '1/1',
  status: 'Running',
  restarts: `${p.restarts} (${p.lastRestart})`,
  age: '16h',
  ip: p.ip,
  node: p.node,
}))
const freshRows = (pods: typeof restartedPods): PodRow[] =>
  pods.map((p) => ({ name: p.pod, ready: '1/1', status: 'Running', restarts: '0', age: p.age, ip: p.ip, node: p.node }))

const getPods = (api: PodRow[]) => podsTable([...api, ...datastoreRows])
const getPodsWide = (api: PodRow[]) => podsTable([...api, ...datastoreRows], true)

const topPods = (api: { pod: string; cpu: string; memory: string }[]) =>
  topTable([
    ...api.map((p) => ({ name: p.pod, cpu: p.cpu, memory: p.memory })),
    { name: 'postgres-0', cpu: '131m', memory: '502Mi' },
    { name: 'redis-7c9d5b8f6-hq2lw', cpu: '11m', memory: '41Mi' },
  ])

// ---------------------------------------------------------------------------------------------
// Inside pantry-api

const resourcesBlock = `    Limits:
      cpu:     1
      memory:  512Mi
    Requests:
      cpu:      250m
      memory:   256Mi
    Liveness:   http-get http://:8080/healthz delay=10s timeout=1s period=10s #success=1 #failure=3
    Readiness:  http-get http://:8080/healthz delay=5s timeout=1s period=5s #success=1 #failure=3`

// The heap ceiling is set above the container's limit, so the kernel kills the process (OOMKilled, exit 137)
// before V8 would stop it with "JavaScript heap out of memory". A common and confusing setup.
const env = `      NODE_ENV:            production
      NODE_OPTIONS:        --max-old-space-size=768
      DATABASE_URL:        <set to the key 'url' in secret 'pantry-db'>  Optional: false
      REDIS_URL:           redis://redis:6379
      PAYMENTS_URL:        http://payments.payments.svc.cluster.local`

function describeLeakingPod(p: Pod): string {
  return `Name:             ${p.pod}
Namespace:        pantry
Priority:         0
Service Account:  pantry-api
Node:             ${p.node}/${p.nodeIp}
Start Time:       ${p.created} +0000
Labels:           app=pantry-api
                  pod-template-hash=7f9c6d5b48
Status:           Running
IP:               ${p.ip}
Controlled By:    ReplicaSet/${LEAKING_RS}
Containers:
  api:
    Image:          registry.example.com/pantry/api:2.15.0
    Port:           8080/TCP
    State:          Running
      Started:      ${p.started} +0000
    Last State:     Terminated
      Reason:       OOMKilled
      Exit Code:    137
      Started:      ${p.previous.started} +0000
      Finished:     ${p.previous.finished} +0000
    Ready:          True
    Restart Count:  ${p.restarts}
${resourcesBlock}
    Environment:
${env}
Conditions:
  Type              Status
  Initialized       True
  Ready             True
  ContainersReady   True
  PodScheduled      True
QoS Class:          Burstable
Events:
  Type    Reason   Age                 From     Message
  ----    ------   ----                ----     -------
  Normal  Pulled   ${pad(`${p.lastRestart.replace(' ago', '')} (x${p.restarts + 1} over 16h)`, 20)}kubelet  Container image "registry.example.com/pantry/api:2.15.0" already present on machine
  Normal  Created  ${pad(`${p.lastRestart.replace(' ago', '')} (x${p.restarts + 1} over 16h)`, 20)}kubelet  Created container api
  Normal  Started  ${pad(`${p.lastRestart.replace(' ago', '')} (x${p.restarts + 1} over 16h)`, 20)}kubelet  Started container api`
}

function describeFreshPod(p: (typeof restartedPods)[number], hash: string, version: string): string {
  return `Name:             ${p.pod}
Namespace:        pantry
Node:             ${p.node}
Labels:           app=pantry-api
                  pod-template-hash=${hash}
Status:           Running
IP:               ${p.ip}
Controlled By:    ReplicaSet/pantry-api-${hash}
Containers:
  api:
    Image:          registry.example.com/pantry/api:${version}
    Port:           8080/TCP
    State:          Running
      Started:      Thu, 19 Nov 2026 09:48:21 +0000
    Ready:          True
    Restart Count:  0
${resourcesBlock}
Events:
  Type    Reason     Age   From               Message
  ----    ------     ----  ----               -------
  Normal  Scheduled  74s   default-scheduler  Successfully assigned pantry/${p.pod} to ${p.node}
  Normal  Started    72s   kubelet            Started container api`
}

function describeDeployment(o: { revision: number; cause: string; version: string; newRs: string; oldRs: string }): string {
  return `Name:                   pantry-api
Namespace:              pantry
Labels:                 app=pantry-api
Annotations:            deployment.kubernetes.io/revision: ${o.revision}
                        kubernetes.io/change-cause: ${o.cause}
Selector:               app=pantry-api
Replicas:               3 desired | 3 updated | 3 total | 3 available | 0 unavailable
StrategyType:           RollingUpdate
Pod Template:
  Labels:  app=pantry-api
  Containers:
   api:
    Image:      registry.example.com/pantry/api:${o.version}
    Port:       8080/TCP
${resourcesBlock}
    Environment:
${env}
Conditions:
  Type           Status  Reason
  ----           ------  ------
  Available      True    MinimumReplicasAvailable
  Progressing    True    NewReplicaSetAvailable
OldReplicaSets:  ${o.oldRs} (0/0 replicas created)
NewReplicaSet:   ${o.newRs} (3/3 replicas created)`
}

const v215Cause = 'release v2.15.0: cache product search results'

// Application logs. A container's log starts when that container starts, so each restart begins a new one.
const { line, request } = appLog('2026-11-19')
const slowRequest = (time: string, path: string, ms: number) => line(time, 'warn', 'slow request', { method: 'GET', path, ms })

const startup = (time: string, version: string, cache: boolean) =>
  [
    line(time, 'info', `pantry-api ${version} starting`, { node: 'v22.11.0' }),
    ...(cache ? [line(time.replace(/\d{3}$/, '431'), 'info', 'search cache enabled', { cache: 'memory' })] : []),
    line(time.replace(/\d{3}$/, '502'), 'info', 'connected to postgres', { pool: 10 }),
    line(time.replace(/\d{3}$/, '517'), 'info', 'listening', { port: 8080 }),
  ].join('\n')

function currentLogs(startedAt: string, minute: string): string {
  return [
    startup(`${startedAt}.412`, 'v2.15.0', true),
    request(`${minute}:02.118`, 'GET', '/api/products/search?q=oat+milk&page=1', 46),
    request(`${minute}:02.907`, 'GET', '/api/cart', 12),
    request(`${minute}:03.551`, 'GET', '/api/products/search?q=sourdough&page=1', 52),
    request(`${minute}:04.208`, 'GET', '/healthz', 1),
    request(`${minute}:05.730`, 'GET', '/api/products/search?q=oat+milk&page=2', 49),
    request(`${minute}:06.014`, 'POST', '/api/cart/items', 18),
    request(`${minute}:06.880`, 'GET', '/api/products/search?q=bananas&page=1', 61),
    request(`${minute}:08.312`, 'POST', '/api/checkout', 231),
    request(`${minute}:09.208`, 'GET', '/healthz', 1),
    request(`${minute}:09.744`, 'GET', '/api/products/search?q=coffee+beans&page=1', 58),
  ].join('\n')
}

/** The last lines a container printed before the kernel killed it: busy, slow, then nothing at all. */
function previousLogs(p: Pod): string {
  const end = p.previous.finished.slice(-8) // hh:mm:ss
  const [h, m] = end.split(':')
  const at = (s: string) => `${h}:${m}:${s}`
  const startedAt = p.previous.started.slice(-8)
  return [
    startup(`${startedAt}.388`, 'v2.15.0', true),
    request(`${startedAt.slice(0, 5)}:41.207`, 'GET', '/api/products/search?q=eggs&page=1', 44),
    request(`${startedAt.slice(0, 5)}:42.016`, 'GET', '/api/cart', 11),
    slowRequest(at('02.611'), '/api/products/search?q=gluten+free+bread&page=1', 1210),
    request(at('03.104'), 'GET', '/api/cart', 388),
    slowRequest(at('05.947'), '/api/products/search?q=apples&page=3', 1544),
    request(at('07.380'), 'POST', '/api/cart/items', 412),
    slowRequest(at('09.022'), '/api/products/search?q=tea&page=1', 1873),
    request(at('10.415'), 'GET', '/healthz', 96),
    slowRequest(at('11.906'), '/api/products/search?q=rice&page=2', 2240),
  ].join('\n')
}

/** A pod that has never restarted has no previous container to read. */
const noPrevious = (p: { pod: string }) =>
  `Error from server (BadRequest): previous terminated container "api" in pod "${p.pod}" not found`

const metrics = (o: { rss: number; heapUsed: number; heapTotal: number; entries?: number; hits?: number }) =>
  [
    '# HELP process_resident_memory_bytes Resident memory size in bytes.',
    '# TYPE process_resident_memory_bytes gauge',
    `process_resident_memory_bytes ${o.rss}`,
    '# HELP nodejs_heap_size_used_bytes Process heap size used from Node.js in bytes.',
    '# TYPE nodejs_heap_size_used_bytes gauge',
    `nodejs_heap_size_used_bytes ${o.heapUsed}`,
    `nodejs_heap_size_total_bytes ${o.heapTotal}`,
    'nodejs_external_memory_bytes 3121334',
    '# HELP nodejs_gc_duration_seconds Garbage collection duration by kind.',
    '# TYPE nodejs_gc_duration_seconds histogram',
    `nodejs_gc_duration_seconds_sum{kind="major"} ${o.entries ? '41.88' : '0.94'}`,
    ...(o.entries === undefined
      ? []
      : [
          '# HELP pantry_search_cache_entries Entries in the product search result cache.',
          '# TYPE pantry_search_cache_entries gauge',
          `pantry_search_cache_entries ${o.entries}`,
          '# HELP pantry_search_cache_hits_total Searches answered from the cache.',
          '# TYPE pantry_search_cache_hits_total counter',
          `pantry_search_cache_hits_total ${o.hits}`,
          '# HELP pantry_search_cache_misses_total Searches that went to the database and were added to the cache.',
          '# TYPE pantry_search_cache_misses_total counter',
          `pantry_search_cache_misses_total ${o.entries}`,
          '# HELP pantry_search_cache_evictions_total Entries removed from the cache.',
          '# TYPE pantry_search_cache_evictions_total counter',
          'pantry_search_cache_evictions_total 0',
        ]),
    '# HELP http_requests_total Requests handled, by route.',
    '# TYPE http_requests_total counter',
    `http_requests_total{route="/api/products/search"} ${(o.entries ?? 9000) + (o.hits ?? 0)}`,
  ].join('\n')

const cacheJs = `'use strict'

// Cache search results so a repeated search skips the database.
const results = new Map()

function keyFor(req) {
  return \`\${req.session.id}:\${req.query.q}:\${req.query.page ?? 1}\`
}

async function cachedSearch(req, search) {
  const key = keyFor(req)
  if (results.has(key)) {
    metrics.hits.inc()
    return results.get(key)
  }
  metrics.misses.inc()
  const found = await search(req.query.q, req.query.page)
  results.set(key, found)
  metrics.entries.set(results.size)
  return found
}

module.exports = { cachedSearch }`

// ---------------------------------------------------------------------------------------------
// Dashboard: one sample every five minutes from 06:00, as morning traffic builds.

const label = clock('06:00', 5)
const NOW = 46 // 09:50: the first sample after the Learner acts
const LIMIT_MI = 512
const FRESH_MI = 95

const requestsAt = (i: number) => round(40 + 148 / (1 + Math.exp(-(i - 22) / 4.5)) + wobble(i, 5), 0)
/** Memory a busy container leaks in five minutes, in Mi: about 10Mi a minute at the morning peak. */
const leakAt = (i: number) => (53 * requestsAt(i)) / 185

type Phase = 'leaking' | 'restarted' | 'rolled-back' | 'down'

/** Each container's memory, sample by sample; a container that crosses the limit is killed and starts again. */
function signals(length: number, phaseAt: (i: number) => Phase): Dashboard['signals'] {
  const memory = [330, 215, 452]
  const requests: number[] = []
  const errors: number[] = []
  const latency: number[] = []
  const saturation: number[] = []
  for (let i = 0; i < length; i++) {
    const phase = phaseAt(i)
    let killed = 0
    for (let p = 0; p < memory.length; p++) {
      if (phase === 'rolled-back') memory[p] = 138 + wobble(i + p, 4)
      else if (phase === 'restarted' && phaseAt(i - 1) === 'leaking') memory[p] = FRESH_MI + p * 6
      else memory[p]! += leakAt(i)
      if (memory[p]! > LIMIT_MI) {
        memory[p] = FRESH_MI + (memory[p]! - LIMIT_MI)
        killed++
      }
    }
    const fullest = Math.max(...memory) / LIMIT_MI
    requests.push(requestsAt(i))
    if (phase === 'down') {
      errors.push(100)
      latency.push(2)
      saturation.push(0)
      continue
    }
    // A killed container drops the requests it was serving; nginx answers them with 502.
    errors.push(round(0.2 + Math.abs(wobble(i, 0.12)) + killed * 1.4, 1))
    // A nearly full heap spends its time collecting garbage, and every request waits.
    latency.push(round(88 + wobble(i, 6) + (phase === 'rolled-back' ? 0 : 520 * fullest ** 6), 0))
    saturation.push(round(fullest * 100, 0))
  }
  return { requests, errors, latency, saturation }
}

function timeline(length: number, after: Phase) {
  const phaseAt = (i: number): Phase => (i < NOW ? 'leaking' : after)
  return { minutes: Array.from({ length }, (_, i) => label(i)), signals: signals(length, phaseAt) }
}

const history: Deploy[] = [
  { revision: 45, version: 'v2.15.0', at: 'Yesterday 17:40 UTC', by: 'ci: pipeline #1903' },
  { revision: 44, version: 'v2.14.1', at: 'Mon 16 Nov 11:12 UTC', by: 'ci: pipeline #1890' },
  { revision: 43, version: 'v2.13.1', at: 'Sat 14 Nov 14:15 UTC', by: 'on-call: kubectl rollout undo' },
]

const [kq7wz, n2x8v, t5hzr] = leakingPods.map((p) => `${p.ip}:8080`) as [string, string, string]
const [b4xpl, g8kzs, w2nfd] = rolledBackPods.map((p) => `${p.ip}:8080`) as [string, string, string]

const leakingTraffic: AccessLogLine[] = [
  access('09:40:04', 'GET', '/api/products/search?q=coffee+beans&page=1', 200, 1720, kq7wz),
  access('09:40:06', 'GET', '/api/cart', 200, 402, kq7wz),
  access('09:40:09', 'GET', '/api/products/search?q=rice&page=2', 200, 2210, kq7wz),
  access('09:40:11', 'POST', '/api/checkout', 200, 260, n2x8v),
  access('09:40:12', 'GET', '/api/products/search?q=pasta&page=1', 502, 1903, kq7wz),
  access('09:40:12', 'POST', '/api/cart/items', 502, 388, kq7wz),
  access('09:40:13', 'GET', '/api/products/4411', 200, 31, t5hzr),
  access('09:40:15', 'GET', '/api/products/search?q=lentils&page=1', 200, 94, n2x8v),
  access('09:40:16', 'GET', '/api/cart', 200, 14, t5hzr),
  access('09:45:38', 'GET', '/api/products/search?q=oat+milk&page=1', 200, 812, n2x8v),
  access('09:45:40', 'GET', '/api/products/search?q=sourdough&page=1', 200, 63, kq7wz),
  access('09:45:41', 'POST', '/api/checkout', 200, 247, t5hzr),
  access('09:45:43', 'GET', '/api/products/search?q=bananas&page=3', 200, 951, n2x8v),
  access('09:45:44', 'GET', '/api/account', 401, 3, kq7wz),
  access('09:45:46', 'GET', '/api/cart', 200, 298, n2x8v),
]

const rolledBackTraffic: AccessLogLine[] = [
  access('10:14:02', 'GET', '/api/products/search?q=oat+milk&page=1', 200, 71, b4xpl),
  access('10:14:03', 'GET', '/api/cart', 200, 12, g8kzs),
  access('10:14:05', 'POST', '/api/checkout', 200, 219, w2nfd),
  access('10:14:06', 'GET', '/api/products/search?q=bread&page=2', 200, 66, g8kzs),
  access('10:14:08', 'POST', '/api/cart/items', 200, 17, b4xpl),
  access('10:14:09', 'GET', '/api/products/4411', 200, 10, w2nfd),
]

const downTraffic: AccessLogLine[] = [
  access('09:49:30', 'GET', '/api/products/search?q=eggs&page=1', 503, 0, '-'),
  access('09:49:31', 'GET', '/api/cart', 503, 0, '-'),
  access('09:49:31', 'POST', '/api/checkout', 503, 0, '-'),
  access('09:49:33', 'GET', '/', 503, 0, '-'),
]

const saturationOf = 'API memory of limit, fullest pod'

const dashboard = {
  leaking: {
    alert: { status: 'firing', summary: 'pantry-api containers keep restarting: 3 or more restarts every 30 minutes.' },
    saturationOf,
    ...timeline(NOW, 'leaking'),
    markers: [],
    deploys: history,
    logs: leakingTraffic,
  },
  restarted: {
    alert: {
      status: 'resolved',
      summary: 'Resolved at 10:05, for now: no restarts for 15 minutes. Memory is climbing again at the same rate as before.',
    },
    saturationOf,
    ...timeline(NOW + 6, 'restarted'),
    markers: [{ at: NOW, label: 'restart' }],
    deploys: [{ revision: 46, version: 'v2.15.0', at: 'Today 09:48 UTC', by: 'you: kubectl rollout restart' }, ...history],
    logs: leakingTraffic.slice(-6),
  },
  'rolled-back': {
    alert: { status: 'resolved', summary: 'Resolved at 10:05: no restarts for 15 minutes, and memory is flat.' },
    saturationOf,
    ...timeline(NOW + 6, 'rolled-back'),
    markers: [{ at: NOW, label: 'rollback' }],
    deploys: [{ revision: 46, version: 'v2.14.1', at: 'Today 09:48 UTC', by: 'you: kubectl rollout undo' }, ...history],
    logs: [...leakingTraffic.slice(-4), ...rolledBackTraffic],
  },
  outage: {
    alert: { status: 'firing', summary: 'pantry-api has no running pods: nginx answers every request with 503.' },
    saturationOf,
    ...timeline(NOW + 3, 'down'),
    markers: [{ at: NOW, label: 'pantry-api removed' }],
    deploys: history,
    logs: [...leakingTraffic.slice(-3), ...downTraffic],
  },
} satisfies Record<string, Dashboard>

// ---------------------------------------------------------------------------------------------

const withLeak = <T,>(value: T) => ({ leaking: value, restarted: value })
const running = <T,>(value: T) => ({ leaking: value, restarted: value, 'rolled-back': value })

// What pantry-api-7f9c6d5b48-n2x8v reports at 487Mi, 36 minutes after its last restart.
const leakMetrics = metrics({ rss: 510_656_512, heapUsed: 438_861_824, heapTotal: 461_373_440, entries: 186_204, hits: 1_655 })
const metricsCommand = ['curl -s localhost:8080/metrics', 'curl localhost:8080/metrics', 'curl -s http://localhost:8080/metrics', 'curl http://localhost:8080/metrics']

const replacingProcesses = (what: string) =>
  `${what} The leaking processes go, and with them everything their memory held.`

const rollbackMutation = {
  warning: `Roll pantry-api back to the previous revision (v2.14.1). ${replacingProcesses('Kubernetes replaces every v2.15.0 pod.')}`,
  to: 'rolled-back',
  destroys: ['leak-metrics'],
  consequence:
    'The v2.14.1 pods replace the v2.15.0 ones over the next minute. v2.14.1 has no search cache: memory levels off at about 140Mi and the restarts stop. Now find out what v2.15.0 was filling its memory with.',
} as const

const outageMutation = (what: string) =>
  ({
    warning: `${what} Every pantry-api pod will terminate and nothing will replace them.`,
    to: 'outage',
    destroys: ['leak-metrics'],
    consequence:
      'pantry-api has no pods left. nginx answers every request with 503: the whole site is down, where before only some requests failed. Restart the Incident to try a safer path.',
  }) as const

export const memoryLeak = defineIncident({
  id: 'memory-leak',
  title: 'Memory Leak',
  difficulty: 2,
  namespace: 'pantry',
  alert: {
    name: 'PantryApiRestarting',
    severity: 'page',
    condition: '3 or more pantry-api container restarts in 30 minutes, for 30 minutes',
    startedAt: '09:41 UTC',
    summary: 'pantry-api containers keep restarting: 3 or more restarts every 30 minutes.',
  },
  briefing:
    'You are on call for Pantry again. Its HTTP API, pantry-api, runs on Kubernetes beside PostgreSQL and Redis, behind an nginx load balancer. It is a busy Thursday morning and you have just been paged: not for errors this time, but because pantry-api keeps restarting.',
  states: ['leaking', 'restarted', 'rolled-back', 'outage'],
  initialState: 'leaking',
  findings: {
    restarting: {
      summary: 'The pantry-api pods are 16 hours old, but their containers have restarted 4 or 5 times each, the latest minutes ago.',
    },
    'oom-killed': {
      summary: 'The containers were killed for crossing their 512Mi memory limit: Last State OOMKilled, exit code 137.',
    },
    'memory-near-limit': {
      summary: 'Memory use grows with each container’s uptime: 487Mi of 512Mi in the one that restarted longest ago.',
    },
    'release-adds-cache': {
      summary: 'The live release, v2.15.0, went out yesterday at 17:40 and added a cache for product search results.',
    },
    'cache-unbounded': {
      summary: 'The search cache only grows: 186,204 entries, about 1 search in 100 answered from it, and no evictions.',
    },
  },
  evidence: {
    'leak-metrics': {
      summary: 'Memory metrics from a leaking v2.15.0 process: how big its heap is and what fills it.',
      lost: 'the leaking processes were replaced, and a fresh process holds only minutes of growth. What filled the memory can no longer be measured.',
    },
  },
  resources: {
    leaking: [...leakingPods.map((p) => `pod/${p.pod}`), 'pod/postgres-0', 'pod/redis-7c9d5b8f6-hq2lw', 'deployment/pantry-api', 'deployment/redis'],
    restarted: [...restartedPods.map((p) => `pod/${p.pod}`), 'pod/postgres-0', 'pod/redis-7c9d5b8f6-hq2lw', 'deployment/pantry-api', 'deployment/redis'],
    'rolled-back': [...rolledBackPods.map((p) => `pod/${p.pod}`), 'pod/postgres-0', 'pod/redis-7c9d5b8f6-hq2lw', 'deployment/pantry-api', 'deployment/redis'],
    outage: ['pod/postgres-0', 'pod/redis-7c9d5b8f6-hq2lw', 'deployment/redis'],
  },
  shellPodPrefix: 'pantry-api-',
  commands: [
    // --- Reading the cluster -----------------------------------------------------------------
    {
      match: ['kubectl get pods'],
      output: {
        leaking: getPods(leakingRows),
        restarted: getPods(freshRows(restartedPods)),
        'rolled-back': getPods(freshRows(rolledBackPods)),
        outage: getPods([]),
      },
      reveals: [{ finding: 'restarting', seenIn: '5 (6m ago)' }],
    },
    {
      match: ['kubectl get pods -o wide'],
      output: {
        leaking: getPodsWide(leakingRows),
        restarted: getPodsWide(freshRows(restartedPods)),
        'rolled-back': getPodsWide(freshRows(rolledBackPods)),
        outage: getPodsWide([]),
      },
      reveals: [{ finding: 'restarting', seenIn: '5 (6m ago)' }],
    },
    {
      match: ['kubectl top pods'],
      output: {
        leaking: topPods(leakingPods),
        restarted: topPods(restartedPods),
        'rolled-back': topPods(rolledBackPods),
        outage: topPods([]),
      },
      reveals: [{ finding: 'memory-near-limit', seenIn: '487Mi' }],
    },
    {
      match: ['kubectl top nodes'],
      output: `NAME     CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)
node-a   502m         12%      3104Mi          39%
node-b   611m         15%      3390Mi          43%
node-c   547m         13%      3215Mi          41%`,
    },
    {
      match: ['kubectl get deployments'],
      output: {
        ...running(`NAME         READY   UP-TO-DATE   AVAILABLE   AGE
pantry-api   3/3     3            3           217d
redis        1/1     1            1           217d`),
        outage: `NAME    READY   UP-TO-DATE   AVAILABLE   AGE
redis   1/1     1            1           217d`,
      },
    },
    {
      match: ['kubectl get replicasets'],
      output: {
        leaking: `NAME                    DESIRED   CURRENT   READY   AGE
${LEAKING_RS}   3         3         3       16h
${ROLLED_BACK_RS}   0         0         0       3d
pantry-api-84b7d5f9cd   0         0         0       11d
redis-7c9d5b8f6         1         1         1       217d`,
        restarted: `NAME                    DESIRED   CURRENT   READY   AGE
${RESTARTED_RS}   3         3         3       74s
${LEAKING_RS}   0         0         0       16h
${ROLLED_BACK_RS}   0         0         0       3d
redis-7c9d5b8f6         1         1         1       217d`,
        'rolled-back': `NAME                    DESIRED   CURRENT   READY   AGE
${ROLLED_BACK_RS}   3         3         3       3d
${LEAKING_RS}   0         0         0       16h
pantry-api-84b7d5f9cd   0         0         0       11d
redis-7c9d5b8f6         1         1         1       217d`,
        outage: `NAME              DESIRED   CURRENT   READY   AGE
redis-7c9d5b8f6   1         1         1       217d`,
      },
    },
    {
      match: ['kubectl get events', 'kubectl events', 'kubectl get events --sort-by=.lastTimestamp'],
      output: {
        leaking: `LAST SEEN   TYPE     REASON    OBJECT                            MESSAGE
16m         Normal   Pulled    pod/pantry-api-7f9c6d5b48-t5hzr   Container image "registry.example.com/pantry/api:2.15.0" already present on machine
16m         Normal   Created   pod/pantry-api-7f9c6d5b48-t5hzr   Created container api
16m         Normal   Started   pod/pantry-api-7f9c6d5b48-t5hzr   Started container api
6m          Normal   Pulled    pod/pantry-api-7f9c6d5b48-kq7wz   Container image "registry.example.com/pantry/api:2.15.0" already present on machine
6m          Normal   Created   pod/pantry-api-7f9c6d5b48-kq7wz   Created container api
6m          Normal   Started   pod/pantry-api-7f9c6d5b48-kq7wz   Started container api`,
        restarted: `LAST SEEN   TYPE     REASON              OBJECT                            MESSAGE
76s         Normal   ScalingReplicaSet   deployment/pantry-api             Scaled up replica set ${RESTARTED_RS} to 1 from 0
72s         Normal   Started             pod/pantry-api-6b8d9c4f72-hm4qx   Started container api
70s         Normal   Killing             pod/pantry-api-7f9c6d5b48-kq7wz   Stopping container api
50s         Normal   Started             pod/pantry-api-6b8d9c4f72-r7wn5   Started container api
48s         Normal   Killing             pod/pantry-api-7f9c6d5b48-n2x8v   Stopping container api
29s         Normal   Started             pod/pantry-api-6b8d9c4f72-zc2jt   Started container api
27s         Normal   Killing             pod/pantry-api-7f9c6d5b48-t5hzr   Stopping container api`,
        'rolled-back': `LAST SEEN   TYPE     REASON               OBJECT                            MESSAGE
76s         Normal   DeploymentRollback   deployment/pantry-api             Rolled back deployment "pantry-api" to revision 44
72s         Normal   Started              pod/pantry-api-5c8d9f7b46-b4xpl   Started container api
70s         Normal   Killing              pod/pantry-api-7f9c6d5b48-kq7wz   Stopping container api
50s         Normal   Started              pod/pantry-api-5c8d9f7b46-g8kzs   Started container api
48s         Normal   Killing              pod/pantry-api-7f9c6d5b48-n2x8v   Stopping container api
29s         Normal   Started              pod/pantry-api-5c8d9f7b46-w2nfd   Started container api
27s         Normal   Killing              pod/pantry-api-7f9c6d5b48-t5hzr   Stopping container api`,
        outage: `LAST SEEN   TYPE     REASON    OBJECT                            MESSAGE
48s         Normal   Killing   pod/pantry-api-7f9c6d5b48-kq7wz   Stopping container api
48s         Normal   Killing   pod/pantry-api-7f9c6d5b48-n2x8v   Stopping container api
48s         Normal   Killing   pod/pantry-api-7f9c6d5b48-t5hzr   Stopping container api`,
      },
    },
    ...leakingPods.map((p) => ({
      match: [`kubectl describe pod/${p.pod}`],
      output: { leaking: describeLeakingPod(p) },
      reveals: [{ finding: 'oom-killed' as const, seenIn: 'OOMKilled' }],
    })),
    ...restartedPods.map((p) => ({
      match: [`kubectl describe pod/${p.pod}`],
      output: { restarted: describeFreshPod(p, '6b8d9c4f72', '2.15.0') },
    })),
    ...rolledBackPods.map((p) => ({
      match: [`kubectl describe pod/${p.pod}`],
      output: { 'rolled-back': describeFreshPod(p, '5c8d9f7b46', '2.14.1') },
    })),
    {
      match: ['kubectl describe deployment/pantry-api'],
      output: {
        leaking: describeDeployment({ revision: 45, cause: v215Cause, version: '2.15.0', newRs: LEAKING_RS, oldRs: ROLLED_BACK_RS }),
        restarted: describeDeployment({ revision: 46, cause: v215Cause, version: '2.15.0', newRs: RESTARTED_RS, oldRs: LEAKING_RS }),
        'rolled-back': describeDeployment({ revision: 46, cause: 'release v2.14.1', version: '2.14.1', newRs: ROLLED_BACK_RS, oldRs: LEAKING_RS }),
      },
      reveals: [{ finding: 'release-adds-cache', seenIn: 'cache product search results' }],
    },
    {
      match: ['kubectl rollout history deployment/pantry-api'],
      output: {
        leaking: `deployment.apps/pantry-api
REVISION  CHANGE-CAUSE
43        release v2.13.1
44        release v2.14.1
45        ${v215Cause}`,
        restarted: `deployment.apps/pantry-api
REVISION  CHANGE-CAUSE
43        release v2.13.1
44        release v2.14.1
45        ${v215Cause}
46        ${v215Cause}`,
        'rolled-back': `deployment.apps/pantry-api
REVISION  CHANGE-CAUSE
43        release v2.13.1
45        ${v215Cause}
46        release v2.14.1`,
      },
      reveals: [{ finding: 'release-adds-cache', seenIn: 'cache product search results' }],
    },
    {
      match: ['kubectl rollout status deployment/pantry-api'],
      output: running('deployment "pantry-api" successfully rolled out'),
    },
    {
      match: ['kubectl logs deployment/pantry-api', `kubectl logs pod/${leakingPods[0]!.pod}`],
      output: { leaking: currentLogs('09:40:14', '09:46') },
    },
    ...leakingPods.slice(1).map((p) => ({
      match: [`kubectl logs pod/${p.pod}`],
      output: { leaking: currentLogs(p.started.slice(-8), '09:46') },
    })),
    ...leakingPods.map((p) => ({
      match: [`kubectl logs pod/${p.pod} --previous`],
      output: { leaking: previousLogs(p) },
    })),
    {
      match: ['kubectl logs deployment/pantry-api', ...restartedPods.map((p) => `kubectl logs pod/${p.pod}`)],
      output: { restarted: currentLogs('09:48:21', '09:49') },
    },
    {
      match: ['kubectl logs deployment/pantry-api', ...rolledBackPods.map((p) => `kubectl logs pod/${p.pod}`)],
      output: {
        'rolled-back': [
          startup('09:48:21.204', 'v2.14.1', false),
          request('09:49:02.118', 'GET', '/api/products/search?q=oat+milk&page=1', 44),
          request('09:49:02.907', 'GET', '/api/cart', 11),
          request('09:49:04.208', 'GET', '/healthz', 1),
          request('09:49:06.014', 'POST', '/api/checkout', 214),
        ].join('\n'),
      },
    },
    {
      match: ['kubectl logs deployment/pantry-api --previous'],
      output: { leaking: previousLogs(leakingPods[0]!), restarted: noPrevious(restartedPods[0]!), 'rolled-back': noPrevious(rolledBackPods[0]!) },
    },
    ...restartedPods.map((p) => ({ match: [`kubectl logs pod/${p.pod} --previous`], output: { restarted: noPrevious(p) } })),
    ...rolledBackPods.map((p) => ({ match: [`kubectl logs pod/${p.pod} --previous`], output: { 'rolled-back': noPrevious(p) } })),
    {
      match: ['curl https://pantry.example.com/healthz', 'curl -s https://pantry.example.com/healthz'],
      output: {
        ...withLeak('{"status":"ok","version":"2.15.0"}'),
        'rolled-back': '{"status":"ok","version":"2.14.1"}',
        outage: unavailable503,
      },
    },

    // --- Changing the cluster ------------------------------------------------------------------
    {
      match: ['kubectl rollout undo deployment/pantry-api', 'kubectl rollout undo deployment/pantry-api --to-revision=44'],
      output: { leaking: 'deployment.apps/pantry-api rolled back' },
      mutating: rollbackMutation,
    },
    // After a restart the previous revision, 45, is the same leaking release: only revision 44 is v2.14.1.
    {
      match: ['kubectl rollout undo deployment/pantry-api --to-revision=44'],
      output: { restarted: 'deployment.apps/pantry-api rolled back' },
      mutating: rollbackMutation,
    },
    {
      match: ['kubectl rollout undo deployment/pantry-api'],
      output: { restarted: 'deployment.apps/pantry-api rolled back' },
      mutating: {
        warning: 'Roll pantry-api back to the previous revision, 45. The restart made revision 46, so 45 is the same v2.15.0 release.',
        to: 'restarted',
        consequence:
          'Kubernetes replaced the pods with v2.15.0 again: the restart counted as a revision, so "previous" meant the leaking release. Check kubectl rollout history and name the revision: --to-revision=44 is v2.14.1.',
      },
    },
    {
      match: ['kubectl rollout restart deployment/pantry-api'],
      output: { leaking: 'deployment.apps/pantry-api restarted' },
      mutating: {
        warning: `Restart every pantry-api pod, one at a time, with the same release. ${replacingProcesses('New pods replace the old ones.')}`,
        to: 'restarted',
        destroys: ['leak-metrics'],
        consequence:
          'Fresh pods start with empty memory and the restarts stop, for now. They run the same release, so their memory is already climbing at the same rate: expect the next OOM kill within the hour.',
      },
    },
    {
      match: ['kubectl delete deployment/pantry-api'],
      output: running('deployment.apps "pantry-api" deleted'),
      mutating: outageMutation('Delete the pantry-api Deployment.'),
    },
    {
      match: ['kubectl scale deployment/pantry-api --replicas=0'],
      output: running('deployment.apps/pantry-api scaled'),
      mutating: outageMutation('Scale pantry-api to zero replicas.'),
    },

    // --- Inside a pantry-api container ---------------------------------------------------------
    {
      match: metricsCommand,
      where: 'container',
      output: {
        leaking: leakMetrics,
        restarted: metrics({ rss: 170_917_888, heapUsed: 98_041_856, heapTotal: 115_343_360, entries: 9_870, hits: 61 }),
        'rolled-back': metrics({ rss: 145_752_064, heapUsed: 61_865_984, heapTotal: 79_691_776 }),
      },
      evidence: 'leak-metrics',
      reveals: [{ finding: 'cache-unbounded', seenIn: 'pantry_search_cache_evictions_total 0' }],
    },
    {
      match: ['curl localhost:8080/healthz', 'curl -s localhost:8080/healthz'],
      where: 'container',
      output: { ...withLeak('{"status":"ok","version":"2.15.0"}'), 'rolled-back': '{"status":"ok","version":"2.14.1"}' },
    },
    {
      match: ['ps aux'],
      where: 'container',
      output: {
        leaking: `USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1 21.4  6.2 1601536 498688 ?     Ssl  09:10   6:12 node src/server.js
root          58  0.0  0.0   2576   912 pts/0    Ss   09:46   0:00 sh
root          64  0.0  0.0   7064  1584 pts/0    R+   09:46   0:00 ps aux`,
        restarted: `USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  6.2  2.1 1201664 166912 ?     Ssl  09:48   0:05 node src/server.js
root          31  0.0  0.0   2576   908 pts/0    Ss   09:49   0:00 sh
root          37  0.0  0.0   7064  1580 pts/0    R+   09:49   0:00 ps aux`,
        'rolled-back': `USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  5.8  1.8 1187464 142336 ?     Ssl  09:48   0:04 node src/server.js
root          31  0.0  0.0   2576   908 pts/0    Ss   09:49   0:00 sh
root          37  0.0  0.0   7064  1580 pts/0    R+   09:49   0:00 ps aux`,
      },
    },
    {
      match: ['env', 'printenv'],
      where: 'container',
      output: running(`PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
NODE_VERSION=22.11.0
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=768
DATABASE_URL=postgres://pantry:••••••@postgres:5432/pantry
REDIS_URL=redis://redis:6379
PAYMENTS_URL=http://payments.payments.svc.cluster.local
HOME=/root`),
    },
    { match: ['ls'], where: 'container', output: running('node_modules  package-lock.json  package.json  src') },
    {
      match: ['ls src'],
      where: 'container',
      output: running('config.js  db.js  metrics.js  payments  routes  search  server.js'),
    },
    {
      match: ['ls src/search'],
      where: 'container',
      output: { ...withLeak('cache.js  index.js'), 'rolled-back': 'index.js' },
    },
    {
      match: ['cat src/search/cache.js'],
      where: 'container',
      output: withLeak(cacheJs),
      reveals: [{ finding: 'cache-unbounded', seenIn: 'results.set(key, found)' }],
    },
  ],
  dashboard,
  expertPath: [
    {
      command: 'kubectl get pods',
      why: 'Start broad: are the pods running, restarting, or new?',
      reaches: ['restarting'],
    },
    {
      command: 'kubectl describe pod/pantry-api-7f9c6d5b48-n2x8v',
      why: 'The pods are old but their containers keep restarting. How did the last container end?',
      reaches: ['oom-killed'],
    },
    {
      command: 'kubectl top pods',
      why: 'They were killed for using too much memory. How much are they using now?',
      reaches: ['memory-near-limit'],
    },
    {
      command: 'kubectl rollout history deployment/pantry-api',
      why: 'Memory that grows until the process dies is usually a leak, and leaks arrive with code. What changed?',
      reaches: ['release-adds-cache'],
    },
    {
      command: 'kubectl exec pantry-api-7f9c6d5b48-n2x8v -- curl -s localhost:8080/metrics > pantry-api-metrics.txt',
      why: 'Any Mitigation replaces these processes. Save what the leaking one reports about its memory while it still exists.',
      achieves: { captured: 'leak-metrics' },
    },
    {
      command: 'kubectl rollout undo deployment/pantry-api',
      why: 'Stop the harm: v2.14.1 ran within the same limit for days. The measurements are saved, so investigation can continue.',
      achieves: { state: 'rolled-back' },
    },
    {
      command: 'grep search_cache pantry-api-metrics.txt',
      why: 'v2.15.0 added a search cache. Is that what was filling the memory?',
      reaches: ['cache-unbounded'],
    },
  ],
  hints: [
    {
      goal: { finding: 'restarting' },
      question: 'Start broad. Are the pantry-api pods running, crashing, or new?',
      playbook: 'are-the-pods-running',
      command: 'kubectl get pods',
    },
    {
      goal: { finding: 'oom-killed' },
      question: 'The pods are 16 hours old, yet their containers keep restarting. Why did the last one stop?',
      playbook: 'why-does-this-container-keep-restarting',
      command: 'kubectl describe pod/pantry-api-7f9c6d5b48-n2x8v',
    },
    {
      goal: { finding: 'memory-near-limit' },
      question: 'The containers were killed for using too much memory. How much are they using right now?',
      playbook: 'what-is-using-cpu-and-memory',
      command: 'kubectl top pods',
    },
    {
      goal: { finding: 'release-adds-cache' },
      question: 'Memory grows until the container dies. What changed in pantry-api recently?',
      playbook: 'what-was-deployed',
      command: 'kubectl rollout history deployment/pantry-api',
    },
    {
      goal: { captured: 'leak-metrics' },
      question: 'Rolling back or restarting will replace these processes and empty their memory. What can you save about the leak first?',
      playbook: 'what-is-the-process-holding-in-memory',
      command: 'kubectl exec pantry-api-7f9c6d5b48-n2x8v -- curl -s localhost:8080/metrics > pantry-api-metrics.txt',
    },
    {
      goal: { state: 'rolled-back' },
      question: 'Containers keep being killed mid-request. What is the fastest safe way to stop that, before you know the cause?',
      playbook: 'how-do-i-roll-back-a-deployment',
      command: 'kubectl rollout undo deployment/pantry-api',
    },
    {
      goal: { finding: 'cache-unbounded' },
      needs: { evidence: 'leak-metrics' },
      question: 'v2.15.0 added a search cache. What do the saved metrics say about it?',
      playbook: 'what-is-the-process-holding-in-memory',
      command: 'grep search_cache pantry-api-metrics.txt',
    },
  ],
  rootCauses: [
    {
      id: 'limit-too-low',
      label: '512Mi is too little memory for pantry-api under morning traffic.',
      contradictedBy: [
        {
          finding: 'memory-near-limit',
          why: 'Memory grows with each container’s uptime instead of levelling off at what the traffic needs. A bigger limit would only be reached later.',
        },
        {
          finding: 'release-adds-cache',
          why: 'v2.14.1 served the same traffic within the same limit until yesterday’s release.',
        },
      ],
    },
    {
      id: 'unbounded-cache',
      label: 'v2.15.0’s search cache has no size limit or expiry and is keyed per shopper, so it grows until the container exceeds 512Mi.',
      correct: true,
    },
    {
      id: 'node-memory',
      label: 'A node is short of memory and is evicting pantry-api pods.',
      contradictedBy: [
        {
          finding: 'oom-killed',
          why: 'Each container was OOMKilled for crossing its own 512Mi limit, on all three nodes. An evicted pod shows Evicted and is replaced, not restarted.',
        },
      ],
    },
    {
      id: 'slow-database',
      label: 'Slow PostgreSQL queries make requests pile up in memory.',
      contradictedBy: [
        {
          finding: 'cache-unbounded',
          why: 'The memory is held by 186,204 cached search results, not by waiting requests, and the cache never lets any go.',
        },
      ],
    },
    {
      id: 'liveness-probe',
      label: 'A failing liveness probe makes Kubernetes restart healthy containers.',
      contradictedBy: [
        {
          finding: 'oom-killed',
          why: 'The last state says OOMKilled with exit code 137: the kernel killed the process for its memory. A failed probe would show in the events as Unhealthy.',
        },
      ],
    },
  ],
  mitigations: [
    {
      id: 'rollback',
      label: 'Roll back pantry-api to v2.14.1',
      verdict: 'best',
      explanation:
        'v2.14.1 has no search cache and ran within 512Mi for days, so the kills stop for good within a minute. Save the leaking process’s metrics first: the rollback replaces it.',
    },
    {
      id: 'raise-limit',
      label: 'Raise the memory limit to 2Gi',
      verdict: 'works',
      explanation:
        'Each container now takes about four times as long to fill, so the kills come back later rather than never. It also needs a rollout, which replaces the leaking processes before you have measured them.',
    },
    {
      id: 'restart',
      label: 'Restart the pantry-api pods',
      verdict: 'works',
      explanation:
        'Fresh processes start with an empty cache, so the kills stop for about 40 minutes and then return. The restart also throws away the full heap you needed to measure.',
    },
    {
      id: 'flush-redis',
      label: 'Flush the Redis cache',
      verdict: 'no-effect',
      explanation:
        'The leak is in pantry-api’s own memory, not in Redis. Flushing Redis only slows every page while it refills.',
    },
    {
      id: 'delete',
      label: 'Delete the Deployment and redeploy it from scratch',
      verdict: 'harmful',
      explanation:
        'Every pod stops at once and the whole site goes down until the Deployment is restored, and the new pods run the same leaking release.',
    },
  ],
  postmortem: {
    summary:
      'Release v2.15.0 of pantry-api added a search result cache that never evicted anything. Containers were OOMKilled every 35 to 40 minutes for most of a morning, failing the requests they were serving.',
    impact:
      'From about 07:05 to 09:48 UTC each pantry-api container was killed 4 or 5 times. Each kill failed the requests in flight with 502, and searches slowed to over 2 seconds as memory filled. About 1% of requests failed.',
    timeline: [
      { at: 'Wed 17:40', event: 'CI rolls out v2.15.0 (revision 45), which caches product search results in memory.' },
      { at: '07:05', event: 'With morning traffic, the first container crosses 512Mi and is OOMKilled. Kubernetes restarts it.' },
      { at: '09:41', event: 'PantryApiRestarting fires after half an hour of repeated restarts. On-call is paged.' },
      { at: '09:46', event: 'On-call finds OOMKilled containers, memory growing with uptime and the cache in the latest release, and saves a leaking process’s metrics.' },
      { at: '09:48', event: 'On-call rolls back to v2.14.1. Memory levels off at about 140Mi.' },
      { at: '10:05', event: 'The alert resolves.' },
      { at: '10:30', event: 'The saved metrics show 186,204 cache entries, a 1% hit rate and no evictions. Root Cause confirmed.' },
    ],
    rootCause:
      'v2.15.0 cached search results in a Map in each process, keyed by session, query and page. Nothing ever removed an entry, and because the key includes the session almost no entry was read twice. Memory grew with every search until the container crossed its 512Mi limit and the kernel killed it.',
    resolution:
      'Rolled back to v2.14.1 at 09:48. The cache will return with a size limit and expiry, keyed by query and page only, and with its memory use watched in canary.',
    actionItems: [
      'Give every in-process cache a maximum size and an expiry, or keep shared caches in Redis.',
      'Alert on memory approaching the limit, not only on restarts, so a leak pages before it kills.',
      'Watch memory over a full day of traffic in canary: a leak shows as a slope, not a spike.',
      'Expose cache size and hit rate as metrics for every cache, as this one did. They made the cause plain.',
    ],
  },
  prevention: [
    'Bound every cache: a maximum size and an expiry. An unbounded Map in a long-lived process is a leak waiting for traffic.',
    'Choose cache keys that repeat. A key containing the session means each shopper fills their own entries, which almost nobody reads twice.',
    'Alert on memory against the limit and on its slope, so a leak is caught hours before the first kill, not after the third.',
    'Run a new release under real traffic for long enough to see slow trends. This leak took a night and a morning to kill anything.',
  ],
  links: {
    concepts: ['mitigate-then-investigate', 'investigating-by-hypothesis'],
    resources: ['k8s-assign-memory', 'nodejs-memory-diagnostics', 'gregg-memory-leaks', 'sre-troubleshooting'],
  },
})
