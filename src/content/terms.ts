// The single source for every tooltip. A term is explained once here and shown the same way
// wherever it appears: in prose, in commands and in simulated terminal output.

export type Term = {
  /** Stable identifier. */
  id: string
  /** Every spelling that should show this term's tooltip, matched as whole words and case-sensitively. */
  matches: readonly string[]
  /** One or two plain sentences. */
  explanation: string
  /** The Concept that explains this term in full, linked from its tooltip. */
  concept?: string
  /** Or the Playbook Entry that puts it into practice, linked from its tooltip. A term links to one or the other. */
  playbook?: string
}

export const terms: readonly Term[] = [
  // --- DebugLab's own words, worded as in GLOSSARY.md -----------------------------------------
  {
    id: 'target-system',
    matches: ['Target System'],
    explanation: 'The single fictional web service every Incident happens to: an HTTP API with a database, a cache and a load balancer.',
  },
  {
    id: 'incident',
    concept: 'incident-lifecycle',
    matches: ['Incident', 'Incidents'],
    explanation: 'One scripted failure of the Target System that you work through from first Symptom to Root Cause.',
  },
  {
    id: 'symptom',
    concept: 'investigating-by-hypothesis',
    matches: ['Symptom', 'Symptoms'],
    explanation:
      'Something you are shown at the start of an Incident or uncover during it: an alert, a graph, a log line or command output.',
  },
  {
    id: 'mitigation',
    concept: 'mitigate-then-investigate',
    matches: ['Mitigation', 'Mitigations', 'mitigation', 'mitigate'],
    explanation:
      'An action that stops user harm without explaining the failure, such as a rollback or turning a feature flag off. Mitigate first, then find the Root Cause.',
  },
  {
    id: 'root-cause',
    concept: 'investigating-by-hypothesis',
    matches: ['Root Cause', 'root cause'],
    explanation: "The specific defect or condition that produced the Incident's Symptoms. Identifying it is what completes the investigation.",
  },
  {
    id: 'finding',
    concept: 'investigating-by-hypothesis',
    matches: ['Finding', 'Findings'],
    explanation: 'A key fact about an Incident that you establish by seeing it in command output, such as "the pods are twelve minutes old".',
  },
  {
    id: 'evidence',
    concept: 'mitigate-then-investigate',
    matches: ['Evidence', 'evidence'],
    explanation:
      'Perishable output that shows why the Target System failed, such as the logs of pods a rollback will replace. Save it before a Mitigation destroys it.',
  },
  {
    id: 'hint',
    matches: ['Hint', 'Hints'],
    explanation: 'Graduated help in three tiers: the question to ask, the Playbook Entry that answers it, then the exact command.',
  },
  {
    id: 'playbook-entry',
    matches: ['Playbook Entry', 'Playbook Entries'],
    explanation: 'One granular investigative question with the real commands that answer it and their annotated output.',
  },
  {
    id: 'expert-path',
    matches: ['Expert Path'],
    explanation: 'The reference sequence of commands that takes an Incident from first Symptom to Root Cause, for comparing with your own.',
  },
  {
    id: 'debrief',
    matches: ['Debrief'],
    explanation:
      'The review shown when an Incident ends: your commands beside the Expert Path, the Evidence an early Mitigation destroyed, and a sample postmortem.',
  },

  // --- Incident response --------------------------------------------------------------------
  {
    // The everyday sense, as opposed to DebugLab's scripted Incident above.
    id: 'incident-general',
    concept: 'incident-lifecycle',
    matches: ['incident', 'incidents'],
    explanation: 'An unplanned event that harms the people using a service and needs a response now. Each Incident in DebugLab is a scripted one.',
  },
  {
    id: 'alert',
    concept: 'incident-lifecycle',
    matches: ['alert'],
    explanation: 'An automatic notification sent when a measured signal crosses a threshold for long enough.',
  },
  {
    id: 'paged',
    matches: ['paged'],
    explanation: 'Notified by the on-call system, usually on your phone, that an alert needs a person now.',
  },
  {
    id: 'postmortem',
    concept: 'blameless-postmortems',
    matches: ['postmortem'],
    explanation: 'A written review after an Incident: what happened, why, and what will change. Blameless: it studies the system, not people.',
  },

  // --- Kubernetes ---------------------------------------------------------------------------
  {
    id: 'kubectl',
    matches: ['kubectl'],
    explanation: 'The command-line tool for Kubernetes. It reads and changes what is running in the cluster.',
  },
  {
    id: 'kubernetes',
    matches: ['Kubernetes'],
    explanation: 'A system that runs containers across many machines, restarts them when they fail and rolls out new versions.',
  },
  {
    id: 'pod',
    matches: ['pod', 'pods', 'Pod', 'Pods'],
    explanation: 'The smallest unit Kubernetes runs: one or more containers sharing a network address. Pods are replaced, not repaired.',
  },
  {
    id: 'container',
    matches: ['container', 'containers'],
    explanation: 'A packaged process with its own filesystem. Anything written inside it disappears when it is replaced.',
  },
  {
    id: 'deployment',
    matches: ['Deployment', 'deployment', 'deployments'],
    explanation: 'A Kubernetes object that keeps a set number of identical pods running and rolls out new versions of them.',
  },
  {
    id: 'deploy',
    matches: ['deploy', 'deploys'],
    explanation: 'Releasing a new version. In kubectl commands, deploy is also short for deployment.',
  },
  {
    id: 'replicaset',
    matches: ['ReplicaSet', 'replicasets', 'replica set'],
    explanation: 'The set of identical pods for one version of a Deployment. A rollout scales the new one up and the old one down.',
  },
  {
    id: 'namespace',
    matches: ['namespace'],
    explanation: 'A named group of Kubernetes resources. Your kubectl context points at one, so you need not type -n every time.',
  },
  {
    id: 'node',
    matches: ['nodes', 'NODE'],
    explanation: 'One machine in the cluster. Pods are scheduled onto nodes.',
  },
  {
    id: 'revision',
    matches: ['revision', 'REVISION'],
    explanation: 'A numbered version of a Deployment\'s pod template. Every rollout, a rollback included, records a new number.',
  },
  {
    id: 'change-cause',
    matches: ['CHANGE-CAUSE', 'change-cause'],
    explanation: 'Why a revision was made, read from its kubernetes.io/change-cause annotation. Empty unless someone set it.',
  },
  {
    id: 'rollout',
    matches: ['rollout'],
    explanation: 'Replacing a Deployment\'s pods with a new version, a few at a time.',
  },
  {
    id: 'rollout-history',
    playbook: 'what-was-deployed',
    matches: ['rollout history'],
    explanation: 'Lists a Deployment\'s revisions. Add --revision=N to see exactly what one contained.',
  },
  {
    id: 'rollout-undo',
    playbook: 'how-do-i-roll-back-a-deployment',
    matches: ['rollout undo'],
    explanation: 'Rolls a Deployment back to its previous revision. Changes the system: the current pods are replaced.',
  },
  {
    id: 'rollback',
    concept: 'mitigate-then-investigate',
    matches: ['rollback', 'roll back', 'rolled back'],
    explanation: 'Returning to the last version that worked. Usually the fastest safe Mitigation after a bad deploy.',
  },
  {
    id: 'describe',
    matches: ['describe'],
    explanation: 'kubectl describe shows everything about one resource, including its configuration and recent events. Read-only.',
  },
  {
    id: 'logs',
    playbook: 'what-is-the-application-logging',
    matches: ['logs'],
    explanation: "Lines a program writes about what it is doing. kubectl logs prints a container's, and they last only as long as its pod.",
  },
  {
    id: 'exec',
    matches: ['exec'],
    explanation: 'kubectl exec runs a command inside a running container. With -it and a shell, it opens an interactive shell there.',
  },
  {
    id: 'events',
    matches: ['events'],
    explanation: 'Recent things Kubernetes did or noticed: pods scheduled, started, killed, probes failing. Kept for about an hour.',
  },
  {
    id: 'running',
    matches: ['Running'],
    explanation: 'The pod\'s containers have started (in kubectl output). It says nothing about whether they answer requests correctly.',
  },
  {
    id: 'ready',
    matches: ['READY', 'Ready'],
    explanation: 'In kubectl output: whether the containers pass their readiness probe. Only ready pods receive traffic.',
  },
  {
    id: 'restarts',
    matches: ['RESTARTS', 'Restart Count'],
    explanation: 'How many times a container was restarted after exiting or failing its liveness probe. A rising count means a crash loop.',
  },
  {
    id: 'age',
    matches: ['AGE'],
    explanation: 'How long ago the resource was created. Young pods mean something replaced them recently.',
  },
  {
    id: 'liveness',
    matches: ['Liveness'],
    explanation: 'A check Kubernetes runs on a container; after enough failures it restarts the container.',
  },
  {
    id: 'readiness',
    matches: ['Readiness'],
    explanation: 'A check deciding whether a container receives traffic. Passing it only proves what the check tests.',
  },
  {
    id: 'killing',
    matches: ['Killing'],
    explanation: 'Kubernetes is stopping a container, for example because a rollout replaced its pod.',
  },
  {
    id: 'oomkilled',
    playbook: 'why-does-this-container-keep-restarting',
    matches: ['OOMKilled'],
    explanation: 'The kernel killed the container for using more memory than its limit. Kubernetes restarts it, and everything it held in memory is gone.',
  },
  {
    id: 'last-state',
    matches: ['Last State'],
    explanation: 'How the container’s previous run ended, with a reason and an exit code. After a restart, it is where the cause is kept.',
  },
  {
    id: 'exit-code',
    matches: ['Exit Code', '137'],
    explanation: 'The number a process ended with. 0 means success; 137 is 128 + 9, killed with SIGKILL, usually for memory.',
  },
  {
    id: 'limits',
    matches: ['Limits'],
    explanation: 'The most CPU and memory a container may use. Crossing the CPU limit slows it down; crossing the memory limit gets it killed.',
  },
  {
    id: 'requests',
    matches: ['Requests'],
    explanation: 'The CPU and memory Kubernetes reserves for a container when it chooses a node. A container may use more, up to its limit.',
  },
  {
    id: 'kubectl-top',
    playbook: 'what-is-using-cpu-and-memory',
    matches: ['kubectl top'],
    explanation: 'Shows the CPU and memory pods or nodes are using now, as last sampled by the cluster’s metrics server. 1000m is one CPU core.',
  },
  {
    id: 'rollout-restart',
    matches: ['rollout restart'],
    explanation: 'Replaces every pod of a Deployment with a fresh one running the same release. Whatever the old processes held in memory is lost.',
  },
  {
    id: 'statefulset',
    matches: ['StatefulSet', 'statefulset'],
    explanation: 'Runs pods that need a stable name and their own disk, such as a database. postgres-0 keeps its name and data across restarts.',
  },
  {
    id: 'scaling-replicaset',
    matches: ['ScalingReplicaSet'],
    explanation: 'A Deployment changed how many pods a ReplicaSet runs. During a rollout the new one grows as the old one shrinks.',
  },

  // --- Flags --------------------------------------------------------------------------------
  { id: 'flag-n', matches: ['-n', '--namespace'], explanation: 'Which namespace to look in. Optional when your context already points there.' },
  { id: 'flag-tail', matches: ['--tail'], explanation: 'Show only the last N lines of the logs.' },
  { id: 'flag-o', matches: ['-o', '--output'], explanation: 'Output format. -o wide adds columns such as the pod IP and node.' },
  { id: 'flag-it', matches: ['-it'], explanation: '-i keeps input open and -t gives you a terminal: together they make an interactive shell.' },
  { id: 'flag-revision', matches: ['--revision'], explanation: 'Show the pod template of one revision: image, configuration and probes.' },
  { id: 'flag-previous', matches: ['--previous'], explanation: 'For kubectl logs: show the logs of the container’s previous run, the one that crashed or was killed.' },
  { id: 'flag-to-revision', matches: ['--to-revision'], explanation: 'Roll back to this revision instead of the previous one.' },
  { id: 'flag-grep-i', matches: ['-i'], explanation: 'For grep: ignore case. For kubectl exec: keep input open.' },
  { id: 'double-dash', matches: ['--'], explanation: 'Everything after -- is the command to run in the container, not options for kubectl.' },

  // --- Linux and shell ----------------------------------------------------------------------
  { id: 'grep', matches: ['grep'], explanation: 'Prints only the lines that contain a pattern. Read-only.' },
  { id: 'tee', matches: ['tee'], explanation: 'Shows output on screen and saves a copy to a file at the same time.' },
  { id: 'env', matches: ['env', 'printenv'], explanation: 'Prints the environment variables a process sees, which is where most services read their configuration.' },
  { id: 'curl', matches: ['curl'], explanation: 'Sends an HTTP request and prints the response.' },
  { id: 'ps', matches: ['ps'], explanation: 'Lists running processes. ps aux shows every process with its CPU and memory use.' },
  { id: 'df', matches: ['df'], explanation: 'Shows how full each filesystem is. -h prints sizes in K, M and G.' },

  // --- HTTP, signals and the Target System --------------------------------------------------
  { id: '5xx', matches: ['5xx'], explanation: 'HTTP status codes from 500 to 599: the service failed to answer. 4xx codes mean the request itself was wrong.' },
  { id: 'status-500', matches: ['500'], explanation: 'HTTP 500 Internal Server Error: the service hit an error it did not handle.' },
  { id: 'status-502', matches: ['502'], explanation: 'HTTP 502 Bad Gateway: the load balancer got no proper answer from the pod, for example because it died mid-request.' },
  { id: 'status-504', matches: ['504'], explanation: 'HTTP 504 Gateway Timeout: the load balancer gave up waiting for the pod to answer.' },
  { id: 'status-503', matches: ['503'], explanation: 'HTTP 503 Service Unavailable: nothing could answer, for example because no pods were running.' },
  {
    id: 'percentile',
    matches: ['95th percentile', 'p95'],
    explanation: '95% of requests were faster than this. Percentiles show the slow tail that an average hides.',
  },
  { id: 'latency', matches: ['Latency', 'latency'], explanation: 'How long a request takes from arriving to being answered.' },
  {
    id: 'saturation',
    concept: 'golden-signals-and-alerting',
    matches: ['Saturation', 'saturation'],
    explanation: 'How full a resource is, such as CPU against its limit. Near 100% means work starts to queue.',
  },
  { id: 'request-rate', matches: ['Request rate', 'req/s'], explanation: 'How many requests arrive per second: the traffic signal.' },
  { id: 'error-rate', matches: ['Error rate'], explanation: 'The share of requests that failed, usually those answered with a 5xx.' },
  {
    id: 'golden-signals',
    concept: 'golden-signals-and-alerting',
    matches: ['golden signals', 'Golden signals'],
    explanation: 'Traffic, errors, latency and saturation: the four measurements that describe most services\' health.',
  },
  { id: 'nginx', matches: ['nginx'], explanation: 'A web server used here as the load balancer: it receives every request and forwards it to a pod.' },
  { id: 'load-balancer', matches: ['load balancer'], explanation: 'Spreads incoming requests across the healthy pods.' },
  { id: 'upstream', matches: ['upstream'], explanation: 'In the access log: the pod address the load balancer forwarded a request to.' },
  { id: 'healthz', matches: ['/healthz', 'health checks', 'health check'], explanation: 'An endpoint that reports whether the service is up. It only proves what it checks.' },
  { id: 'postgresql', matches: ['PostgreSQL', 'postgres'], explanation: 'The relational database the Target System stores orders and products in.' },
  { id: 'redis', matches: ['Redis', 'redis'], explanation: 'An in-memory store the Target System uses as a cache.' },
  {
    id: 'err-invalid-url',
    matches: ['ERR_INVALID_URL', 'Invalid URL'],
    explanation: 'Node.js could not build a URL from the text it was given. For example, text that began with "undefined".',
  },
  { id: 'type-error', matches: ['TypeError'], explanation: 'A JavaScript error: a value was not the type the code expected.' },
  { id: 'env-var', matches: ['PAYMENTS_URL', 'PAYMENT_SERVICE_URL'], explanation: 'An environment variable for the payments service address. The name the code reads must match the name that is set.' },
  {
    id: 'memory-leak',
    matches: ['leak', 'leaks', 'leaking'],
    explanation: 'Memory a program keeps holding after it stops needing it, so its use grows until something runs out.',
  },
  {
    id: 'heap',
    matches: ['heap'],
    explanation: 'The memory a program keeps its objects in. Node.js frees objects nothing refers to any more; anything still referenced stays.',
  },
  {
    id: 'pool',
    matches: ['pool'],
    explanation: 'Database connections a service keeps open and shares between requests. When every one is busy, new requests wait for one.',
  },

  // --- PostgreSQL ---------------------------------------------------------------------------
  { id: 'psql', matches: ['psql'], explanation: 'PostgreSQL’s command-line client. -U names the database user and -c runs one statement and prints the result.' },
  {
    id: 'pg-stat-activity',
    playbook: 'what-is-the-database-doing-right-now',
    matches: ['pg_stat_activity'],
    explanation: 'A built-in view with one row per database connection: what it is running, since when, and what it is waiting for.',
  },
  {
    id: 'wait-event',
    matches: ['wait_event'],
    explanation: 'What a PostgreSQL connection is waiting for: reading data, a lock, the client. Empty means it is busy on the CPU.',
  },
  {
    id: 'explain',
    playbook: 'why-is-this-query-slow',
    matches: ['EXPLAIN', 'EXPLAIN ANALYZE'],
    explanation: 'Shows how PostgreSQL will run a query. EXPLAIN ANALYZE also runs it and reports the real time each step took.',
  },
  {
    id: 'seq-scan',
    matches: ['Seq Scan', 'Parallel Seq Scan'],
    explanation: 'Reading every row of a table to find the ones that match. Fine for small tables; slow for millions of rows.',
  },
  {
    id: 'index-scan',
    matches: ['Index Scan'],
    explanation: 'Finding matching rows through an index, reading only those rows instead of the whole table.',
  },
  {
    id: 'indexes',
    matches: ['Indexes'],
    explanation: 'A table’s lookup structures. Each lets the database find rows by a column’s value without reading every row.',
  },
  {
    id: 'concurrently',
    playbook: 'how-do-i-add-an-index-without-blocking-writes',
    matches: ['CONCURRENTLY'],
    explanation: 'Builds or drops an index without locking the table against writes. Slower, and it cannot run inside a transaction.',
  },
  {
    id: 'migration',
    matches: ['migration', 'migrations', 'Migration'],
    explanation: 'A versioned script that changes the database’s structure as part of a release. Rolling back the code does not undo it.',
  },
  {
    id: 'slow-query-log',
    playbook: 'which-queries-are-slow',
    matches: ['log_min_duration_statement'],
    explanation: 'A PostgreSQL setting: log every statement slower than this, with how long it took. It turns on the slow query log.',
  },
  {
    id: 'payments-timeout',
    matches: ['PAYMENTS_TIMEOUT_MS'],
    explanation: 'How long pantry-api waits for the payments service before giving up, in milliseconds.',
  },
  {
    id: 'pool-settings',
    matches: ['DB_POOL_SIZE', 'DB_POOL_ACQUIRE_TIMEOUT_MS'],
    explanation: 'The number of database connections in pantry-api’s pool, and how long a request waits for a free one before failing.',
  },
  {
    id: 'checkout-enabled',
    matches: ['CHECKOUT_ENABLED'],
    explanation: 'A feature flag: set it to false to switch checkout off without a release, while the rest of the site keeps working.',
  },
  {
    id: 'circuit-breaker',
    matches: ['circuit breaker'],
    explanation: 'Stops calling a dependency that keeps failing or timing out, for a while, so callers fail fast instead of waiting on it.',
  },
  {
    id: 'kubectl-set-env',
    playbook: 'how-do-i-change-a-setting-without-a-release',
    matches: ['kubectl set env', 'set env'],
    explanation: 'Changes an environment variable on a Deployment. Kubernetes rolls out new pods to apply it.',
  },
  {
    id: 'idle-in-transaction',
    playbook: 'what-is-the-database-doing-right-now',
    matches: ['idle in transaction'],
    explanation: 'A connection inside an open transaction that is not running anything: the client is busy elsewhere, still holding it.',
  },
  {
    id: 'xact-start',
    matches: ['xact_start'],
    explanation: 'When the connection’s current transaction began. now() - xact_start is how long it has been open.',
  },
  {
    id: 'max-connections',
    matches: ['max_connections'],
    explanation: 'The most connections PostgreSQL accepts at once. Past it, every new connection is refused, from any client.',
  },
  { id: 'du', matches: ['du'], explanation: 'Measures how much space files and directories take. du -sh DIR/* gives one total per entry, in K, M and G.' },
  {
    id: 'no-space',
    playbook: 'is-a-disk-full',
    matches: ['No space left on device'],
    explanation: 'The operating system refused a write because the filesystem is full, or has run out of inodes.',
  },
  {
    id: 'pvc',
    matches: ['PersistentVolumeClaim', 'pvc', 'PVC'],
    explanation: 'A pod’s request for a disk that outlives the pod. It has a size, and some storage classes let it grow but never shrink.',
  },
  {
    id: 'pg-wal',
    matches: ['pg_wal', 'write-ahead log'],
    explanation: 'PostgreSQL’s record of changes not yet safely in the tables. Not a log of messages: deleting it crashes the database and loses data.',
  },
  {
    id: 'logging-collector',
    matches: ['logging_collector', 'logging collector'],
    explanation: 'Makes PostgreSQL write its logs to files, by default in the data directory, instead of to the container output.',
  },
  {
    id: 'alter-system',
    playbook: 'what-settings-is-postgresql-running-with',
    matches: ['ALTER SYSTEM', 'postgresql.auto.conf'],
    explanation: 'Changes a PostgreSQL setting from SQL, saved in postgresql.auto.conf in the data directory, where no manifest shows it.',
  },
  {
    id: 'slo',
    concept: 'golden-signals-and-alerting',
    matches: ['SLO', 'SLOs', 'service level objective'],
    explanation: 'A target for how well a service must work, such as 99.9% of requests succeeding over 30 days.',
  },
  {
    id: 'error-budget',
    concept: 'golden-signals-and-alerting',
    matches: ['error budget'],
    explanation: 'What an objective leaves over: at 99.9% over 30 days, about 43 minutes of complete outage. Incidents spend it.',
  },
  {
    id: 'observability',
    concept: 'observability',
    matches: ['observability', 'Observability'],
    explanation: 'How well you can tell what a system is doing from what it emits: its logs, metrics and traces.',
  },
  {
    id: 'trace',
    concept: 'observability',
    matches: ['traces', 'a trace', 'A trace'],
    explanation: 'The path of one request through every service it touches, with the time spent in each step.',
  },
  {
    id: 'feature-flag',
    concept: 'prevention',
    matches: ['feature flag', 'feature flags'],
    explanation: 'A switch that turns code on or off for some or all users without a release.',
  },
  {
    id: 'blast-radius',
    concept: 'working-safely-in-production',
    matches: ['blast radius'],
    explanation: 'How much a change can break if it goes wrong: one pod, one Deployment, or the whole site.',
  },
  { id: 'canary', concept: 'prevention', matches: ['canary'], explanation: 'Sending a small share of traffic to a new version first, so a bad release harms few people.' },
]
