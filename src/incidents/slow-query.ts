import type { AccessLogLine, Dashboard, Deploy } from '../engine/types'
import { defineIncident } from '../engine/types'
import { access, clock, pad, round, wobble } from './build'

// Slow Query: release v2.16.0 of pantry-api ran migration 0042, which dropped indexes a cleanup
// script had listed as unused. One of them, orders_customer_id_idx, serves the order-history lookup
// every account page makes. Without it PostgreSQL reads all 4.2 million orders for each lookup, its
// CPU saturates, every query queues behind those scans and the whole API slows down. Rolling back
// pantry-api does not help: kubectl rollout undo restores code, not the database.
//
// Named states:
//   slow         v2.16.0 is live and the index is gone (the start).
//   rolled-back  the Learner rolled pantry-api back to v2.15.1; the index is still gone, so nothing improves.
//   indexed      the Learner recreated the index; the lookups take milliseconds again.
//   rolled-back-indexed  the Learner rolled back first, then recreated the index: fast again, on v2.15.1.

// ---------------------------------------------------------------------------------------------
// Pods

const slowPods = [
  { pod: 'pantry-api-9d7c5f8b42-fx4kd', node: 'node-a', ip: '10.42.0.70' },
  { pod: 'pantry-api-9d7c5f8b42-lq8wm', node: 'node-b', ip: '10.42.1.82' },
  { pod: 'pantry-api-9d7c5f8b42-v6tzn', node: 'node-c', ip: '10.42.2.65' },
]
const rolledBackPods = [
  { pod: 'pantry-api-6f8b7d9c55-hp2xr', node: 'node-a', ip: '10.42.0.74' },
  { pod: 'pantry-api-6f8b7d9c55-m9kcw', node: 'node-b', ip: '10.42.1.85' },
  { pod: 'pantry-api-6f8b7d9c55-s4bfz', node: 'node-c', ip: '10.42.2.69' },
]

function getPods(api: { pod: string }[], age: string): string {
  const rows = [
    ...api.map((p) => `${pad(p.pod, 30)}1/1     Running   0          ${age}`),
    `${pad('postgres-0', 30)}1/1     Running   0          51d`,
    `${pad('redis-7c9d5b8f6-hq2lw', 30)}1/1     Running   0          51d`,
  ]
  return [`${pad('NAME', 30)}READY   STATUS    RESTARTS   AGE`, ...rows].join('\n')
}

function topPods(api: { pod: string }[], o: { apiCpu: string[]; dbCpu: string; dbMemory: string }): string {
  const rows = [
    ...api.map((p, i) => `${pad(p.pod, 30)}${pad(o.apiCpu[i]!, 13)}${['152Mi', '149Mi', '155Mi'][i]}`),
    `${pad('postgres-0', 30)}${pad(o.dbCpu, 13)}${o.dbMemory}`,
    `${pad('redis-7c9d5b8f6-hq2lw', 30)}${pad('12m', 13)}41Mi`,
  ]
  return [`${pad('NAME', 30)}CPU(cores)   MEMORY(bytes)`, ...rows].join('\n')
}

const describePostgres = `Name:             postgres-0
Namespace:        pantry
Node:             node-a/10.0.1.20
Labels:           app=postgres
Status:           Running
IP:               10.42.0.12
Controlled By:    StatefulSet/postgres
Containers:
  postgres:
    Image:          postgres:17.6
    Port:           5432/TCP
    Args:
      -c
      log_min_duration_statement=500ms
      -c
      log_statement=ddl
    State:          Running
      Started:      Sat, 03 Oct 2026 08:14:52 +0000
    Ready:          True
    Restart Count:  0
    Limits:
      cpu:     2
      memory:  4Gi
    Requests:
      cpu:      1
      memory:   2Gi
Events:           <none>`

// ---------------------------------------------------------------------------------------------
// PostgreSQL

/** The order-history lookup every account page makes. It has not changed in months. */
const ORDERS_QUERY = 'SELECT id, status, total_cents, created_at FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 10'
const PRODUCTS_QUERY = 'SELECT id, name, price_cents FROM products WHERE category = $1 ORDER BY name LIMIT 24'

const pgLine = (time: string, pid: number, text: string) => `2026-11-24 ${time} UTC [${pid}] ${text}`

const slowLogLines = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => {
    const second = from + i * 2
    const time = `11:${String(38 + Math.floor(second / 60)).padStart(2, '0')}:${String(second % 60).padStart(2, '0')}.${String(204 + i * 37).slice(-3)}`
    const pid = 48211 + ((i * 7) % 23)
    if (i % 5 === 4) {
      return pgLine(time, pid, `LOG:  duration: ${round(780 + wobble(i, 90), 3).toFixed(3)} ms  execute <unnamed>: ${PRODUCTS_QUERY}`)
    }
    return [
      pgLine(time, pid, `LOG:  duration: ${round(2400 + wobble(i, 260), 3).toFixed(3)} ms  execute <unnamed>: ${ORDERS_QUERY}`),
      pgLine(time, pid, `DETAIL:  parameters: $1 = '${48213 + i * 1171}'`),
    ].join('\n')
  }).join('\n')

