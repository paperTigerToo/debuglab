import type { AccessLogLine, Dashboard, Deploy } from '../engine/types'
import { defineIncident } from '../engine/types'
import { access, appLog, clock, kubectlTable, podsTable, round, runningPod, samples, topTable, wobble, type PodRow } from './build'

// Full Disk: on Tuesday evening, after the Slow Query Incident, a teammate wanted a record of every
// statement for the postmortem. With ALTER SYSTEM they turned the logging collector on, set
// log_min_duration_statement to 0, asked for one log file a day, and restarted postgres-0 by deleting
// its pod. Since then PostgreSQL has written every statement, about 6 GB a day, into log files inside
// its own data directory, on the same 20Gi volume as the tables. At 10:06 on Friday the volume filled.
// Reads still work; every write fails with "No space left on device". The trap is pg_wal, the
// write-ahead log, which sounds like logs but holds changes the tables need: deleting it crashes PostgreSQL.
//
// Named states:
//   full          the volume is full and writes fail (the start).
//   logs-cleared  the Learner deleted the old log files: writes work, but logging still grows 6 GB a day.
//   expanded      the Learner grew the volume to 40Gi: writes work, and logging fills it in about three days.
//   wal-deleted   the Learner deleted pg_wal: PostgreSQL crashed and will not start.

const DATA = '/var/lib/postgresql/data'
const VOLUME = 'pvc-3f8e2c71-5b0d-4a9e-9c6f-2d17b8e4a0c3'

// ---------------------------------------------------------------------------------------------
// What differs between the named states, in one place

/**
 * The data volume as df sees it. ext4 keeps 5% back for root, so a full 20G volume shows 19G used and 0 available.
 * `logDir` is what du counts in the log directory: a deleted file that PostgreSQL still holds open is not counted
 * by du, but its space is still in use according to df until the file is closed.
 */
type Disk = { size: string; used: string; avail: string; percent: string; logDir: string }

type Facts = {
  /** The volume's capacity as Kubernetes reports it. */
  capacity: string
  disk: Disk
  /** Whether PostgreSQL is running, so `kubectl exec` into postgres-0 works. */
  databaseUp: boolean
  databaseCpu: string
}

const facts = {
  full: {
    capacity: '20Gi',
    disk: { size: '20G', used: '19G', avail: '0', percent: '100%', logDir: '15G' },
    databaseUp: true,
    databaseCpu: '118m',
  },
  'logs-cleared': {
    capacity: '20Gi',
    disk: { size: '20G', used: '6.2G', avail: '13G', percent: '33%', logDir: '4.0K' },
    databaseUp: true,
    databaseCpu: '131m',
  },
  expanded: {
    capacity: '40Gi',
    disk: { size: '40G', used: '19G', avail: '19G', percent: '50%', logDir: '15G' },
    databaseUp: true,
    databaseCpu: '127m',
  },
  'wal-deleted': {
    capacity: '20Gi',
    disk: { size: '20G', used: '19G', avail: '0', percent: '100%', logDir: '15G' },
    databaseUp: false,
    databaseCpu: '0m',
  },
} satisfies Record<string, Facts>

type State = keyof typeof facts
const STATES = Object.keys(facts) as State[]

/** Output for every named state, computed from that state's facts. */
const each = <T,>(f: (facts: Facts, state: State) => T) =>
  Object.fromEntries(STATES.map((s) => [s, f(facts[s], s)])) as Record<State, T>

/** What `kubectl exec` says while postgres-0 is crash-looping: there is no running container to enter. */
const CONTAINER_DOWN = 'error: unable to upgrade connection: container not found ("postgres")'
/** Output of a command inside postgres-0, which only answers while the container is running. */
const inContainer = <T,>(f: (facts: Facts, state: State) => T) => each((x, s) => (x.databaseUp ? f(x, s) : CONTAINER_DOWN))

// ---------------------------------------------------------------------------------------------
// Pods

type Pod = { pod: string; node: string; ip: string; cpu: string; memory: string }

const apiPods: Pod[] = [
  { pod: 'pantry-api-6d4b8f9c57-mz5qp', node: 'node-a', ip: '10.42.0.101', cpu: '61m', memory: '158Mi' },
  { pod: 'pantry-api-6d4b8f9c57-r2gwn', node: 'node-b', ip: '10.42.1.104', cpu: '58m', memory: '161Mi' },
  { pod: 'pantry-api-6d4b8f9c57-x7hkc', node: 'node-c', ip: '10.42.2.96', cpu: '64m', memory: '155Mi' },
]
const postgres = { pod: 'postgres-0', ip: '10.42.0.12', node: 'node-a' }
const redis = { pod: 'redis-7c9d5b8f6-hq2lw', ip: '10.42.2.7', node: 'node-c' }

// postgres-0 was recreated on Tuesday evening, when its pod was deleted to apply the logging settings.
const postgresRow = (up: boolean): PodRow =>
  up ? runningPod(postgres, '2d16h') : { ...runningPod(postgres, '2d16h'), ready: '0/1', status: 'CrashLoopBackOff', restarts: '3 (19s ago)' }
