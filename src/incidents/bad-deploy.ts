import type { AccessLogLine, Dashboard, Deploy } from '../engine/types'
import { defineIncident } from '../engine/types'

// Bad Deploy: release v2.14.0 of pantry-api renamed a config key from PAYMENT_SERVICE_URL to
// PAYMENTS_URL, but the Deployment manifest still sets the old name. Health checks pass, so the
// rollout looked fine; every checkout fails with an Invalid URL error.
//
// Named states:
//   failing      v2.14.0 is live and checkouts fail (the start).
//   rolled-back  the Learner rolled back to v2.13.1; checkouts work; the v2.14.0 pods and their logs are gone.
//   outage       the Learner deleted or scaled away pantry-api; every request fails.

// ---------------------------------------------------------------------------------------------
// Pods

type Placement = { pod: string; node: string; nodeIp: string; ip: string; started: string; age: string }

const newPods: Placement[] = [
  { pod: 'pantry-api-6d8f9c7b54-7xk2p', node: 'node-b', nodeIp: '10.0.1.21', ip: '10.42.1.37', started: '14:02:14', age: '12m' },
  { pod: 'pantry-api-6d8f9c7b54-m4q9t', node: 'node-c', nodeIp: '10.0.1.22', ip: '10.42.2.19', started: '14:02:41', age: '12m' },
  { pod: 'pantry-api-6d8f9c7b54-zr8vn', node: 'node-a', nodeIp: '10.0.1.20', ip: '10.42.0.88', started: '14:03:09', age: '11m' },
]
const rolledBackPods: Placement[] = [
  { pod: 'pantry-api-84b7d5f9cd-h2k8w', node: 'node-a', nodeIp: '10.0.1.20', ip: '10.42.0.91', started: '14:15:12', age: '58s' },
  { pod: 'pantry-api-84b7d5f9cd-p9x4c', node: 'node-b', nodeIp: '10.0.1.21', ip: '10.42.1.40', started: '14:15:31', age: '39s' },
  { pod: 'pantry-api-84b7d5f9cd-t6m3j', node: 'node-c', nodeIp: '10.0.1.22', ip: '10.42.2.23', started: '14:15:49', age: '21s' },
]
const datastorePods = [
  { name: 'postgres-0', ip: '10.42.0.12', node: 'node-a' },
  { name: 'redis-7c9d5b8f6-hq2lw', ip: '10.42.2.7', node: 'node-c' },
]

const pad = (text: string, width: number) => text.padEnd(width)

function getPods(api: Placement[]): string {
  const rows = [
    ...api.map((p) => `${pad(p.pod, 30)}1/1     Running   0          ${p.age}`),
    `${pad('postgres-0', 30)}1/1     Running   0          41d`,
    `${pad('redis-7c9d5b8f6-hq2lw', 30)}1/1     Running   0          41d`,
  ]
  return [`${pad('NAME', 30)}READY   STATUS    RESTARTS   AGE`, ...rows].join('\n')
}

function getPodsWide(api: Placement[]): string {
  const rows = [
    ...api.map((p) => `${pad(p.pod, 30)}1/1     Running   0          ${pad(p.age, 6)}${pad(p.ip, 14)}${pad(p.node, 9)}<none>           <none>`),
    ...datastorePods.map((d) => `${pad(d.name, 30)}1/1     Running   0          41d   ${pad(d.ip, 14)}${pad(d.node, 9)}<none>           <none>`),
  ]
  return [`${pad('NAME', 30)}READY   STATUS    RESTARTS   AGE   IP            NODE     NOMINATED NODE   READINESS GATES`, ...rows].join('\n')
}

// ---------------------------------------------------------------------------------------------
// Application logs (what kubectl logs shows; they live only as long as the pod)

const checkoutError = (time: string, ms: number, id: string) =>
  `{"level":"error","time":"2026-11-14T${time}Z","pid":1,"reqId":"${id}","msg":"request failed","method":"POST","path":"/api/checkout","status":500,"ms":${ms},"err":{"type":"TypeError","code":"ERR_INVALID_URL","message":"Invalid URL","input":"undefined/v1/charges","stack":"TypeError: Invalid URL\\n    at new URL (node:internal/url:816:29)\\n    at createCharge (/app/src/payments/client.js:18:15)\\n    at checkout (/app/src/routes/checkout.js:42:24)"}}`

const ok = (time: string, method: string, path: string, ms: number, id: string, status = 200) =>
  `{"level":"info","time":"2026-11-14T${time}Z","pid":1,"reqId":"${id}","msg":"request completed","method":"${method}","path":"${path}","status":${status},"ms":${ms}}`