const checkpoints = [
  pgLine('11:13:02.114', 61, 'LOG:  checkpoint starting: time'),
  pgLine('11:13:09.871', 61, 'LOG:  checkpoint complete: wrote 412 buffers (2.5%); 0 WAL file(s) added, 0 removed, 1 recycled; write=7.601 s, sync=0.044 s, total=7.758 s'),
]
const migrationLines = [
  pgLine('11:20:14.302', 51877, 'LOG:  statement: DROP INDEX IF EXISTS orders_customer_id_idx'),
  pgLine('11:20:14.355', 51877, 'LOG:  statement: DROP INDEX IF EXISTS products_legacy_sku_idx'),
  pgLine('11:20:14.391', 51877, 'LOG:  statement: DROP INDEX IF EXISTS customers_referrer_idx'),
]
const slowPostgresLogs = [...checkpoints, ...migrationLines, slowLogLines(0, 24)].join('\n')
const indexedPostgresLogs = [
  ...checkpoints,
  ...migrationLines,
  slowLogLines(0, 24),
  pgLine('11:40:02.117', 52240, 'LOG:  statement: CREATE INDEX CONCURRENTLY orders_customer_id_idx ON orders (customer_id)'),
  pgLine('11:40:40.928', 52240, 'LOG:  duration: 38811.204 ms'),
  pgLine('11:43:02.311', 61, 'LOG:  checkpoint starting: time'),
  pgLine('11:43:09.004', 61, 'LOG:  checkpoint complete: wrote 1388 buffers (8.5%); 0 WAL file(s) added, 0 removed, 3 recycled; write=6.611 s, sync=0.029 s, total=6.693 s'),
].join('\n')

const ACTIVITY_QUERY = "SELECT pid, now() - query_start AS runtime, wait_event, query FROM pg_stat_activity WHERE state = 'active'"

function activity(rows: { pid: number; runtime: string; wait: string; query: string }[]): string {
  const width = Math.max(5, ...rows.map((r) => r.query.length))
  return [
    `  pid  |     runtime     |  wait_event  | ${pad('query', width)}`,
    `-------+-----------------+--------------+-${'-'.repeat(width)}`,
    ...rows.map((r) => ` ${r.pid} | ${r.runtime} | ${pad(r.wait, 12)} | ${r.query}`),
    `(${rows.length} ${rows.length === 1 ? 'row' : 'rows'})`,
  ].join('\n')
}

/** An interval as PostgreSQL prints it, to the microsecond: 00:00:02.871544. */
const runtime = (seconds: number, i: number) => `00:00:0${seconds.toFixed(3)}${String(137 + i * 212).slice(-3)}`
/** The pg_stat_activity query itself, which is always among the active ones. */
const thisQuery = { wait: '', query: ACTIVITY_QUERY }
const pileUp = activity([
  ...[2.871, 2.644, 2.512, 2.390, 2.207, 2.118, 1.904, 1.772, 1.561, 1.309, 1.122, 0.947, 0.733].map((s, i) => ({
    pid: 48211 + i * 3,
    runtime: runtime(s, i),
    wait: i % 4 === 1 ? 'DataFileRead' : '',
    query: ORDERS_QUERY,
  })),
  ...[0.812, 0.604, 0.418].map((s, i) => ({ pid: 48260 + i, runtime: runtime(s, i + 13), wait: '', query: PRODUCTS_QUERY })),
  { pid: 52240, runtime: '00:00:00', ...thisQuery },
])
const quietActivity = activity([
  { pid: 48214, runtime: '00:00:00.001804', wait: 'ClientRead', query: ORDERS_QUERY },
  { pid: 52240, runtime: '00:00:00', ...thisQuery },
])

const describeOrders = (indexed: boolean) => `                                       Table "public.orders"
   Column    |           Type           | Collation | Nullable |              Default
-------------+--------------------------+-----------+----------+------------------------------------
 id          | bigint                   |           | not null | nextval('orders_id_seq'::regclass)
 customer_id | bigint                   |           | not null |
 status      | text                     |           | not null |
 total_cents | integer                  |           | not null |
 created_at  | timestamp with time zone |           | not null | now()
Indexes:
    "orders_pkey" PRIMARY KEY, btree (id)
    "orders_created_at_idx" btree (created_at)${indexed ? '\n    "orders_customer_id_idx" btree (customer_id)' : ''}
Foreign-key constraints:
    "orders_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES customers(id)`

const EXPLAIN_QUERY = 'EXPLAIN ANALYZE SELECT id, status, total_cents, created_at FROM orders WHERE customer_id = 48213 ORDER BY created_at DESC LIMIT 10'

const seqScanPlan = `                                                          QUERY PLAN
------------------------------------------------------------------------------------------------------------------------------
 Limit  (cost=98721.40..98722.57 rows=10 width=32) (actual time=2391.064..2398.120 rows=10 loops=1)
   ->  Gather Merge  (cost=98721.40..98724.15 rows=24 width=32) (actual time=2391.062..2398.115 rows=10 loops=1)
         Workers Planned: 2
         Workers Launched: 2
         ->  Sort  (cost=97721.38..97721.41 rows=12 width=32) (actual time=2384.502..2384.504 rows=8 loops=3)
               Sort Key: created_at DESC
               Sort Method: quicksort  Memory: 25kB
               ->  Parallel Seq Scan on orders  (cost=0.00..97721.17 rows=12 width=32) (actual time=161.233..2384.388 rows=11 loops=3)
                     Filter: (customer_id = 48213)
                     Rows Removed by Filter: 1399986
 Planning Time: 0.118 ms
 Execution Time: 2398.187 ms
(12 rows)`

const indexScanPlan = `                                                          QUERY PLAN
------------------------------------------------------------------------------------------------------------------------------
 Limit  (cost=37.21..37.24 rows=10 width=32) (actual time=0.071..0.074 rows=10 loops=1)
   ->  Sort  (cost=37.21..37.29 rows=31 width=32) (actual time=0.070..0.071 rows=10 loops=1)
         Sort Key: created_at DESC
         Sort Method: quicksort  Memory: 25kB
         ->  Index Scan using orders_customer_id_idx on orders  (cost=0.43..36.54 rows=31 width=32) (actual time=0.021..0.052 rows=33 loops=1)
               Index Cond: (customer_id = 48213)
 Planning Time: 0.131 ms
 Execution Time: 0.093 ms
(8 rows)`

