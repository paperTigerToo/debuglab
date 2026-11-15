// The single source for every tooltip. A term is explained once here and shown the same way
// wherever it appears: in prose, in commands and in simulated terminal output.

export type Term = {
  /** Stable identifier. */
  id: string
  /** Every spelling that should show this term's tooltip, matched as whole words and case-sensitively. */
  matches: readonly string[]
  /** One or two plain sentences. */
  explanation: string
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
    matches: ['Incident', 'Incidents', 'incident'],
    explanation: 'One scripted failure of the Target System that you work through from first Symptom to Root Cause.',
  },
  {
    id: 'symptom',
    matches: ['Symptom', 'Symptoms'],
    explanation:
      'Something you are shown at the start of an Incident or uncover during it: an alert, a graph, a log line or command output.',
  },
  {
    id: 'mitigation',
    matches: ['Mitigation', 'Mitigations', 'mitigation', 'mitigate'],
    explanation:
      'An action that stops user harm without explaining the failure, such as a rollback or turning a feature flag off. Mitigate first, then find the Root Cause.',
  },
  {
    id: 'root-cause',
    matches: ['Root Cause', 'root cause'],
    explanation: "The specific defect or condition that produced the Incident's Symptoms. Identifying it is what completes the investigation.",
  },
  {
    id: 'finding',
    matches: ['Finding', 'Findings'],
    explanation: 'A key fact about an Incident that you establish by seeing it in command output, such as "the pods are twelve minutes old".',
  },
  {
    id: 'evidence',
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
    id: 'alert',
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
    matches: ['rollout history'],
    explanation: 'Lists a Deployment\'s revisions. Add --revision=N to see exactly what one contained.',
  },
  {
    id: 'rollout-undo',
    matches: ['rollout undo'],
    explanation: 'Rolls a Deployment back to its previous revision. Changes the system: the current pods are replaced.',
  },
  {
    id: 'rollback',
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
  { id: 'status-503', matches: ['503'], explanation: 'HTTP 503 Service Unavailable: nothing could answer, for example because no pods were running.' },
  {
    id: 'percentile',
    matches: ['95th percentile', 'p95'],
    explanation: '95% of requests were faster than this. Percentiles show the slow tail that an average hides.',
  },
  { id: 'latency', matches: ['Latency', 'latency'], explanation: 'How long a request takes from arriving to being answered.' },
  {
    id: 'saturation',
    matches: ['Saturation', 'saturation'],
    explanation: 'How full a resource is, such as CPU against its limit. Near 100% means work starts to queue.',
  },
  { id: 'request-rate', matches: ['Request rate', 'req/s'], explanation: 'How many requests arrive per second: the traffic signal.' },
  { id: 'error-rate', matches: ['Error rate'], explanation: 'The share of requests that failed, usually those answered with a 5xx.' },
  {
    id: 'golden-signals',
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
  { id: 'canary', matches: ['canary'], explanation: 'Sending a small share of traffic to a new version first, so a bad release harms few people.' },
]