const podRows = (x: Facts) => [...apiPods.map((p) => runningPod(p, '17h')), postgresRow(x.databaseUp), runningPod(redis, '55d')]

const topPods = (x: Facts) =>
  topTable([
    ...apiPods.map((p) => ({ name: p.pod, cpu: p.cpu, memory: p.memory })),
    { name: postgres.pod, cpu: x.databaseCpu, memory: x.databaseUp ? '1288Mi' : '0Mi' },
    { name: redis.pod, cpu: '9m', memory: '41Mi' },
  ])

// ---------------------------------------------------------------------------------------------
// The volume

/** `df -h`, laid out as df does it: sizes right-aligned in narrow columns. */
const df = (d: Disk) =>
  [
    'Filesystem      Size  Used Avail Use% Mounted on',
    ...[
      ['overlay', '95G', '38G', '57G', '40%', '/'],
      ['tmpfs', '64M', '0', '64M', '0%', '/dev'],
      ['/dev/sdb', d.size, d.used, d.avail, d.percent, DATA],
      ['shm', '64M', '1.1M', '63M', '2%', '/dev/shm'],
    ].map(([fs, size, used, avail, use, mount]) => `${fs!.padEnd(15)}${size!.padStart(5)}${used!.padStart(6)}${avail!.padStart(6)}${use!.padStart(5)} ${mount}`),
  ].join('\n')

/** `du -sh` of everything at the top of the data directory, in the order the shell's glob gives it. */
const du = (d: Disk) =>
  [
    ['4.0K', 'PG_VERSION'],
    ['3.1G', 'base'],
    ['588K', 'global'],
    [d.logDir, 'log'],
    ['16K', 'pg_logical'],
    ['20K', 'pg_stat'],
    ['1.0G', 'pg_wal'],
    ['52K', 'pg_xact'],
    ['4.0K', 'postgresql.auto.conf'],
    ['32K', 'postgresql.conf'],
  ]
    .map(([size, name]) => `${size}\t${DATA}/${name}`)
    .join('\n')

/** The line of `du` that shows what filled the disk. */
const LOG_DIR_LINE = `${facts.full.disk.logDir}\t${DATA}/log`

/** The log files, one a day since Tuesday evening. Writes stopped when the disk filled, so today's is short. */
const logListing = [
  'total 15G',
  '-rw------- 1 postgres postgres 1.6G Nov 24 23:59 postgresql-2026-11-24.log',
  '-rw------- 1 postgres postgres 5.9G Nov 25 23:59 postgresql-2026-11-25.log',
  '-rw------- 1 postgres postgres 6.1G Nov 26 23:59 postgresql-2026-11-26.log',
  '-rw------- 1 postgres postgres 1.4G Nov 27 10:06 postgresql-2026-11-27.log',
].join('\n')

/** The settings made with ALTER SYSTEM. One file a day needs both a date-only name and no rotation by size. */
const autoConf = `# Do not edit this file manually!
# It will be overwritten by the ALTER SYSTEM command.
logging_collector = 'on'
log_filename = 'postgresql-%Y-%m-%d.log'
log_rotation_size = '0'
log_min_duration_statement = '0'`

/** The configuration line, and the same setting as psql shows it, that make PostgreSQL log every statement. */
const EVERY_STATEMENT = "log_min_duration_statement = '0'"
const SHOW_EVERY_STATEMENT = ' log_min_duration_statement\n----------------------------\n 0'

const todaysLogTail = [
  "2026-11-27 10:06:02.871 UTC [71240] LOG:  duration: 0.188 ms  statement: SELECT id, name, price_cents FROM products WHERE category = 'bakery' ORDER BY name LIMIT 24",
  '2026-11-27 10:06:02.904 UTC [71236] LOG:  duration: 0.091 ms  statement: SELECT id, quantity FROM cart_items WHERE cart_id = 99120',
  '2026-11-27 10:06:03.114 UTC [71233] ERROR:  could not extend file "base/16384/16521": No space left on device',
  '2026-11-27 10:06:03.114 UTC [71233] HINT:  Check free disk space.',
  '2026-11-27 10:06:03.114 UTC [71233] STATEMENT:  INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (99120, 2210, 1)',
].join('\n')

const resizeEvent = `MountVolume.NodeExpandVolume succeeded for volume "${VOLUME}" node-a`

function describePvc(x: Facts): string {
  const resized = x.capacity !== facts.full.capacity
  return `Name:          data-postgres-0
Namespace:     pantry
StorageClass:  standard-rwo
Status:        Bound
Volume:        ${VOLUME}
Labels:        app=postgres
Capacity:      ${x.capacity}
Access Modes:  RWO
VolumeMode:    Filesystem
Used By:       postgres-0
Events:${
    resized
      ? `
  Type    Reason                      Age   From     Message
  ----    ------                      ----  ----     -------
  Normal  FileSystemResizeSuccessful  41s   kubelet  ${resizeEvent}`
      : '        <none>'
  }`
}