/** A statement as people type it: with or without a closing semicolon, in capitals or not. */
const sqlSpellings = (sql: string) => [sql, `${sql};`, sql.toLowerCase(), `${sql.toLowerCase()};`]
/** Running a statement with psql, as the pantry role, with or without naming the database. */
const psql = (sql: string) =>
  sqlSpellings(sql).flatMap((s) => [`psql -U pantry -c "${s}"`, `psql -U pantry -d pantry -c "${s}"`])

const CREATE_INDEX = 'CREATE INDEX CONCURRENTLY orders_customer_id_idx ON orders (customer_id)'
const CREATE_INDEX_LOCKING = 'CREATE INDEX orders_customer_id_idx ON orders (customer_id)'

// ---------------------------------------------------------------------------------------------
// pantry-api

const apiLine = (time: string, level: string, msg: string, extra: string) =>
  `{"level":"${level}","time":"2026-11-24T${time}Z","pid":1,"msg":"${msg}"${extra}}`
const request = (time: string, method: string, path: string, ms: number, status = 200) =>
  apiLine(time, 'info', 'request completed', `,"method":"${method}","path":"${path}","status":${status},"ms":${ms}`)
const poolWait = (time: string, ms: number) => apiLine(time, 'warn', 'waiting for a database connection', `,"waitMs":${ms},"pool":10,"waiting":14`)

/** A pod's first log lines. `at` is the minute it started, such as "11:20". */
const startup = (at: string, version: string, migrations: boolean) =>
  [
    apiLine(`${at}:12.408`, 'info', `pantry-api ${version} starting`, ',"node":"v22.11.0"'),
    apiLine(`${at}:12.502`, 'info', 'connected to postgres', ',"pool":10'),
    ...(migrations
      ? [
          apiLine(`${at}:12.611`, 'info', 'running migration', ',"name":"0042_drop_unused_indexes"'),
          apiLine(`${at}:14.302`, 'info', 'migration statement', ',"sql":"DROP INDEX IF EXISTS orders_customer_id_idx"'),
          apiLine(`${at}:14.355`, 'info', 'migration statement', ',"sql":"DROP INDEX IF EXISTS products_legacy_sku_idx"'),
          apiLine(`${at}:14.391`, 'info', 'migration statement', ',"sql":"DROP INDEX IF EXISTS customers_referrer_idx"'),
          apiLine(`${at}:14.402`, 'info', 'migrations complete', ',"applied":1'),
        ]
      : [apiLine(`${at}:12.611`, 'info', 'migrations up to date', '')]),
    apiLine(`${at}:14.517`, 'info', 'listening', ',"port":8080'),
  ]

/** Requests in one busy minute, such as "11:39": every one that touches the database waits. */
const busyRequests = (minute: string) => [
  request(`${minute}:01.207`, 'GET', '/healthz', 1),
  request(`${minute}:01.884`, 'GET', '/api/orders?limit=10', 2611),
  poolWait(`${minute}:02.031`, 1840),
  request(`${minute}:02.415`, 'GET', '/api/products?category=bakery', 1312),
  request(`${minute}:03.390`, 'GET', '/api/orders?limit=10', 2874),
  request(`${minute}:04.118`, 'GET', '/api/cart', 9),
  poolWait(`${minute}:04.660`, 2210),
  request(`${minute}:05.054`, 'GET', '/api/products?category=dairy', 1588),
  request(`${minute}:06.207`, 'GET', '/healthz', 1),
  request(`${minute}:06.731`, 'POST', '/api/checkout', 2240),
  request(`${minute}:07.311`, 'GET', '/api/orders?limit=10', 3102),
]

const slowApiLogs = (migrations: boolean) => [...startup('11:20', 'v2.16.0', migrations), ...busyRequests('11:39')].join('\n')

// ---------------------------------------------------------------------------------------------
// Dashboard: one sample a minute from 11:00. The release goes out at 11:20.

const label = clock('11:00')
const RELEASE_AT = 20
const NOW = 40 // 11:40: the first sample after the Learner acts

type Phase = 'before' | 'slow' | 'building' | 'fast'

function signals(phases: Phase[]): Dashboard['signals'] {
  // The order-history scans pile up over a few minutes as more shoppers open their account pages.
  const load = (i: number) => Math.min(1, Math.max(0, (i - RELEASE_AT + 1) / 5))
  const requests = phases.map((_, i) => round(176 + wobble(i, 8), 0))
  const errors = phases.map((p, i) => round(p === 'slow' || p === 'building' ? 0.2 + 2.3 * load(i) + wobble(i, 0.3) : 0.2 + Math.abs(wobble(i, 0.12)), 1))
  const latency = phases.map((p, i) =>
    round(p === 'slow' ? 90 + 2550 * load(i) + wobble(i, 140) : p === 'building' ? 1900 + wobble(i, 120) : 90 + wobble(i, 7), 0),
  )
  const saturation = phases.map((p, i) => round(p === 'slow' || p === 'building' ? 34 + 65 * load(i) + Math.abs(wobble(i, 0.8)) : 34 + wobble(i, 3), 0))
  return { requests, errors, latency, saturation: saturation.map((s) => Math.min(s, 100)) }
}

function timeline(length: number, phaseAt: (i: number) => Phase) {
  const phases = Array.from({ length }, (_, i) => phaseAt(i))
  return { minutes: phases.map((_, i) => label(i)), signals: signals(phases) }
}