const failingLogs = [
  `{"level":"info","time":"2026-11-14T14:02:19.412Z","pid":1,"msg":"pantry-api v2.14.0 starting","node":"v22.11.0"}`,
  `{"level":"warn","time":"2026-11-14T14:02:19.418Z","pid":1,"msg":"config key not set","key":"PAYMENTS_URL"}`,
  `{"level":"info","time":"2026-11-14T14:02:19.502Z","pid":1,"msg":"connected to postgres","pool":10}`,
  `{"level":"info","time":"2026-11-14T14:02:19.517Z","pid":1,"msg":"connected to redis"}`,
  `{"level":"info","time":"2026-11-14T14:02:19.521Z","pid":1,"msg":"listening","port":8080}`,
  ok('14:02:24.207', 'GET', '/healthz', 1, 'r-0001'),
  ok('14:02:26.930', 'GET', '/api/products?category=produce', 27, 'r-0002'),
  checkoutError('14:02:31.448', 6, 'r-0003'),
  ok('14:02:33.016', 'GET', '/api/cart', 13, 'r-0004'),
  ok('14:13:41.207', 'GET', '/healthz', 1, 'r-81f2'),
  ok('14:13:41.880', 'GET', '/api/products?category=bakery', 23, 'r-81f3'),
  ok('14:13:42.415', 'GET', '/api/cart', 11, 'r-81f4'),
  checkoutError('14:13:43.002', 4, 'r-81f5'),
  ok('14:13:43.390', 'POST', '/api/cart/items', 17, 'r-81f6'),
  ok('14:13:44.118', 'GET', '/api/products/4411', 9, 'r-81f7'),
  ok('14:13:46.207', 'GET', '/healthz', 1, 'r-81f8'),
  checkoutError('14:13:46.731', 3, 'r-81f9'),
  ok('14:13:47.054', 'GET', '/api/products?category=dairy', 21, 'r-81fa'),
  ok('14:13:48.660', 'GET', '/api/cart', 12, 'r-81fb'),
  checkoutError('14:13:49.315', 5, 'r-81fc'),
  ok('14:13:50.022', 'GET', '/api/orders?limit=10', 31, 'r-81fd'),
  ok('14:13:51.207', 'GET', '/healthz', 1, 'r-81fe'),
  ok('14:13:51.774', 'POST', '/api/cart/items', 15, 'r-81ff'),
  checkoutError('14:13:52.118', 4, 'r-8200'),
  ok('14:13:53.409', 'GET', '/api/products/1207', 8, 'r-8201'),
  ok('14:13:54.950', 'GET', '/api/cart', 10, 'r-8202'),
  checkoutError('14:13:55.536', 3, 'r-8203'),
  ok('14:13:56.207', 'GET', '/healthz', 1, 'r-8204'),
  ok('14:13:57.311', 'GET', '/api/products?category=produce', 25, 'r-8205'),
].join('\n')

const rolledBackLogs = [
  `{"level":"info","time":"2026-11-14T14:15:16.204Z","pid":1,"msg":"pantry-api v2.13.1 starting","node":"v22.11.0"}`,
  `{"level":"info","time":"2026-11-14T14:15:16.291Z","pid":1,"msg":"connected to postgres","pool":10}`,
  `{"level":"info","time":"2026-11-14T14:15:16.305Z","pid":1,"msg":"connected to redis"}`,
  `{"level":"info","time":"2026-11-14T14:15:16.309Z","pid":1,"msg":"listening","port":8080}`,
  ok('14:15:21.207', 'GET', '/healthz', 1, 'r-0001'),
  ok('14:15:22.640', 'GET', '/api/products?category=bakery', 24, 'r-0002'),
  ok('14:15:24.018', 'POST', '/api/checkout', 212, 'r-0003'),
  ok('14:15:25.377', 'GET', '/api/cart', 12, 'r-0004'),
  ok('14:15:26.207', 'GET', '/healthz', 1, 'r-0005'),
  ok('14:15:27.902', 'POST', '/api/checkout', 198, 'r-0006'),
  ok('14:15:29.115', 'GET', '/api/orders?limit=10', 29, 'r-0007'),
  ok('14:15:31.207', 'GET', '/healthz', 1, 'r-0008'),
].join('\n')

// ---------------------------------------------------------------------------------------------
// Deployment, ReplicaSets and rollout history

const env = `      NODE_ENV:             production
      DATABASE_URL:         <set to the key 'url' in secret 'pantry-db'>  Optional: false
      REDIS_URL:            redis://redis:6379
      PAYMENT_SERVICE_URL:  http://payments.payments.svc.cluster.local`

const resourcesBlock = `    Limits:
      cpu:     1
      memory:  512Mi
    Requests:
      cpu:      250m
      memory:   256Mi
    Liveness:   http-get http://:8080/healthz delay=10s timeout=1s period=10s #success=1 #failure=3
    Readiness:  http-get http://:8080/healthz delay=5s timeout=1s period=5s #success=1 #failure=3`

function describeDeployment(o: { revision: number; version: string; newRs: string; oldRs: string; events: string }): string {
  return `Name:                   pantry-api
Namespace:              pantry
CreationTimestamp:      Thu, 16 Apr 2026 09:12:40 +0000
Labels:                 app=pantry-api
Annotations:            deployment.kubernetes.io/revision: ${o.revision}
                        kubernetes.io/change-cause: release ${o.version}
Selector:               app=pantry-api
Replicas:               3 desired | 3 updated | 3 total | 3 available | 0 unavailable
StrategyType:           RollingUpdate
MinReadySeconds:        0
RollingUpdateStrategy:  25% max unavailable, 25% max surge
Pod Template:
  Labels:  app=pantry-api
  Containers:
   api:
    Image:      registry.example.com/pantry/api:${o.version.slice(1)}
    Port:       8080/TCP
    Host Port:  0/TCP
${resourcesBlock}
    Environment:
${env}
    Mounts:                 <none>
  Volumes:                  <none>
Conditions:
  Type           Status  Reason
  ----           ------  ------
  Available      True    MinimumReplicasAvailable
  Progressing    True    NewReplicaSetAvailable
OldReplicaSets:  ${o.oldRs} (0/0 replicas created)
NewReplicaSet:   ${o.newRs} (3/3 replicas created)
Events:
  Type    Reason             Age   From                   Message
  ----    ------             ----  ----                   -------
${o.events}`
}