const pvcs = (x: Facts) =>
  kubectlTable([
    ['NAME', 'STATUS', 'VOLUME', 'CAPACITY', 'ACCESS MODES', 'STORAGECLASS', 'VOLUMEATTRIBUTESCLASS', 'AGE'],
    ['data-postgres-0', 'Bound', VOLUME, x.capacity, 'RWO', 'standard-rwo', '<unset>', '224d'],
  ])

const describePostgres = (x: Facts) => `Name:             postgres-0
Namespace:        pantry
Node:             node-a/10.0.1.20
Start Time:       Tue, 24 Nov 2026 18:02:04 +0000
Labels:           app=postgres
Status:           Running
IP:               10.42.0.12
Controlled By:    StatefulSet/postgres
Containers:
  postgres:
    Image:          postgres:17.6
    Port:           5432/TCP
    State:          ${x.databaseUp ? 'Running\n      Started:      Tue, 24 Nov 2026 18:02:10 +0000' : 'Waiting\n      Reason:       CrashLoopBackOff'}
    Ready:          ${x.databaseUp ? 'True' : 'False'}
    Restart Count:  ${x.databaseUp ? '0' : '3'}
    Limits:
      cpu:     2
      memory:  4Gi
    Mounts:
      ${DATA} from data (rw)
Volumes:
  data:
    Type:       PersistentVolumeClaim (a reference to a PersistentVolumeClaim in the same namespace)
    ClaimName:  data-postgres-0`

// ---------------------------------------------------------------------------------------------
// Logs

const { line, request } = appLog('2026-11-27')

/** A write that PostgreSQL refused because it could not grow a table's file. */
const diskFull = (time: string, method: string, path: string) =>
  line(time, 'error', 'request failed', {
    method,
    path,
    status: 500,
    ms: 14,
    err: { code: '53100', message: 'could not extend file "base/16384/16521": No space left on device' },
  })