const slowAt = (i: number): Phase => (i < RELEASE_AT ? 'before' : 'slow')

const history: Deploy[] = [
  { revision: 48, version: 'v2.16.0', at: 'Today 11:20 UTC', by: 'ci: pipeline #1951' },
  { revision: 47, version: 'v2.15.1', at: 'Fri 20 Nov 15:02 UTC', by: 'ci: pipeline #1922' },
  { revision: 46, version: 'v2.14.1', at: 'Thu 19 Nov 09:48 UTC', by: 'on-call: kubectl rollout undo' },
]

const [fx4kd, lq8wm, v6tzn] = slowPods.map((p) => `${p.ip}:8080`) as [string, string, string]

const slowTraffic: AccessLogLine[] = [
  access('11:39:01', 'GET', '/api/orders?limit=10', 200, 2614, fx4kd),
  access('11:39:02', 'GET', '/api/products?category=bakery', 200, 1315, lq8wm),
  access('11:39:03', 'GET', '/api/orders?limit=10', 200, 2877, v6tzn),
  access('11:39:04', 'GET', '/api/cart', 200, 11, fx4kd),
  access('11:39:05', 'GET', '/api/products?category=dairy', 200, 1590, lq8wm),
  access('11:39:06', 'POST', '/api/checkout', 200, 2243, v6tzn),
  access('11:39:07', 'GET', '/api/orders?limit=10', 200, 3105, fx4kd),
  access('11:39:08', 'GET', '/api/orders?limit=10', 504, 5001, lq8wm),
  access('11:39:09', 'GET', '/api/products/4411', 200, 702, v6tzn),
  access('11:39:11', 'GET', '/api/account', 401, 3, fx4kd),
  access('11:39:12', 'GET', '/api/orders?limit=10', 504, 5000, v6tzn),
  access('11:39:13', 'GET', '/api/products?category=produce', 200, 1402, fx4kd),
]

const fastTraffic: AccessLogLine[] = [
  access('11:45:02', 'GET', '/api/orders?limit=10', 200, 14, fx4kd),
  access('11:45:03', 'GET', '/api/products?category=bakery', 200, 26, lq8wm),
  access('11:45:04', 'POST', '/api/checkout', 200, 208, v6tzn),
  access('11:45:06', 'GET', '/api/orders?limit=10', 200, 12, fx4kd),
  access('11:45:07', 'GET', '/api/cart', 200, 10, lq8wm),
]

const rolledBackDeploy: Deploy = { revision: 49, version: 'v2.15.1', at: 'Today 11:40 UTC', by: 'you: kubectl rollout undo' }
const saturationOf = 'database CPU of limit'
const stillSlow = 'pantry-api is slow: 95th percentile latency is 2.6 seconds.'

const dashboard = {
  slow: {
    alert: { status: 'firing', summary: stillSlow },
    saturationOf,
    ...timeline(NOW, slowAt),
    markers: [{ at: RELEASE_AT, label: 'v2.16.0' }],
    deploys: history,
    logs: slowTraffic,
  },
  'rolled-back': {
    alert: { status: 'firing', summary: 'Still slow after the rollback: 95th percentile latency is 2.7 seconds.' },
    saturationOf,
    ...timeline(NOW + 6, slowAt),
    markers: [
      { at: RELEASE_AT, label: 'v2.16.0' },
      { at: NOW, label: 'rollback' },
    ],
    deploys: [rolledBackDeploy, ...history],
    logs: slowTraffic,
  },
  indexed: {
    alert: { status: 'resolved', summary: 'Resolved at 11:46: 95th percentile latency under 1 second for 5 minutes.' },
    saturationOf,
    ...timeline(NOW + 6, (i) => (i < NOW ? slowAt(i) : i === NOW ? 'building' : 'fast')),
    markers: [
      { at: RELEASE_AT, label: 'v2.16.0' },
      { at: NOW, label: 'index created' },
    ],
    deploys: history,
    logs: [...slowTraffic.slice(-4), ...fastTraffic],
  },
  'rolled-back-indexed': {
    alert: { status: 'resolved', summary: 'Resolved at 11:50: 95th percentile latency under 1 second for 5 minutes.' },
    saturationOf,
    ...timeline(NOW + 9, (i) => (i < NOW + 3 ? slowAt(i) : i === NOW + 3 ? 'building' : 'fast')),
    markers: [
      { at: RELEASE_AT, label: 'v2.16.0' },
      { at: NOW, label: 'rollback' },
      { at: NOW + 3, label: 'index created' },
    ],
    deploys: [rolledBackDeploy, ...history],
    logs: [...slowTraffic.slice(-4), ...fastTraffic],
  },
} satisfies Record<string, Dashboard>

// ---------------------------------------------------------------------------------------------

// Two things vary across the named states: which release pantry-api runs, and whether the index exists.
/** Output that depends on the release: v2.16.0 unless the Learner rolled back to v2.15.1. */
const byRelease = <T,>(v216: T, v215: T) => ({ slow: v216, indexed: v216, 'rolled-back': v215, 'rolled-back-indexed': v215 })
/** Output that depends on the database: the index missing, or rebuilt. */
const byIndex = <T,>(missing: T, rebuilt: T) => ({ slow: missing, 'rolled-back': missing, indexed: rebuilt, 'rolled-back-indexed': rebuilt })

const rolledBackApiLogs = [...startup('11:40', 'v2.15.1', false), ...busyRequests('11:41')].join('\n')