const rolloutEvents = (age1: string, age2: string, up: string, down: string) =>
  [
    `  Normal  ScalingReplicaSet  ${pad(age1, 6)}deployment-controller  Scaled up replica set ${up} to 1`,
    `  Normal  ScalingReplicaSet  ${pad(age1, 6)}deployment-controller  Scaled down replica set ${down} to 2 from 3`,
    `  Normal  ScalingReplicaSet  ${pad(age1, 6)}deployment-controller  Scaled up replica set ${up} to 2 from 1`,
    `  Normal  ScalingReplicaSet  ${pad(age2, 6)}deployment-controller  Scaled down replica set ${down} to 1 from 2`,
    `  Normal  ScalingReplicaSet  ${pad(age2, 6)}deployment-controller  Scaled up replica set ${up} to 3 from 2`,
    `  Normal  ScalingReplicaSet  ${pad(age2, 6)}deployment-controller  Scaled down replica set ${down} to 0 from 1`,
  ].join('\n')

const revision = (n: number, version: string, hash: string) => `deployment.apps/pantry-api with revision #${n}
Pod Template:
  Labels:	app=pantry-api
	pod-template-hash=${hash}
  Annotations:	kubernetes.io/change-cause: release ${version}
  Containers:
   api:
    Image:	registry.example.com/pantry/api:${version.slice(1)}
    Port:	8080/TCP
    Host Port:	0/TCP
    Limits:
      cpu:	1
      memory:	512Mi
    Requests:
      cpu:	250m
      memory:	256Mi
    Liveness:	http-get http://:8080/healthz delay=10s timeout=1s period=10s #success=1 #failure=3
    Readiness:	http-get http://:8080/healthz delay=5s timeout=1s period=5s #success=1 #failure=3
    Environment:
      NODE_ENV:	production
      DATABASE_URL:	<set to the key 'url' in secret 'pantry-db'>	Optional: false
      REDIS_URL:	redis://redis:6379
      PAYMENT_SERVICE_URL:	http://payments.payments.svc.cluster.local
    Mounts:	<none>
  Volumes:	<none>`

function describePod(p: Placement, version: string, hash: string): string {
  return `Name:             ${p.pod}
Namespace:        pantry
Priority:         0
Service Account:  pantry-api
Node:             ${p.node}/${p.nodeIp}
Start Time:       Sat, 14 Nov 2026 ${p.started} +0000
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
      Started:      Sat, 14 Nov 2026 ${p.started} +0000
    Ready:          True
    Restart Count:  0
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
  Type    Reason     Age   From               Message
  ----    ------     ----  ----               -------
  Normal  Scheduled  ${pad(p.age, 6)}default-scheduler  Successfully assigned pantry/${p.pod} to ${p.node}
  Normal  Pulled     ${pad(p.age, 6)}kubelet            Container image "registry.example.com/pantry/api:${version}" already present on machine
  Normal  Created    ${pad(p.age, 6)}kubelet            Created container api
  Normal  Started    ${pad(p.age, 6)}kubelet            Started container api`
}

// ---------------------------------------------------------------------------------------------
// Inside a pantry-api container

const containerEnv = `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
NODE_VERSION=22.11.0
NODE_ENV=production
DATABASE_URL=postgres://pantry:••••••@postgres:5432/pantry
REDIS_URL=redis://redis:6379
PAYMENT_SERVICE_URL=http://payments.payments.svc.cluster.local
PANTRY_API_SERVICE_HOST=10.43.18.204
PANTRY_API_SERVICE_PORT=8080
KUBERNETES_SERVICE_HOST=10.43.0.1
KUBERNETES_SERVICE_PORT=443
HOME=/root`

const paymentsClient = (key: string) => `'use strict'

const BASE_URL = process.env.${key}
const TIMEOUT_MS = 3000

async function createCharge({ orderId, amountCents, currency }) {
  // The charge endpoint lives under /v1 on the payments service.
  const url = new URL(\`\${BASE_URL}/v1/charges\`)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ orderId, amountCents, currency }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(\`payments responded \${res.status}\`)
  return res.json()
}

module.exports = { createCharge }`

// ---------------------------------------------------------------------------------------------
// Dashboard