/** A request that needed PostgreSQL after it crashed. */
const databaseDown = (time: string, path: string) =>
  line(time, 'error', 'request failed', {
    method: 'GET',
    path,
    status: 503,
    ms: 2,
    err: { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 10.43.0.29:5432' },
  })

const fullApiLogs = [
  request('10:16:40.207', 'GET', '/healthz', 1),
  request('10:16:40.880', 'GET', '/api/products?category=bakery', 24),
  diskFull('10:16:41.415', 'POST', '/api/cart/items'),
  request('10:16:42.118', 'GET', '/api/cart', 11),
  diskFull('10:16:42.731', 'POST', '/api/checkout'),
  request('10:16:43.054', 'GET', '/api/products?category=dairy', 22),
  request('10:16:43.660', 'GET', '/api/orders?limit=10', 15),
  diskFull('10:16:44.315', 'POST', '/api/cart/items'),
  request('10:16:45.207', 'GET', '/healthz', 1),
  request('10:16:45.774', 'GET', '/api/products/4411', 9),
  diskFull('10:16:46.118', 'PATCH', '/api/account'),
  request('10:16:46.409', 'GET', '/api/products?category=produce', 25),
  diskFull('10:16:47.536', 'POST', '/api/checkout'),
  request('10:16:48.950', 'GET', '/api/cart', 12),
].join('\n')

const recoveredApiLogs = [
  request('10:19:40.207', 'GET', '/healthz', 1),
  request('10:19:40.880', 'GET', '/api/products?category=bakery', 23),
  request('10:19:41.415', 'POST', '/api/cart/items', 18),
  request('10:19:42.118', 'GET', '/api/cart', 12),
  request('10:19:42.731', 'POST', '/api/checkout', 226),
  request('10:19:43.054', 'GET', '/api/products?category=dairy', 21),
  request('10:19:44.315', 'POST', '/api/cart/items', 17),
  request('10:19:45.207', 'GET', '/healthz', 1),
].join('\n')

const databaseDownApiLogs = [
  databaseDown('10:18:40.207', '/api/cart'),
  request('10:18:40.880', 'GET', '/healthz', 1),
  databaseDown('10:18:41.415', '/api/products?category=bakery'),
].join('\n')

const apiLogs = (x: Facts, s: State) => (!x.databaseUp ? databaseDownApiLogs : s === 'full' ? fullApiLogs : recoveredApiLogs)

const redirected = `2026-11-24 18:02:11.204 UTC [1] LOG:  redirecting log output to logging collector process
2026-11-24 18:02:11.204 UTC [1] HINT:  Future log output will appear in directory "log".`

const crashed = `2026-11-27 10:18:22.502 UTC [1] LOG:  starting PostgreSQL 17.6 on x86_64-pc-linux-gnu, compiled by gcc (Debian 12.2.0-14) 12.2.0, 64-bit
2026-11-27 10:18:22.530 UTC [29] LOG:  database system was interrupted; last known up at 2026-11-27 10:17:58 UTC
2026-11-27 10:18:22.531 UTC [29] PANIC:  could not locate a valid checkpoint record at 0/8D000110
2026-11-27 10:18:22.533 UTC [1] LOG:  startup process (PID 29) was terminated by signal 6: Aborted
2026-11-27 10:18:22.533 UTC [1] LOG:  aborting startup due to startup process failure`

// ---------------------------------------------------------------------------------------------
// Dashboard: one sample a minute from 09:50. The volume fills at 10:06.

const label = clock('09:50')
const FULL_AT = 16
const NOW = 27 // 10:17: the first sample after the Learner acts

type Phase = 'filling' | 'full' | 'cleared' | 'expanded' | 'down'

/** How full the volume is in each phase, in percent; while filling, about 4 MB a minute of a 20G volume. */
const used: Record<Phase, (i: number) => number> = {
  filling: (i) => round(99.7 + (i / FULL_AT) * 0.3, 2),
  full: () => 100,
  cleared: () => 33,
  expanded: () => 50,
  down: () => 100,
}

function signals(phases: Phase[]): Dashboard['signals'] {
  const requests = phases.map((_, i) => round(184 + wobble(i, 8), 0))
  const errors = phases.map((p, i) =>
    round(p === 'full' ? 11 + wobble(i, 0.9) : p === 'down' ? 93 + wobble(i, 1) : 0.2 + Math.abs(wobble(i, 0.12)), 1),
  )
  const latency = phases.map((p, i) => round(p === 'down' ? 4 : 90 + wobble(i, 6), 0))
  const saturation = phases.map((p, i) => used[p](i))
  return { requests, errors, latency, saturation }
}

const timeline = (length: number, after: Phase) =>
  samples(length, label, (i) => (i < FULL_AT ? 'filling' : i < NOW ? 'full' : after), signals)

const history: Deploy[] = [
  { revision: 51, version: 'v2.16.2', at: 'Thu 26 Nov 17:30 UTC', by: 'ci: pipeline #1966' },
  { revision: 50, version: 'v2.16.1', at: 'Thu 26 Nov 15:14 UTC', by: 'on-call: kubectl set env' },
  { revision: 49, version: 'v2.16.1', at: 'Tue 24 Nov 16:05 UTC', by: 'ci: pipeline #1957' },
]

// The upstream addresses nginx forwards to, one per pod.
const [toMz5qp, toR2gwn, toX7hkc] = apiPods.map((p) => `${p.ip}:8080`) as [string, string, string]

const fullTraffic: AccessLogLine[] = [
  access('10:16:40', 'GET', '/api/products?category=bakery', 200, 25, toMz5qp),
  access('10:16:41', 'POST', '/api/cart/items', 500, 15, toR2gwn),
  access('10:16:42', 'GET', '/api/cart', 200, 12, toX7hkc),
  access('10:16:42', 'POST', '/api/checkout', 500, 16, toMz5qp),
  access('10:16:43', 'GET', '/api/products?category=dairy', 200, 23, toR2gwn),
  access('10:16:43', 'GET', '/api/orders?limit=10', 200, 16, toX7hkc),
  access('10:16:44', 'POST', '/api/cart/items', 500, 15, toMz5qp),
  access('10:16:45', 'GET', '/api/products/4411', 200, 10, toR2gwn),
  access('10:16:46', 'PATCH', '/api/account', 500, 15, toX7hkc),
  access('10:16:47', 'POST', '/api/checkout', 500, 16, toMz5qp),
]

const recoveredTraffic: AccessLogLine[] = [
  access('10:22:40', 'POST', '/api/cart/items', 200, 19, toMz5qp),
  access('10:22:41', 'GET', '/api/cart', 200, 12, toR2gwn),
  access('10:22:42', 'POST', '/api/checkout', 200, 231, toX7hkc),
  access('10:22:43', 'GET', '/api/products?category=bakery', 200, 24, toMz5qp),
]

const downTraffic: AccessLogLine[] = [
  access('10:18:40', 'GET', '/api/cart', 503, 3, toMz5qp),
  access('10:18:40', 'GET', '/', 200, 4, toR2gwn),
  access('10:18:41', 'GET', '/api/products?category=bakery', 503, 3, toX7hkc),
  access('10:18:42', 'POST', '/api/checkout', 503, 3, toMz5qp),
]

const saturationOf = 'database disk used'
const writesFailing = 'pantry-api is returning server errors on about 11% of requests.'

const dashboard = {
  full: {
    alert: { status: 'firing', summary: writesFailing },
    saturationOf,
    ...timeline(NOW, 'full'),
    markers: [],
    deploys: history,
    logs: fullTraffic,
  },
  'logs-cleared': {
    alert: {
      status: 'resolved',
      summary: 'Resolved at 10:23: server errors back under 5% for 3 minutes. The disk is filling again at about 6 GB a day.',
    },
    saturationOf,
    ...timeline(NOW + 6, 'cleared'),
    markers: [{ at: NOW, label: 'old logs deleted' }],
    deploys: history,
    logs: [...fullTraffic.slice(-3), ...recoveredTraffic],
  },
  expanded: {
    alert: {
      status: 'resolved',
      summary: 'Resolved at 10:23: server errors back under 5% for 3 minutes. The disk is half full and filling at about 6 GB a day.',
    },
    saturationOf,
    ...timeline(NOW + 6, 'expanded'),
    markers: [{ at: NOW, label: 'volume grown to 40Gi' }],
    deploys: history,
    logs: [...fullTraffic.slice(-3), ...recoveredTraffic],
  },
  'wal-deleted': {
    alert: { status: 'firing', summary: 'PostgreSQL is down: every request that needs the database fails.' },
    saturationOf,
    ...timeline(NOW + 3, 'down'),
    markers: [{ at: NOW, label: 'pg_wal deleted' }],
    deploys: history,
    logs: [...fullTraffic.slice(-3), ...downTraffic],
  },
} satisfies Record<State, Dashboard>

// ---------------------------------------------------------------------------------------------

/** Growing the volume to 40Gi. The storage class allows it, and it cannot be undone. */
export const PATCH_40GI = `kubectl patch pvc data-postgres-0 -p '{"spec":{"resources":{"requests":{"storage":"40Gi"}}}}'`

/** Deleting pg_wal, the write-ahead log: the trap, because its name sounds like logs. */
const deleteWal = (command: string) => ({
  match: [command],
  where: 'container' as const,
  output: { full: '', 'logs-cleared': '', expanded: '' },
  mutating: {
    warning:
      'Delete every file in pg_wal, the write-ahead log. It holds changes PostgreSQL has promised are safe but has not yet written into the tables.',
    to: 'wal-deleted' as const,
    consequence:
      'PostgreSQL crashed at once and now fails to start: it cannot find the checkpoint it needs to recover, and orders committed since the last checkpoint are gone. Restoring from backup would take hours. pg_wal was called pg_xlog until PostgreSQL 10; it was renamed because people kept deleting it to free space, thinking it was logs. Restart the Incident to try a safer path.',
  },
})

/** In postgres-0: through a shell, because `*` needs one to expand it. */
const viaShell = (script: string) => `kubectl exec postgres-0 -- sh -c '${script}'`

export const fullDisk = defineIncident({
  id: 'full-disk',
  title: 'Full Disk',
  difficulty: 5,
  namespace: 'pantry',
  alert: {
    name: 'PantryApiHighErrorRate',
    severity: 'page',
    condition: '5xx responses above 5% of requests for 5 minutes',
    startedAt: '10:12 UTC',
    summary: writesFailing,
  },
  briefing:
    'You are on call for Pantry on a Friday morning: pantry-api on Kubernetes, with PostgreSQL, Redis and an nginx load balancer in front. Browsing works, but customers cannot add to their carts or check out. PostgreSQL keeps its data on a 20Gi volume. You can open a shell in postgres-0, and psql is installed there.',
  states: STATES,
  initialState: 'full',
  findings: {
    'writes-fail': {
      summary: 'Every write fails with "No space left on device" (SQLSTATE 53100), while reads still work.',
    },
    'disk-full': {
      summary: 'PostgreSQL’s data volume is 100% full, with nothing left available.',
    },
    'log-fills': {
      summary: 'The log directory takes 15G of the volume; the tables take 3.1G and pg_wal 1.0G.',
    },
    'since-tuesday': {
      summary: 'The log files begin on Tuesday evening and grow by about 6 GB a day.',
    },
    'statement-logging': {
      summary: 'log_min_duration_statement is 0, set with ALTER SYSTEM, so PostgreSQL logs every statement it runs.',
    },
  },
  evidence: {
    'log-files': {
      summary: 'The listing of PostgreSQL’s log files: when each began and how big it grew.',
      lost: 'the files are gone, so when the logging began and how fast it grew can only be pieced together.',
    },
  },
  resources: each(() => [
    ...apiPods.map((p) => `pod/${p.pod}`),
    'pod/postgres-0',
    'pod/redis-7c9d5b8f6-hq2lw',
    'deployment/pantry-api',
    'deployment/redis',
    'persistentvolumeclaim/data-postgres-0',
  ]),
  shellPodPrefix: 'postgres-0',
  commands: [
    // --- Reading the cluster -----------------------------------------------------------------
    { match: ['kubectl get pods'], output: each((x) => podsTable(podRows(x))) },
    { match: ['kubectl get pods -o wide'], output: each((x) => podsTable(podRows(x), true)) },
    { match: ['kubectl top pods'], output: each(topPods) },
    { match: ['kubectl get persistentvolumeclaims'], output: each(pvcs) },
    { match: ['kubectl describe persistentvolumeclaim/data-postgres-0'], output: each(describePvc) },
    {
      match: ['kubectl get storageclasses'],
      output: kubectlTable([
        ['NAME', 'PROVISIONER', 'RECLAIMPOLICY', 'VOLUMEBINDINGMODE', 'ALLOWVOLUMEEXPANSION', 'AGE'],
        ['standard-rwo (default)', 'disk.csi.example.com', 'Delete', 'WaitForFirstConsumer', 'true', '301d'],
      ]),
    },
    { match: ['kubectl describe pod/postgres-0'], output: each(describePostgres) },
    {
      match: ['kubectl get events', 'kubectl events', 'kubectl get events --sort-by=.lastTimestamp'],
      output: {
        full: 'No resources found in pantry namespace.',
        'logs-cleared': 'No resources found in pantry namespace.',
        expanded: kubectlTable([
          ['LAST SEEN', 'TYPE', 'REASON', 'OBJECT', 'MESSAGE'],
          ['52s', 'Normal', 'Resizing', 'persistentvolumeclaim/data-postgres-0', `External resizer is resizing volume ${VOLUME}`],
          ['41s', 'Normal', 'FileSystemResizeSuccessful', 'persistentvolumeclaim/data-postgres-0', resizeEvent],
        ]),
        'wal-deleted': kubectlTable([
          ['LAST SEEN', 'TYPE', 'REASON', 'OBJECT', 'MESSAGE'],
          ['19s', 'Warning', 'BackOff', 'pod/postgres-0', 'Back-off restarting failed container postgres in pod postgres-0_pantry'],
        ]),
      },
    },
    {
      match: ['kubectl logs deployment/pantry-api', ...apiPods.map((p) => `kubectl logs pod/${p.pod}`)],
      output: each(apiLogs),
      reveals: [{ finding: 'writes-fail', seenIn: 'No space left on device' }],
    },
    {
      match: ['kubectl logs pod/postgres-0', 'kubectl logs statefulset/postgres'],
      output: each((x) => (x.databaseUp ? redirected : crashed)),
    },
    {
      match: ['kubectl rollout history deployment/pantry-api'],
      output: `deployment.apps/pantry-api
REVISION  CHANGE-CAUSE
49        release v2.16.1: keep orders_customer_id_idx
50        release v2.16.1: keep orders_customer_id_idx
51        release v2.16.2: commit orders before charging`,
    },

    // --- Changing the cluster ------------------------------------------------------------------
    {
      match: [PATCH_40GI],
      output: { full: 'persistentvolumeclaim/data-postgres-0 patched' },
      mutating: {
        warning: 'Grow the data-postgres-0 volume from 20Gi to 40Gi. The storage class allows growing a volume while it is in use. It cannot be shrunk again.',
        to: 'expanded',
        consequence:
          'The volume and its filesystem grew to 40Gi within a minute, and writes work again. But PostgreSQL is still logging every statement, about 6 GB a day, so the new space lasts about three days, and you pay for it from now on.',
      },
    },

    // --- Inside postgres-0 ---------------------------------------------------------------------
    {
      match: ['df -h', `df -h ${DATA}`],
      where: 'container',
      output: inContainer((x) => df(x.disk)),
      reveals: [{ finding: 'disk-full', seenIn: `100% ${DATA}` }],
    },
    {
      match: [`du -sh ${DATA}/*`, `du -h --max-depth=1 ${DATA}`],
      where: 'container',
      output: inContainer((x) => du(x.disk)),
      reveals: [{ finding: 'log-fills', seenIn: LOG_DIR_LINE }],
    },
    {
      match: [`du -sh ${DATA}/log`],
      where: 'container',
      output: inContainer((x) => `${x.disk.logDir}\t${DATA}/log`),
      reveals: [{ finding: 'log-fills', seenIn: LOG_DIR_LINE }],
    },
    {
      match: [`ls ${DATA}`],
      where: 'container',
      output: inContainer(
        () =>
          'PG_VERSION  base  global  log  pg_commit_ts  pg_dynshmem  pg_hba.conf  pg_ident.conf  pg_logical  pg_multixact  pg_notify  pg_replslot  pg_serial  pg_snapshots  pg_stat  pg_stat_tmp  pg_subtrans  pg_tblspc  pg_twophase  pg_wal  pg_xact  postgresql.auto.conf  postgresql.conf  postmaster.opts',
      ),
    },
    {
      match: [`ls -lh ${DATA}/log`, `ls -l ${DATA}/log`, `ls -lhS ${DATA}/log`],
      where: 'container',
      output: inContainer((_, s) => (s === 'logs-cleared' ? 'total 0' : logListing)),
      evidence: 'log-files',
      reveals: [{ finding: 'since-tuesday', seenIn: 'postgresql-2026-11-24.log' }],
    },
    {
      match: [`tail ${DATA}/log/postgresql-2026-11-27.log`, `tail -5 ${DATA}/log/postgresql-2026-11-27.log`],
      where: 'container',
      output: { full: todaysLogTail, expanded: todaysLogTail },
      reveals: [{ finding: 'writes-fail', seenIn: 'No space left on device' }],
    },
    {
      match: [`cat ${DATA}/postgresql.auto.conf`],
      where: 'container',
      output: inContainer(() => autoConf),
      reveals: [{ finding: 'statement-logging', seenIn: EVERY_STATEMENT }],
    },
    {
      match: ['psql -U pantry -c "SHOW log_min_duration_statement"', 'psql -U postgres -c "SHOW log_min_duration_statement"'],
      where: 'container',
      output: inContainer(() => `${SHOW_EVERY_STATEMENT}\n(1 row)`),
      reveals: [{ finding: 'statement-logging', seenIn: SHOW_EVERY_STATEMENT }],
    },
    {
      match: ['psql -U pantry -c "SHOW logging_collector"', 'psql -U postgres -c "SHOW logging_collector"'],
      where: 'container',
      output: inContainer(() => ' logging_collector\n-------------------\n on\n(1 row)'),
    },
    {
      match: [`rm ${DATA}/log/*.log`, `rm ${DATA}/log/*`, `rm -f ${DATA}/log/*.log`],
      where: 'container',
      output: { full: '' },
      mutating: {
        warning: 'Delete PostgreSQL’s log files: four days of every statement it ran. The database does not need them.',
        to: 'logs-cleared',
        destroys: ['log-files'],
        consequence:
          'About 13 GB came back and writes work again within seconds. Today’s file was still open, so its 1.4 GB stays in use until PostgreSQL next starts a new file: df counts it, du no longer can. Logging continues at about 6 GB a day: set log_min_duration_statement back before the disk fills again.',
      },
    },
    deleteWal(`rm -rf ${DATA}/pg_wal/*`),
    deleteWal(`rm ${DATA}/pg_wal/*`),
    deleteWal(`rm -rf ${DATA}/pg_wal`),
  ],
  dashboard,
  expertPath: [
    {
      command: 'kubectl logs deployment/pantry-api --tail=20',
      why: 'Some requests fail and others work. What do the failing ones say?',
      reaches: ['writes-fail'],
    },
    {
      command: 'kubectl exec postgres-0 -- df -h',
      why: 'The database says it has no space. Which filesystem is full?',
      reaches: ['disk-full'],
    },
    {
      command: viaShell(`du -sh ${DATA}/*`),
      why: 'The data volume is full. What on it takes the space? The glob needs the container’s shell to expand it.',
      reaches: ['log-fills'],
    },
    {
      command: `kubectl exec postgres-0 -- ls -lh ${DATA}/log | tee postgres-log-files.txt`,
      why: 'The server logs take 15G. Since when, and how fast? Keep a copy: freeing space means deleting them.',
      reaches: ['since-tuesday'],
      achieves: { captured: 'log-files' },
    },
    {
      command: `kubectl exec postgres-0 -- cat ${DATA}/postgresql.auto.conf`,
      why: 'Logging this much is not normal. What setting makes PostgreSQL log so much?',
      reaches: ['statement-logging'],
    },
    {
      command: viaShell(`rm ${DATA}/log/*.log`),
      why: 'Stop the harm: the old log files are only records of statements already run. Delete them, and leave pg_wal alone.',
      achieves: { state: ['logs-cleared', 'expanded'] },
    },
  ],
  hints: [
    {
      goal: { finding: 'writes-fail' },
      question: 'Browsing works but carts and checkout fail. What do the failing requests report?',
      playbook: 'what-is-the-application-logging',
      command: 'kubectl logs deployment/pantry-api --tail=20',
    },
    {
      goal: { finding: 'disk-full' },
      question: 'PostgreSQL says there is no space left. Which filesystem is full, and how full?',
      playbook: 'is-a-disk-full',
      command: 'kubectl exec postgres-0 -- df -h',
    },
    {
      goal: { finding: 'log-fills' },
      question: 'The data volume is full. Which directory on it takes the space?',
      playbook: 'what-is-filling-the-disk',
      command: viaShell(`du -sh ${DATA}/*`),
    },
    {
      goal: { captured: 'log-files' },
      question: 'The log directory is huge. Since when has it grown, and how fast? Keep a copy before you free any space.',
      playbook: 'what-is-filling-the-disk',
      command: `kubectl exec postgres-0 -- ls -lh ${DATA}/log | tee postgres-log-files.txt`,
    },
    {
      goal: { finding: 'statement-logging' },
      question: 'PostgreSQL logs about 6 GB a day. Which setting tells it to log so much?',
      playbook: 'what-settings-is-postgresql-running-with',
      command: `kubectl exec postgres-0 -- cat ${DATA}/postgresql.auto.conf`,
    },
    {
      goal: { state: ['logs-cleared', 'expanded'] },
      question: 'Writes fail until there is free space. What can you delete safely, and what must you never delete?',
      playbook: 'how-do-i-free-disk-space-safely',
      command: viaShell(`rm ${DATA}/log/*.log`),
    },
  ],
  rootCauses: [
    {
      id: 'table-growth',
      label: 'The orders and cart tables have grown until they filled the disk.',
      contradictedBy: [{ finding: 'log-fills', why: 'All the tables together take 3.1G of the 20G. The log directory takes 15G.' }],
    },
    {
      id: 'wal-growth',
      label: 'The write-ahead log, pg_wal, has grown until it filled the disk.',
      contradictedBy: [
        { finding: 'log-fills', why: 'pg_wal takes 1.0G, a normal size. It is the log directory, PostgreSQL’s own messages, that takes 15G.' },
      ],
    },
    {
      id: 'statement-logging',
      label:
        'On Tuesday, log_min_duration_statement was set to 0 with the logging collector on, so PostgreSQL logs every statement, about 6 GB a day, onto its own data volume.',
      correct: true,
    },
    {
      id: 'connections',
      label: 'PostgreSQL has run out of connections, so writes are refused.',
      contradictedBy: [
        {
          finding: 'writes-fail',
          why: 'The writes reach PostgreSQL and fail there with "No space left on device", while reads on the same connections succeed.',
        },
      ],
    },
    {
      id: 'bad-release',
      label: 'Thursday’s release, v2.16.2, writes far more data than before.',
      contradictedBy: [
        { finding: 'since-tuesday', why: 'The log files began growing on Tuesday evening, two days before v2.16.2.' },
        { finding: 'statement-logging', why: 'The setting that fills the disk is in PostgreSQL’s own configuration. No release of pantry-api touches it.' },
      ],
    },
  ],
  mitigations: [
    {
      id: 'clear-logs',
      label: 'Delete the old PostgreSQL log files',
      verdict: 'best',
      explanation:
        'They are records of statements already run; the database does not need them. 13 GB comes back at once and writes resume. Save their listing first, then set log_min_duration_statement back before the disk refills in about two days.',
    },
    {
      id: 'expand',
      label: 'Grow the volume to 40Gi',
      verdict: 'works',
      explanation:
        'Writes resume once the filesystem grows, but the logging fills the extra 20 GB in about three days, the volume can never shrink again, and you pay for the space from now on.',
    },
    {
      id: 'reset-setting',
      label: 'Set log_min_duration_statement back to 500ms',
      verdict: 'no-effect',
      explanation: 'It stops the growth but frees nothing, so writes keep failing. It is the right second step, not the first.',
    },
    {
      id: 'delete-wal',
      label: 'Delete pg_wal, the write-ahead log, to free space',
      verdict: 'harmful',
      explanation:
        'pg_wal is not a log of messages: it holds changes not yet safely written into the tables. Deleting it crashes PostgreSQL, which then cannot start, and loses recent orders. It was renamed from pg_xlog for exactly this reason.',
    },
    {
      id: 'restart-database',
      label: 'Restart PostgreSQL',
      verdict: 'harmful',
      explanation:
        'A full disk is still full after a restart, and PostgreSQL may fail to start at all when it cannot write, turning failed writes into a full outage.',
    },
  ],
  postmortem: {
    summary:
      'Debug logging left on after Tuesday’s Slow Query Incident wrote every PostgreSQL statement onto the database’s own volume. It filled on Friday morning, and every write failed for 11 minutes.',
    impact:
      'From 10:06 to 10:17 UTC every request that writes to the database failed with 500: adding to carts, checkout and account changes, about 11% of requests. Browsing and reading carts worked.',
    timeline: [
      {
        at: 'Tue 18:02',
        event:
          'To record every statement for the Slow Query postmortem, a teammate turns on the logging collector with one file a day and sets log_min_duration_statement = 0 with ALTER SYSTEM, then deletes the postgres-0 pod to restart it.',
      },
      { at: 'Wed–Thu', event: 'PostgreSQL writes about 6 GB of logs a day into its data directory. A ticket-level disk warning opens on Wednesday and is not picked up.' },
      { at: '10:06', event: 'The 20Gi volume fills. Every write fails with "No space left on device".' },
      { at: '10:12', event: 'PantryApiHighErrorRate fires. On-call is paged.' },
      { at: '10:15', event: 'On-call finds the volume full and the log directory at 15G, saves the file listing and finds the ALTER SYSTEM settings.' },
      { at: '10:17', event: 'On-call deletes the old log files. 13 GB is freed and writes resume.' },
      { at: '10:25', event: 'After the harm has stopped, log_min_duration_statement is reset to 500ms and the configuration reloaded.' },
    ],
    rootCause:
      'Setting log_min_duration_statement to 0 makes PostgreSQL log every statement, and the logging collector writes those logs into the data directory by default, on the same volume as the tables. The change was meant to last an afternoon and was never reverted, so logs grew by about 6 GB a day until the volume was full.',
    resolution:
      'Deleted the old log files at 10:17 and reset log_min_duration_statement to 500ms at 10:25. The logging collector stays off from the next restart, so logs go to the container output and the cluster’s log store again.',
    actionItems: [
      'Never write logs onto the database’s data volume. Send them to the container output, or to a volume of their own.',
      'Make temporary debug settings expire: note them in the incident channel with an owner and a time to revert.',
      'Page, not ticket, when a database volume will be full within a day at its current rate.',
      'Keep ALTER SYSTEM changes under review: postgresql.auto.conf is configuration nobody sees in source control.',
    ],
  },
  prevention: [
    'Keep logs off the volume your data needs. A log that fills a disk should take only itself down, not every write.',
    'Alert on how soon a disk will be full, not only on how full it is: a steady 6 GB a day is easy to predict days ahead.',
    'Give temporary debugging changes an owner and an end time, and revert them in the same incident they were made for.',
    'Know what in a database directory must never be deleted. pg_wal sounds like logs and is not; the logs live in log.',
  ],
  links: {
    concepts: ['golden-signals-and-alerting', 'working-safely-in-production', 'prevention', 'blameless-postmortems'],
    resources: ['gregg-use-method', 'pg-logging', 'pg-wal-intro', 'pg-alter-system', 'k8s-persistent-volumes'],
  },
})