const rolloutHistory = (rolledBack: boolean) => `deployment.apps/pantry-api
REVISION  CHANGE-CAUSE
46        release v2.14.1
${rolledBack ? '' : '47        release v2.15.1\n'}48        release v2.16.0: migration 0042 drops unused indexes${rolledBack ? '\n49        release v2.15.1' : ''}`

/** Building the index, from either named state where it is missing, to the matching state where it exists. */
const createIndex = (sql: string, effect: { warning: string; consequence: string }) =>
  (
    [
      ['slow', 'indexed'],
      ['rolled-back', 'rolled-back-indexed'],
    ] as const
  ).map(([from, to]) => ({
    match: psql(sql),
    where: 'container' as const,
    output: { [from]: 'CREATE INDEX' },
    mutating: { ...effect, to, destroys: ['active-queries' as const] },
  }))

/** Inside postgres-0. While the index is missing, backends running the order-history scan use whole CPUs. */
const postgresProcesses = (scanning: boolean) =>
  [
    'USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND',
    'postgres       1  0.0  0.7 221104 29880 ?        Ss   Oct03   1:02 postgres -c log_min_duration_statement=500ms -c log_statement=ddl',
    'postgres      27  0.0  0.4 221240 17412 ?        Ss   Oct03   0:41 postgres: checkpointer',
    'postgres      28  0.0  0.2 221104  8240 ?        Ss   Oct03   0:09 postgres: background writer',
    'postgres      30  0.0  0.3 221104 10112 ?        Ss   Oct03   0:22 postgres: walwriter',
    'postgres      31  0.0  0.2 222672  8892 ?        Ss   Oct03   0:13 postgres: autovacuum launcher',
    ...(scanning
      ? [
          'postgres   48211 96.1  1.9 223412 79024 ?        Rs   11:21  17:31 postgres: pantry pantry 10.42.0.70(40118) SELECT',
          'postgres   48214 95.7  1.9 223412 78812 ?        Rs   11:21  17:22 postgres: pantry pantry 10.42.1.82(51644) SELECT',
        ]
      : ['postgres   48214  0.4  1.9 223412 78812 ?        Ss   11:21  17:24 postgres: pantry pantry 10.42.1.82(51644) idle']),
    'root       52201  0.0  0.0   2576   924 pts/0    Ss   11:39   0:00 sh',
    'root       52207  0.0  0.0   7064  1580 pts/0    R+   11:39   0:00 ps aux',
  ].join('\n')

const indexBuilt = (how: string) =>
  `PostgreSQL ${how} Each order-history lookup now reads a few index entries instead of 4.2 million rows: it takes milliseconds again, the database's CPU falls back and the queued requests drain.`