const startMinute = 13 * 60 + 45
const label = (i: number) => {
  const m = startMinute + i
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
/** Gentle, repeatable wobble so graphs look measured rather than drawn with a ruler. */
const wobble = (i: number, size: number) => size * (Math.sin(i * 1.7) * 0.6 + Math.sin(i * 0.53 + 1) * 0.4)
const round = (n: number, places = 1) => Math.round(n * 10 ** places) / 10 ** places

const DEPLOY_AT = 17 // 14:02
const ACTION_AT = 30 // 14:15

type Phase = 'before' | 'broken' | 'recovered' | 'down'

function signals(phases: Phase[]): Dashboard['signals'] {
  const requests = phases.map((p, i) => round(p === 'down' ? 0 : 182 + wobble(i, 9), 0))
  const errors = phases.map((p, i) =>
    round(p === 'down' ? 100 : p === 'broken' ? 9.1 + wobble(i, 0.8) : 0.2 + Math.abs(wobble(i, 0.15)), 1),
  )
  const latency = phases.map((p, i) => round(p === 'down' ? 2 : 88 + wobble(i, 7) - (p === 'broken' ? 6 : 0), 0))
  const saturation = phases.map((p, i) => round(p === 'down' ? 0 : 24 + wobble(i, 2.5), 1))
  return { requests, errors, latency, saturation }
}

function timeline(length: number, phaseAt: (i: number) => Phase) {
  const phases = Array.from({ length }, (_, i) => phaseAt(i))
  return { minutes: phases.map((_, i) => label(i)), signals: signals(phases) }
}

const history: Deploy[] = [
  { revision: 42, version: 'v2.14.0', at: 'Today 14:02 UTC', by: 'ci: pipeline #1874' },
  { revision: 41, version: 'v2.13.1', at: 'Sun 8 Nov 10:41 UTC', by: 'ci: pipeline #1851' },
  { revision: 40, version: 'v2.13.0', at: 'Mon 26 Oct 15:20 UTC', by: 'ci: pipeline #1802' },
]

const access = (time: string, method: string, path: string, status: number, ms: number, upstream: string): AccessLogLine => ({
  time,
  method,
  path,
  status,
  ms,
  upstream,
})

const [a, b, c] = newPods.map((p) => `${p.ip}:8080`) as [string, string, string]
const [x, y, z] = rolledBackPods.map((p) => `${p.ip}:8080`) as [string, string, string]

const brokenTraffic: AccessLogLine[] = [
  access('14:13:41', 'GET', '/api/products?category=bakery', 200, 24, a),
  access('14:13:42', 'GET', '/api/cart', 200, 12, b),
  access('14:13:43', 'POST', '/api/checkout', 500, 5, c),
  access('14:13:43', 'POST', '/api/cart/items', 200, 18, a),
  access('14:13:44', 'GET', '/api/products/4411', 200, 10, b),
  access('14:13:46', 'POST', '/api/checkout', 500, 4, a),
  access('14:13:47', 'GET', '/api/products?category=dairy', 200, 22, c),
  access('14:13:48', 'GET', '/api/cart', 200, 13, b),
  access('14:13:49', 'POST', '/api/checkout', 500, 6, b),
  access('14:13:50', 'GET', '/api/orders?limit=10', 200, 32, c),
  access('14:13:51', 'POST', '/api/cart/items', 200, 16, a),
  access('14:13:52', 'POST', '/api/checkout', 500, 5, c),
  access('14:13:53', 'GET', '/api/products/1207', 200, 9, a),
  access('14:13:54', 'GET', '/api/cart', 200, 11, b),
  access('14:13:55', 'POST', '/api/checkout', 500, 4, b),
  access('14:13:57', 'GET', '/api/products?category=produce', 200, 26, c),
  access('14:13:58', 'GET', '/api/account', 401, 3, a),
  access('14:13:59', 'POST', '/api/checkout', 500, 5, a),
]

const recoveredTraffic: AccessLogLine[] = [
  access('14:19:02', 'GET', '/api/products?category=bakery', 200, 25, x),
  access('14:19:03', 'POST', '/api/checkout', 200, 214, y),
  access('14:19:04', 'GET', '/api/cart', 200, 12, z),
  access('14:19:05', 'POST', '/api/cart/items', 200, 17, x),
  access('14:19:06', 'POST', '/api/checkout', 200, 201, z),
  access('14:19:08', 'GET', '/api/orders?limit=10', 200, 30, y),
  access('14:19:09', 'GET', '/api/products/88', 200, 9, x),
  access('14:19:11', 'POST', '/api/checkout', 200, 189, x),
  access('14:19:12', 'GET', '/api/account', 401, 3, z),
]

const downTraffic: AccessLogLine[] = [
  access('14:16:30', 'GET', '/api/products?category=bakery', 503, 0, '-'),
  access('14:16:31', 'GET', '/api/cart', 503, 0, '-'),
  access('14:16:31', 'POST', '/api/checkout', 503, 0, '-'),
  access('14:16:32', 'GET', '/', 503, 0, '-'),
  access('14:16:33', 'POST', '/api/cart/items', 503, 0, '-'),
  access('14:16:34', 'GET', '/api/products/4411', 503, 0, '-'),
  access('14:16:35', 'GET', '/api/orders?limit=10', 503, 0, '-'),
]

const failingTimeline = timeline(30, (i) => (i < DEPLOY_AT ? 'before' : 'broken'))
const recoveredTimeline = timeline(36, (i) => (i < DEPLOY_AT ? 'before' : i <= ACTION_AT ? 'broken' : 'recovered'))
const downTimeline = timeline(33, (i) => (i < DEPLOY_AT ? 'before' : i <= ACTION_AT ? 'broken' : 'down'))

const dashboard = {
  failing: {
    alert: { status: 'firing', summary: 'pantry-api is returning server errors on about 9% of requests.' },
    ...failingTimeline,
    markers: [{ at: DEPLOY_AT, label: 'v2.14.0' }],
    deploys: history,
    logs: brokenTraffic,
  },
  'rolled-back': {
    alert: { status: 'resolved', summary: 'Resolved at 14:19: server errors back under 5% for 3 minutes.' },
    ...recoveredTimeline,
    markers: [
      { at: DEPLOY_AT, label: 'v2.14.0' },
      { at: ACTION_AT, label: 'rollback' },
    ],
    deploys: [{ revision: 43, version: 'v2.13.1', at: 'Today 14:15 UTC', by: 'you: kubectl rollout undo' }, ...history],
    logs: [...brokenTraffic.slice(-6), ...recoveredTraffic],
  },
  outage: {
    alert: { status: 'firing', summary: 'pantry-api has no running pods: nginx answers every request with 503.' },
    ...downTimeline,
    markers: [
      { at: DEPLOY_AT, label: 'v2.14.0' },
      { at: ACTION_AT, label: 'pantry-api removed' },
    ],
    deploys: history,
    logs: [...brokenTraffic.slice(-4), ...downTraffic],
  },
} satisfies Record<string, Dashboard>

// ---------------------------------------------------------------------------------------------

const findManifest = { finding: 'manifest-old-name', seenIn: 'PAYMENT_SERVICE_URL' } as const
const both = <T,>(value: T) => ({ failing: value, 'rolled-back': value })
const unavailable503 = `<html>
<head><title>503 Service Temporarily Unavailable</title></head>
<body>
<center><h1>503 Service Temporarily Unavailable</h1></center>
<hr><center>nginx</center>
</body>
</html>`

const rollbackMutation = {
  warning:
    'Roll pantry-api back to the previous revision (v2.13.1). Kubernetes replaces the v2.14.0 pods one at a time; when they terminate, their logs go with them.',
  to: 'rolled-back',
  destroys: ['api-logs'],
  consequence:
    'The v2.13.1 pods replace the v2.14.0 ones over the next minute. Checkout errors stop and the alert resolves. Users are safe; now find out why v2.14.0 failed.',
} as const

const outageMutation = (what: string) =>
  ({
    warning: `${what} Every pantry-api pod will terminate and nothing will replace them.`,
    to: 'outage',
    destroys: ['api-logs'],
    consequence:
      'pantry-api has no pods left. nginx answers every request with 503: the whole site is down, not just checkout. In a real Incident you would now be restoring the Deployment from source control under pressure. Restart the Incident to try a safer path.',
  }) as const

export const badDeploy = defineIncident({
  id: 'bad-deploy',
  title: 'Bad Deploy',
  difficulty: 1,
  namespace: 'pantry',
  alert: {
    name: 'PantryApiHighErrorRate',
    severity: 'page',
    condition: '5xx responses above 5% of requests for 5 minutes',
    startedAt: '14:09 UTC',
    summary: 'pantry-api is returning server errors on about 9% of requests.',
  },
  briefing:
    'You are on call for Pantry, a grocery-ordering service. Its HTTP API, pantry-api, runs on Kubernetes beside PostgreSQL and Redis, behind an nginx load balancer. Your kubectl context already points at the pantry namespace. You have just been paged.',
  states: ['failing', 'rolled-back', 'outage'],
  initialState: 'failing',
  findings: {
    'recent-rollout': {
      summary: 'Every pantry-api pod is about 12 minutes old and healthy: they were replaced shortly before the alert.',
    },
    'deploy-correlates': {
      summary: 'The latest rollout is revision 42, release v2.14.0, a few minutes before the alert fired.',
    },
    'checkout-fails': {
      summary: 'POST /api/checkout fails with TypeError Invalid URL: the payments address is "undefined".',
    },
    'payments-url-missing': {
      summary: 'At startup, v2.14.0 warns that the config key PAYMENTS_URL is not set.',
    },
    'manifest-old-name': {
      summary: 'The Deployment gives the container PAYMENT_SERVICE_URL; nothing sets PAYMENTS_URL.',
    },
  },
  evidence: {
    'api-logs': {
      summary: 'Logs from the v2.14.0 pods: the startup warning and the checkout errors.',
      lost: 'the v2.14.0 pods terminated and their logs went with them. Nothing in the cluster kept a copy.',
    },
  },
  resources: {
    failing: [
      ...newPods.map((p) => `pod/${p.pod}`),
      'pod/postgres-0',
      'pod/redis-7c9d5b8f6-hq2lw',
      'deployment/pantry-api',
      'deployment/redis',
    ],
    'rolled-back': [
      ...rolledBackPods.map((p) => `pod/${p.pod}`),
      'pod/postgres-0',
      'pod/redis-7c9d5b8f6-hq2lw',
      'deployment/pantry-api',
      'deployment/redis',
    ],
    outage: ['pod/postgres-0', 'pod/redis-7c9d5b8f6-hq2lw', 'deployment/redis'],
  },
  shellPodPrefix: 'pantry-api-',
  commands: [
    // --- Reading the cluster -----------------------------------------------------------------
    {
      match: ['kubectl get pods'],
      output: {
        failing: getPods(newPods),
        'rolled-back': getPods(rolledBackPods),
        outage: getPods([]),
      },
      reveals: [{ finding: 'recent-rollout', seenIn: '6d8f9c7b54' }],
    },
    {
      match: ['kubectl get pods -o wide'],
      output: { failing: getPodsWide(newPods), 'rolled-back': getPodsWide(rolledBackPods), outage: getPodsWide([]) },
      reveals: [{ finding: 'recent-rollout', seenIn: '6d8f9c7b54' }],
    },
    {
      match: ['kubectl get deployments'],
      output: {
        failing: `NAME         READY   UP-TO-DATE   AVAILABLE   AGE
pantry-api   3/3     3            3           212d
redis        1/1     1            1           212d`,
        'rolled-back': `NAME         READY   UP-TO-DATE   AVAILABLE   AGE
pantry-api   3/3     3            3           212d
redis        1/1     1            1           212d`,
        outage: `NAME    READY   UP-TO-DATE   AVAILABLE   AGE
redis   1/1     1            1           212d`,
      },
    },
    {
      match: ['kubectl get replicasets'],
      output: {
        failing: `NAME                    DESIRED   CURRENT   READY   AGE
pantry-api-6d8f9c7b54   3         3         3       12m
pantry-api-84b7d5f9cd   0         0         0       6d
pantry-api-5f7c9d8b6a   0         0         0       19d
redis-7c9d5b8f6         1         1         1       212d`,
        'rolled-back': `NAME                    DESIRED   CURRENT   READY   AGE
pantry-api-84b7d5f9cd   3         3         3       6d
pantry-api-6d8f9c7b54   0         0         0       13m
pantry-api-5f7c9d8b6a   0         0         0       19d
redis-7c9d5b8f6         1         1         1       212d`,
        outage: `NAME              DESIRED   CURRENT   READY   AGE
redis-7c9d5b8f6   1         1         1       212d`,
      },
      reveals: [{ finding: 'recent-rollout', seenIn: 'pantry-api-6d8f9c7b54   3' }],
    },
    {
      match: ['kubectl get services'],
      output: `NAME         TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
pantry-api   ClusterIP   10.43.18.204    <none>        8080/TCP   212d
postgres     ClusterIP   None            <none>        5432/TCP   212d
redis        ClusterIP   10.43.97.15     <none>        6379/TCP   212d`,
    },
    {
      match: ['kubectl get nodes'],
      output: `NAME     STATUS   ROLES           AGE    VERSION
node-a   Ready    control-plane   301d   v1.33.4
node-b   Ready    <none>          301d   v1.33.4
node-c   Ready    <none>          301d   v1.33.4`,
    },
    {
      match: ['kubectl get events', 'kubectl events', 'kubectl get events --sort-by=.lastTimestamp'],
      output: {
        failing: `LAST SEEN   TYPE     REASON              OBJECT                            MESSAGE
12m         Normal   ScalingReplicaSet   deployment/pantry-api             Scaled up replica set pantry-api-6d8f9c7b54 to 1
12m         Normal   Scheduled           pod/pantry-api-6d8f9c7b54-7xk2p   Successfully assigned pantry/pantry-api-6d8f9c7b54-7xk2p to node-b
12m         Normal   Started             pod/pantry-api-6d8f9c7b54-7xk2p   Started container api
12m         Normal   Killing             pod/pantry-api-84b7d5f9cd-q8w2d   Stopping container api
12m         Normal   Scheduled           pod/pantry-api-6d8f9c7b54-m4q9t   Successfully assigned pantry/pantry-api-6d8f9c7b54-m4q9t to node-c
12m         Normal   Started             pod/pantry-api-6d8f9c7b54-m4q9t   Started container api
11m         Normal   Killing             pod/pantry-api-84b7d5f9cd-l5n7x   Stopping container api
11m         Normal   Scheduled           pod/pantry-api-6d8f9c7b54-zr8vn   Successfully assigned pantry/pantry-api-6d8f9c7b54-zr8vn to node-a
11m         Normal   Started             pod/pantry-api-6d8f9c7b54-zr8vn   Started container api
11m         Normal   Killing             pod/pantry-api-84b7d5f9cd-c2v9k   Stopping container api`,
        'rolled-back': `LAST SEEN   TYPE     REASON              OBJECT                            MESSAGE
62s         Normal   DeploymentRollback  deployment/pantry-api             Rolled back deployment "pantry-api" to revision 41
62s         Normal   ScalingReplicaSet   deployment/pantry-api             Scaled up replica set pantry-api-84b7d5f9cd to 1 from 0
58s         Normal   Started             pod/pantry-api-84b7d5f9cd-h2k8w   Started container api
55s         Normal   Killing             pod/pantry-api-6d8f9c7b54-7xk2p   Stopping container api
39s         Normal   Started             pod/pantry-api-84b7d5f9cd-p9x4c   Started container api
36s         Normal   Killing             pod/pantry-api-6d8f9c7b54-m4q9t   Stopping container api
21s         Normal   Started             pod/pantry-api-84b7d5f9cd-t6m3j   Started container api
18s         Normal   Killing             pod/pantry-api-6d8f9c7b54-zr8vn   Stopping container api`,
        outage: `LAST SEEN   TYPE     REASON    OBJECT                            MESSAGE
48s         Normal   Killing   pod/pantry-api-6d8f9c7b54-7xk2p   Stopping container api
48s         Normal   Killing   pod/pantry-api-6d8f9c7b54-m4q9t   Stopping container api
48s         Normal   Killing   pod/pantry-api-6d8f9c7b54-zr8vn   Stopping container api`,
      },
      reveals: [{ finding: 'recent-rollout', seenIn: 'Successfully assigned pantry/pantry-api-6d8f9c7b54' }],
    },
    {
      match: ['kubectl top pods'],
      output: {
        failing: `NAME                          CPU(cores)   MEMORY(bytes)
pantry-api-6d8f9c7b54-7xk2p   46m          141Mi
pantry-api-6d8f9c7b54-m4q9t   51m          139Mi
pantry-api-6d8f9c7b54-zr8vn   44m          143Mi
postgres-0                    112m         486Mi
redis-7c9d5b8f6-hq2lw         9m           38Mi`,
        'rolled-back': `NAME                          CPU(cores)   MEMORY(bytes)
pantry-api-84b7d5f9cd-h2k8w   58m          133Mi
pantry-api-84b7d5f9cd-p9x4c   61m          131Mi
pantry-api-84b7d5f9cd-t6m3j   55m          128Mi
postgres-0                    119m         488Mi
redis-7c9d5b8f6-hq2lw         9m           38Mi`,
        outage: `NAME                    CPU(cores)   MEMORY(bytes)
postgres-0              31m          480Mi
redis-7c9d5b8f6-hq2lw   4m           38Mi`,
      },
    },
    {
      match: ['kubectl top nodes'],
      output: `NAME     CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)
node-a   410m         10%      2914Mi          37%
node-b   288m         7%       2201Mi          28%
node-c   301m         7%       2350Mi          30%`,
    },
    {
      match: ['kubectl rollout history deployment/pantry-api'],
      output: {
        failing: `deployment.apps/pantry-api
REVISION  CHANGE-CAUSE
40        release v2.13.0
41        release v2.13.1
42        release v2.14.0`,
        'rolled-back': `deployment.apps/pantry-api
REVISION  CHANGE-CAUSE
40        release v2.13.0
42        release v2.14.0
43        release v2.13.1`,
      },
      reveals: [{ finding: 'deploy-correlates', seenIn: '42        release v2.14.0' }],
    },
    {
      match: ['kubectl rollout history deployment/pantry-api --revision=42'],
      output: both(revision(42, 'v2.14.0', '6d8f9c7b54')),
      reveals: ['deploy-correlates', findManifest],
    },
    {
      match: ['kubectl rollout history deployment/pantry-api --revision=41'],
      output: { failing: revision(41, 'v2.13.1', '84b7d5f9cd') },
    },
    {
      match: ['kubectl rollout history deployment/pantry-api --revision=43'],
      output: { 'rolled-back': revision(43, 'v2.13.1', '84b7d5f9cd') },
    },
    {
      match: ['kubectl rollout status deployment/pantry-api'],
      output: both('deployment "pantry-api" successfully rolled out'),
    },
    {
      match: ['kubectl describe deployment/pantry-api'],
      output: {
        failing: describeDeployment({
          revision: 42,
          version: 'v2.14.0',
          newRs: 'pantry-api-6d8f9c7b54',
          oldRs: 'pantry-api-84b7d5f9cd',
          events: rolloutEvents('12m', '11m', 'pantry-api-6d8f9c7b54', 'pantry-api-84b7d5f9cd'),
        }),
        'rolled-back': describeDeployment({
          revision: 43,
          version: 'v2.13.1',
          newRs: 'pantry-api-84b7d5f9cd',
          oldRs: 'pantry-api-6d8f9c7b54',
          events: rolloutEvents('62s', '21s', 'pantry-api-84b7d5f9cd', 'pantry-api-6d8f9c7b54'),
        }),
      },
      reveals: [{ finding: 'deploy-correlates', seenIn: 'release v2.14.0' }, findManifest],
    },
    ...newPods.map((p) => ({
      match: [`kubectl describe pod/${p.pod}`],
      output: { failing: describePod(p, '2.14.0', '6d8f9c7b54') },
      reveals: [findManifest],
    })),
    ...rolledBackPods.map((p) => ({
      match: [`kubectl describe pod/${p.pod}`],
      output: { 'rolled-back': describePod(p, '2.13.1', '84b7d5f9cd') },
      reveals: [findManifest],
    })),
    {
      match: [
        'kubectl logs deployment/pantry-api',
        ...newPods.map((p) => `kubectl logs pod/${p.pod}`),
        ...rolledBackPods.map((p) => `kubectl logs pod/${p.pod}`),
      ],
      output: { failing: failingLogs, 'rolled-back': rolledBackLogs },
      evidence: 'api-logs',
      reveals: [
        { finding: 'checkout-fails', seenIn: 'ERR_INVALID_URL' },
        { finding: 'payments-url-missing', seenIn: '"key":"PAYMENTS_URL"' },
      ],
    },
    {
      match: ['kubectl logs pod/postgres-0'],
      output: `2026-11-14 13:58:02.114 UTC [61] LOG:  checkpoint starting: time
2026-11-14 13:58:09.871 UTC [61] LOG:  checkpoint complete: wrote 412 buffers (2.5%); 0 WAL file(s) added, 0 removed, 1 recycled; write=7.601 s, sync=0.044 s, total=7.758 s
2026-11-14 14:03:02.205 UTC [61] LOG:  checkpoint starting: time
2026-11-14 14:03:08.990 UTC [61] LOG:  checkpoint complete: wrote 389 buffers (2.4%); 0 WAL file(s) added, 0 removed, 1 recycled; write=6.702 s, sync=0.031 s, total=6.785 s
2026-11-14 14:08:02.311 UTC [61] LOG:  checkpoint starting: time
2026-11-14 14:08:09.004 UTC [61] LOG:  checkpoint complete: wrote 401 buffers (2.4%); 0 WAL file(s) added, 0 removed, 1 recycled; write=6.611 s, sync=0.029 s, total=6.693 s`,
    },
    {
      match: ['kubectl logs pod/redis-7c9d5b8f6-hq2lw', 'kubectl logs deployment/redis'],
      output: `1:M 14 Nov 2026 13:31:07.042 * 100 changes in 300 seconds. Saving...
1:M 14 Nov 2026 13:31:07.044 * Background saving started by pid 2210
2210:C 14 Nov 2026 13:31:07.081 * DB saved on disk
1:M 14 Nov 2026 13:31:07.145 * Background saving terminated with success
1:M 14 Nov 2026 14:06:12.300 * 100 changes in 300 seconds. Saving...
1:M 14 Nov 2026 14:06:12.302 * Background saving started by pid 2391
2391:C 14 Nov 2026 14:06:12.337 * DB saved on disk
1:M 14 Nov 2026 14:06:12.403 * Background saving terminated with success`,
    },
    {
      match: ['curl https://pantry.example.com/healthz', 'curl -s https://pantry.example.com/healthz'],
      output: {
        failing: '{"status":"ok","version":"2.14.0"}',
        'rolled-back': '{"status":"ok","version":"2.13.1"}',
        outage: unavailable503,
      },
    },

    // --- Changing the cluster ------------------------------------------------------------------
    {
      match: ['kubectl rollout undo deployment/pantry-api', 'kubectl rollout undo deployment/pantry-api --to-revision=41'],
      output: { failing: 'deployment.apps/pantry-api rolled back' },
      mutating: rollbackMutation,
    },
    {
      match: ['kubectl rollout restart deployment/pantry-api'],
      output: { failing: 'deployment.apps/pantry-api restarted' },
      mutating: {
        warning: 'Restart every pantry-api pod, one at a time, with the same release and configuration.',
        to: 'failing',
        consequence:
          'New pods start with the same release and the same configuration, and checkouts keep failing. A restart cannot fix what a restart did not cause.',
      },
    },
    ...newPods.map((p) => ({
      match: [`kubectl delete pod/${p.pod}`],
      output: { failing: `pod "${p.pod}" deleted` },
      mutating: {
        warning: `Delete ${p.pod}. Its ReplicaSet will start a replacement from the same template.`,
        to: 'failing' as const,
        consequence:
          'The ReplicaSet started an identical pod with the same release and configuration. Checkouts keep failing.',
      },
    })),
    {
      match: ['kubectl delete deployment/pantry-api'],
      output: both('deployment.apps "pantry-api" deleted'),
      mutating: outageMutation('Delete the pantry-api Deployment.'),
    },
    {
      match: ['kubectl scale deployment/pantry-api --replicas=0'],
      output: both('deployment.apps/pantry-api scaled'),
      mutating: outageMutation('Scale pantry-api to zero replicas.'),
    },

    // --- Inside a pantry-api container ---------------------------------------------------------
    { match: ['env', 'printenv'], where: 'container', output: both(containerEnv), reveals: [findManifest] },
    {
      match: ['ps aux'],
      where: 'container',
      output: both(`USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  4.1  2.7 1187464 144628 ?     Ssl  14:02   0:31 node src/server.js
root          47  0.0  0.0   2576   924 pts/0    Ss   14:14   0:00 sh
root          53  0.0  0.0   7064  1580 pts/0    R+   14:14   0:00 ps aux`),
    },
    { match: ['ls'], where: 'container', output: both('node_modules  package-lock.json  package.json  src') },
    { match: ['ls src'], where: 'container', output: both('config.js  db.js  payments  routes  server.js') },
    { match: ['ls src/payments'], where: 'container', output: both('client.js') },
    {
      match: ['cat package.json'],
      where: 'container',
      output: {
        failing: `{
  "name": "pantry-api",
  "version": "2.14.0",
  "private": true,
  "main": "src/server.js",
  "engines": { "node": ">=22" }
}`,
        'rolled-back': `{
  "name": "pantry-api",
  "version": "2.13.1",
  "private": true,
  "main": "src/server.js",
  "engines": { "node": ">=22" }
}`,
      },
    },
    {
      match: ['cat src/payments/client.js'],
      where: 'container',
      output: { failing: paymentsClient('PAYMENTS_URL'), 'rolled-back': paymentsClient('PAYMENT_SERVICE_URL') },
    },
    {
      match: ['curl localhost:8080/healthz', 'curl -s localhost:8080/healthz', 'curl http://localhost:8080/healthz', 'curl -s http://localhost:8080/healthz'],
      where: 'container',
      output: { failing: '{"status":"ok","version":"2.14.0"}', 'rolled-back': '{"status":"ok","version":"2.13.1"}' },
    },
    {
      match: ['df -h'],
      where: 'container',
      output: both(`Filesystem      Size  Used Avail Use% Mounted on
overlay          78G   31G   44G  42% /
tmpfs            64M     0   64M   0% /dev
/dev/nvme0n1p1   78G   31G   44G  42% /etc/hosts
shm              64M     0   64M   0% /dev/shm`),
    },
  ],
  dashboard,
  expertPath: [
    {
      command: 'kubectl get pods',
      why: 'Start broad: are the pods running, restarting, or new?',
      reaches: ['recent-rollout'],
    },
    {
      command: 'kubectl rollout history deployment/pantry-api',
      why: 'Young, healthy pods point at a change. What changed?',
      reaches: ['deploy-correlates'],
    },
    {
      command: 'kubectl logs deployment/pantry-api --tail=20',
      why: 'The release lines up with the alert. What errors does the new version print?',
      reaches: ['checkout-fails'],
    },
    {
      command: 'kubectl logs deployment/pantry-api > pantry-api-v2.14.0.log',
      why: 'Checkouts are failing and a rollback will replace these pods. Save their logs before they disappear.',
    },
    {
      command: 'kubectl rollout undo deployment/pantry-api',
      why: 'Stop the harm: roll back to v2.13.1. The evidence is saved, so investigation can continue afterwards.',
    },
    {
      command: 'grep -i warn pantry-api-v2.14.0.log',
      why: 'An "undefined" address smells like missing configuration. Did the service complain about its configuration when it started?',
      reaches: ['payments-url-missing'],
    },
    {
      command: 'kubectl rollout history deployment/pantry-api --revision=42',
      why: 'What configuration did the Deployment give the v2.14.0 containers?',
      reaches: ['manifest-old-name'],
    },
  ],
})