export const slowQuery = defineIncident({
  id: 'slow-query',
  title: 'Slow Query',
  difficulty: 3,
  namespace: 'pantry',
  alert: {
    name: 'PantryApiHighLatency',
    severity: 'page',
    condition: '95th percentile latency above 1 second for 10 minutes',
    startedAt: '11:34 UTC',
    summary: stillSlow,
  },
  briefing:
    'You are on call for Pantry: pantry-api on Kubernetes, with PostgreSQL, Redis and an nginx load balancer in front. Nothing is failing outright, but every page has become slow and the latency alert has paged you. You can open a shell in postgres-0, and psql is installed there.',
  states: ['slow', 'rolled-back', 'indexed', 'rolled-back-indexed'],
  initialState: 'slow',
  findings: {
    'database-saturated': {
      summary: 'PostgreSQL is using nearly all of its 2 CPU cores, while the pantry-api pods are nearly idle.',
    },
    'orders-query-slow': {
      summary: 'The order-history lookup (orders WHERE customer_id = $1) takes about 2.4 seconds every time; other queries take under a second.',
    },
    'queries-pile-up': {
      summary: 'Seventeen queries are running at once, thirteen of them the same order-history lookup, some for nearly 3 seconds.',
    },
    'no-customer-index': {
      summary: 'The orders table has no index on customer_id, so each lookup reads all 4.2 million rows (a Seq Scan).',
    },
    'index-dropped': {
      summary: 'v2.16.0, released at 11:20, ran migration 0042, which dropped orders_customer_id_idx as "unused".',
    },
  },
  evidence: {
    'active-queries': {
      summary: 'What PostgreSQL was busy with: the same order-history lookup, over and over, each running for seconds.',
      lost: 'once the index existed, the lookups finished in milliseconds. The live picture of what the database was busy with is gone.',
    },
  },
  resources: {
    slow: [...slowPods.map((p) => `pod/${p.pod}`), 'pod/postgres-0', 'pod/redis-7c9d5b8f6-hq2lw', 'deployment/pantry-api', 'deployment/redis'],
    indexed: [...slowPods.map((p) => `pod/${p.pod}`), 'pod/postgres-0', 'pod/redis-7c9d5b8f6-hq2lw', 'deployment/pantry-api', 'deployment/redis'],
    'rolled-back': [...rolledBackPods.map((p) => `pod/${p.pod}`), 'pod/postgres-0', 'pod/redis-7c9d5b8f6-hq2lw', 'deployment/pantry-api', 'deployment/redis'],
    'rolled-back-indexed': [...rolledBackPods.map((p) => `pod/${p.pod}`), 'pod/postgres-0', 'pod/redis-7c9d5b8f6-hq2lw', 'deployment/pantry-api', 'deployment/redis'],
  },
  shellPodPrefix: 'postgres-0',
  commands: [
    // --- Reading the cluster -----------------------------------------------------------------
    {
      match: ['kubectl get pods'],
      output: {
        slow: getPods(slowPods, '19m'),
        indexed: getPods(slowPods, '26m'),
        'rolled-back': getPods(rolledBackPods, '58s'),
        'rolled-back-indexed': getPods(rolledBackPods, '9m'),
      },
    },
    {
      match: ['kubectl top pods'],
      output: {
        slow: topPods(slowPods, { apiCpu: ['38m', '41m', '36m'], dbCpu: '1987m', dbMemory: '1210Mi' }),
        'rolled-back': topPods(rolledBackPods, { apiCpu: ['35m', '39m', '37m'], dbCpu: '1979m', dbMemory: '1214Mi' }),
        indexed: topPods(slowPods, { apiCpu: ['94m', '101m', '97m'], dbCpu: '402m', dbMemory: '1236Mi' }),
        'rolled-back-indexed': topPods(rolledBackPods, { apiCpu: ['91m', '98m', '95m'], dbCpu: '398m', dbMemory: '1239Mi' }),
      },
      reveals: [{ finding: 'database-saturated', seenIn: '1987m' }],
    },
    {
      match: ['kubectl top nodes'],
      output: `NAME     CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)
node-a   2391m        59%      3420Mi          43%
node-b   402m         10%      2280Mi          29%
node-c   377m         9%       2310Mi          29%`,
    },
    {
      match: ['kubectl get deployments'],
      output: `NAME         READY   UP-TO-DATE   AVAILABLE   AGE
pantry-api   3/3     3            3           222d
redis        1/1     1            1           222d`,
    },
    { match: ['kubectl get statefulsets'], output: 'NAME       READY   AGE\npostgres   1/1     222d' },
    {
      match: ['kubectl get events', 'kubectl events', 'kubectl get events --sort-by=.lastTimestamp'],
      output: byRelease(
        `LAST SEEN   TYPE     REASON              OBJECT                            MESSAGE
19m         Normal   ScalingReplicaSet   deployment/pantry-api             Scaled up replica set pantry-api-9d7c5f8b42 to 1 from 0
19m         Normal   Started             pod/pantry-api-9d7c5f8b42-fx4kd   Started container api
19m         Normal   Started             pod/pantry-api-9d7c5f8b42-lq8wm   Started container api
18m         Normal   Started             pod/pantry-api-9d7c5f8b42-v6tzn   Started container api`,
        `LAST SEEN   TYPE     REASON               OBJECT                            MESSAGE
62s         Normal   DeploymentRollback   deployment/pantry-api             Rolled back deployment "pantry-api" to revision 47
58s         Normal   Started              pod/pantry-api-6f8b7d9c55-hp2xr   Started container api
39s         Normal   Started              pod/pantry-api-6f8b7d9c55-m9kcw   Started container api
21s         Normal   Started              pod/pantry-api-6f8b7d9c55-s4bfz   Started container api`,
      ),
    },
    { match: ['kubectl describe pod/postgres-0'], output: describePostgres },
    {
      match: ['kubectl rollout history deployment/pantry-api'],
      output: byRelease(rolloutHistory(false), rolloutHistory(true)),
      reveals: [{ finding: 'index-dropped', seenIn: 'migration 0042 drops unused indexes' }],
    },
    {
      match: ['kubectl get replicasets'],
      output: byRelease(
        `NAME                    DESIRED   CURRENT   READY   AGE
pantry-api-9d7c5f8b42   3         3         3       19m
pantry-api-6f8b7d9c55   0         0         0       3d20h
pantry-api-5c8d9f7b46   0         0         0       8d
redis-7c9d5b8f6         1         1         1       222d`,
        `NAME                    DESIRED   CURRENT   READY   AGE
pantry-api-6f8b7d9c55   3         3         3       3d20h
pantry-api-9d7c5f8b42   0         0         0       20m
pantry-api-5c8d9f7b46   0         0         0       8d
redis-7c9d5b8f6         1         1         1       222d`,
      ),
    },
    {
      match: ['kubectl logs pod/postgres-0', 'kubectl logs statefulset/postgres'],
      output: byIndex(slowPostgresLogs, indexedPostgresLogs),
      reveals: [
        { finding: 'orders-query-slow', seenIn: 'FROM orders WHERE customer_id = $1' },
        { finding: 'index-dropped', seenIn: 'DROP INDEX IF EXISTS orders_customer_id_idx' },
      ],
    },
    {
      match: ['kubectl logs deployment/pantry-api', `kubectl logs pod/${slowPods[0]!.pod}`],
      output: { slow: slowApiLogs(true), indexed: slowApiLogs(true) },
      reveals: [{ finding: 'index-dropped', seenIn: 'DROP INDEX IF EXISTS orders_customer_id_idx' }],
    },
    ...slowPods.slice(1).map((p) => ({
      match: [`kubectl logs pod/${p.pod}`],
      output: { slow: slowApiLogs(false), indexed: slowApiLogs(false) },
    })),
    {
      match: ['kubectl logs deployment/pantry-api', ...rolledBackPods.map((p) => `kubectl logs pod/${p.pod}`)],
      output: { 'rolled-back': rolledBackApiLogs, 'rolled-back-indexed': rolledBackApiLogs },
    },
    {
      match: ['curl https://pantry.example.com/healthz', 'curl -s https://pantry.example.com/healthz'],
      output: byRelease('{"status":"ok","version":"2.16.0"}', '{"status":"ok","version":"2.15.1"}'),
    },

    // --- Changing the cluster ------------------------------------------------------------------
    {
      match: ['kubectl rollout undo deployment/pantry-api', 'kubectl rollout undo deployment/pantry-api --to-revision=47'],
      output: { slow: 'deployment.apps/pantry-api rolled back' },
      mutating: {
        warning: 'Roll pantry-api back to the previous revision (v2.15.1). Kubernetes replaces every v2.16.0 pod.',
        to: 'rolled-back',
        consequence:
          'The v2.15.1 pods are up within a minute, and nothing improves: latency stays above 2 seconds and the database stays at its CPU limit. A rollout undo restores the code, not the database, so whatever v2.16.0 changed there is still changed.',
      },
    },

    // --- Inside postgres-0 ---------------------------------------------------------------------
    {
      match: psql(ACTIVITY_QUERY),
      where: 'container',
      output: byIndex(pileUp, quietActivity),
      evidence: 'active-queries',
      reveals: [{ finding: 'queries-pile-up', seenIn: '(17 rows)' }],
    },
    {
      match: psql('\\d orders'),
      where: 'container',
      output: byIndex(describeOrders(false), describeOrders(true)),
      reveals: [{ finding: 'no-customer-index', seenIn: 'btree (created_at)\nForeign-key constraints:' }],
    },
    {
      match: psql(EXPLAIN_QUERY),
      where: 'container',
      output: byIndex(seqScanPlan, indexScanPlan),
      reveals: [{ finding: 'no-customer-index', seenIn: 'Parallel Seq Scan on orders' }],
    },
    {
      match: psql('SELECT count(*) FROM orders'),
      where: 'container',
      output: ' count\n---------\n 4199958\n(1 row)',
    },
    ...createIndex(CREATE_INDEX, {
      warning:
        'Build orders_customer_id_idx on the 4.2 million row orders table. CONCURRENTLY builds it without blocking writes; it takes about 40 seconds and adds load while it runs.',
      consequence: indexBuilt('built the index in 39 seconds while orders kept being written.'),
    }),
    ...createIndex(CREATE_INDEX_LOCKING, {
      warning: 'Build orders_customer_id_idx on the 4.2 million row orders table. Without CONCURRENTLY, every write to orders waits until the build finishes.',
      consequence: indexBuilt(
        'built the index in 31 seconds, and blocked every write to orders while it did: checkouts waited, and some timed out. It worked, at a cost; CONCURRENTLY would have avoided the lock.',
      ),
    }),
    { match: ['ps aux'], where: 'container', output: byIndex(postgresProcesses(true), postgresProcesses(false)) },
  ],
  dashboard,
  expertPath: [
    {
      command: 'kubectl top pods',
      why: 'Everything is slow but nothing is failing. Where is the time going: the API, or something it waits on?',
      reaches: ['database-saturated'],
    },
    {
      command: 'kubectl logs postgres-0 --tail=20',
      why: 'The database is at its CPU limit. Which queries is it spending that time on?',
      reaches: ['orders-query-slow'],
    },
    {
      command: `kubectl exec postgres-0 -- psql -U pantry -c "${ACTIVITY_QUERY}" | tee active-queries.txt`,
      why: 'See what is running right now, and keep a copy: once the harm stops, this picture is gone.',
      reaches: ['queries-pile-up'],
      achieves: { captured: 'active-queries' },
    },
    {
      command: 'kubectl exec postgres-0 -- psql -U pantry -c "\\d orders"',
      why: 'One lookup on orders by customer_id takes seconds. Can PostgreSQL find those rows without reading the whole table?',
      reaches: ['no-customer-index'],
    },
    {
      command: 'kubectl rollout history deployment/pantry-api',
      why: 'The lookup has not changed in months, yet it became slow at 11:20. What changed then?',
      reaches: ['index-dropped'],
    },
    {
      command: `kubectl exec postgres-0 -- psql -U pantry -c "${CREATE_INDEX}"`,
      why: 'A rollback would not bring the index back. Rebuild it without blocking writes to orders.',
      achieves: { state: ['indexed', 'rolled-back-indexed'] },
    },
  ],
  hints: [
    {
      goal: { finding: 'database-saturated' },
      question: 'Every page is slow, yet nothing is failing. Is pantry-api busy, or is it waiting for something?',
      playbook: 'what-is-using-cpu-and-memory',
      command: 'kubectl top pods',
    },
    {
      goal: { finding: 'orders-query-slow' },
      question: 'PostgreSQL is at its CPU limit. Which queries is it spending that time on?',
      playbook: 'which-queries-are-slow',
      command: 'kubectl logs postgres-0 --tail=20',
    },
    {
      goal: { captured: 'active-queries' },
      question: 'What is the database running at this moment? Keep a copy: any Mitigation will change the picture.',
      playbook: 'what-is-the-database-doing-right-now',
      command: `kubectl exec postgres-0 -- psql -U pantry -c "${ACTIVITY_QUERY}" | tee active-queries.txt`,
    },
    {
      goal: { finding: 'no-customer-index' },
      question: 'One lookup on orders by customer_id takes seconds. Why would a lookup be slow?',
      playbook: 'why-is-this-query-slow',
      command: 'kubectl exec postgres-0 -- psql -U pantry -c "\\d orders"',
    },
    {
      goal: { finding: 'index-dropped' },
      question: 'The lookup became slow at 11:20. What changed then?',
      playbook: 'what-was-deployed',
      command: 'kubectl rollout history deployment/pantry-api',
    },
    {
      goal: { state: ['indexed', 'rolled-back-indexed'] },
      question: 'The index is gone and a rollback will not restore it. How do you add it back without blocking checkouts?',
      playbook: 'how-do-i-add-an-index-without-blocking-writes',
      command: `kubectl exec postgres-0 -- psql -U pantry -c "${CREATE_INDEX}"`,
    },
  ],
  rootCauses: [
    {
      id: 'traffic-surge',
      label: 'A surge of traffic is overloading the database.',
      contradictedBy: [
        {
          finding: 'orders-query-slow',
          why: 'One query, the order-history lookup, takes 2.4 seconds every time. A surge would slow every query alike, and the request rate is flat.',
        },
      ],
    },
    {
      id: 'pool-too-small',
      label: 'pantry-api’s pool of 10 database connections per pod is too small.',
      contradictedBy: [
        {
          finding: 'database-saturated',
          why: 'PostgreSQL itself is at its CPU limit. More connections would hand more work to a database that cannot keep up with what it has.',
        },
      ],
    },
    {
      id: 'dropped-index',
      label: 'Migration 0042 in v2.16.0 dropped orders_customer_id_idx, so every order-history lookup scans the whole orders table.',
      correct: true,
    },
    {
      id: 'query-changed',
      label: 'v2.16.0 rewrote the order-history query so it can no longer use its index.',
      contradictedBy: [
        {
          finding: 'no-customer-index',
          why: 'There is no index on customer_id for any query to use. The query is the one pantry-api has run for months.',
        },
      ],
    },
    {
      id: 'table-lock',
      label: 'A long transaction holds a lock on orders, so lookups wait for it.',
      contradictedBy: [
        {
          finding: 'queries-pile-up',
          why: 'The lookups are running, not waiting on a lock: pg_stat_activity shows no Lock wait events, and the database is busy, not idle.',
        },
      ],
    },
  ],
  mitigations: [
    {
      id: 'create-index-concurrently',
      label: 'Recreate the index with CREATE INDEX CONCURRENTLY',
      verdict: 'best',
      explanation:
        'Puts back exactly what the migration removed, in about 40 seconds, without blocking writes to orders. Here rolling forward is the fastest safe Mitigation, because rolling back cannot touch the database.',
    },
    {
      id: 'create-index',
      label: 'Recreate the index with a plain CREATE INDEX',
      verdict: 'works',
      explanation:
        'The lookups become fast again, but the build locks orders against writes while it runs: checkouts wait, and some time out. CONCURRENTLY avoids that.',
    },
    {
      id: 'rollback',
      label: 'Roll back pantry-api to v2.15.1',
      verdict: 'no-effect',
      explanation:
        'kubectl rollout undo puts back the old code, not the old database. The index stays dropped and the same lookup keeps scanning the table.',
    },
    {
      id: 'scale-api',
      label: 'Scale pantry-api up to six replicas',
      verdict: 'harmful',
      explanation:
        'More pods open more connections and send more of the same slow lookup to a database already at its CPU limit. Everything gets slower.',
    },
    {
      id: 'restart-database',
      label: 'Restart PostgreSQL',
      verdict: 'harmful',
      explanation:
        'Every connection drops and every request fails while it starts. It comes back with the same missing index and an empty cache, so it is slower than before.',
    },
  ],
  postmortem: {
    summary:
      'Release v2.16.0 dropped an index that the order-history lookup depends on. For 20 minutes every account page scanned the whole orders table, saturating PostgreSQL and slowing every request.',
    impact:
      'From 11:20 to 11:41 UTC the 95th percentile latency rose from 90 milliseconds to about 2.6 seconds across the whole API. About 2% of requests timed out with 504. Checkouts slowed but completed.',
    timeline: [
      { at: '11:20', event: 'CI rolls out v2.16.0 (revision 48). Its migration 0042 drops three indexes listed as unused, including orders_customer_id_idx.' },
      { at: '11:21', event: 'Order-history lookups start scanning 4.2 million rows. PostgreSQL CPU climbs to its limit within five minutes.' },
      { at: '11:34', event: 'PantryApiHighLatency fires after ten minutes above 1 second. On-call is paged.' },
      { at: '11:37', event: 'On-call finds PostgreSQL saturated by one slow lookup, saves pg_stat_activity and finds no index on customer_id.' },
      { at: '11:39', event: 'Rollout history links the release to migration 0042. On-call does not roll back: it would not restore the index.' },
      { at: '11:40', event: 'On-call recreates the index with CREATE INDEX CONCURRENTLY. It is ready 39 seconds later.' },
      { at: '11:46', event: 'The alert resolves.' },
    ],
    rootCause:
      'Migration 0042 dropped indexes that a cleanup script reported as unused. The script counted index scans on the staging database, where nobody opens account pages, so orders_customer_id_idx looked unused although every account page in production relied on it. Without it, each order-history lookup read the whole orders table.',
    resolution:
      'Recreated orders_customer_id_idx concurrently at 11:40. Migration 0042 will be amended to keep it, and the other two dropped indexes have been checked against a full week of usage.',
    actionItems: [
      'Never drop an index in the same release that finds it unused. Disable it first, or watch it for a full business cycle.',
      'Judge index usage on production, over a long window: index statistics from staging say nothing about real traffic.',
      'Run migrations against a production-sized copy of the database and compare query plans before and after.',
      'Alert on database CPU and on the slowest statements, so a missing index pages before customers notice.',
    ],
  },
  prevention: [
    'Treat dropping an index like deleting code that might still be called. Confirm it is unused over a long window, then drop it in a release of its own.',
    'Test migrations against production-sized data. On a small test database a full table scan is fast, which is how this one looked harmless.',
    'Remember that a rollback restores code, not data or schema. Make each migration reversible, or safe to run ahead of the code that needs it.',
    'Keep the slow query log on (log_min_duration_statement). Here it named the guilty query in the first minute of the investigation.',
  ],
  links: {
    concepts: ['investigating-by-hypothesis', 'mitigate-then-investigate'],
    resources: ['pg-monitoring-stats', 'pg-using-explain', 'pg-create-index', 'pg-logging', 'gregg-methodology'],
  },
})
