// Primary sources only. Every link was opened and answered 200 when it was added (2026-11-15);
// .scratch/debuglab-v1/issues/18-*.md checks them all again before release.

export const subjects = ['Incident response', 'Troubleshooting method', 'Kubernetes', 'Memory and performance', 'Databases', 'Postmortems'] as const
export type Subject = (typeof subjects)[number]

export type Resource = {
  id: string
  title: string
  publisher: string
  url: string
  subject: Subject
  /** One line on why it is worth reading. */
  why: string
}

export const resources: readonly Resource[] = [
  {
    id: 'k8s-debug-pods',
    title: 'Debug Pods',
    publisher: 'Kubernetes documentation',
    url: 'https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/',
    subject: 'Kubernetes',
    why: 'What each pod status means, from Pending to CrashLoopBackOff, and the first command to run for each.',
  },
  {
    id: 'kubectl-quick-reference',
    title: 'kubectl Quick Reference',
    publisher: 'Kubernetes documentation',
    url: 'https://kubernetes.io/docs/reference/kubectl/quick-reference/',
    subject: 'Kubernetes',
    why: 'The everyday kubectl commands on one page, including logs, exec, rollouts and output formats, to keep open while you work.',
  },
  {
    id: 'sre-managing-incidents',
    title: 'Managing Incidents',
    publisher: 'Google, Site Reliability Engineering',
    url: 'https://sre.google/sre-book/managing-incidents/',
    subject: 'Incident response',
    why: 'Follows one badly run incident and the same incident run well, and explains the roles that made the difference.',
  },
  {
    id: 'sre-emergency-response',
    title: 'Emergency Response',
    publisher: 'Google, Site Reliability Engineering',
    url: 'https://sre.google/sre-book/emergency-response/',
    subject: 'Incident response',
    why: 'Real outages at Google, what the responders did and what they learned, including when undoing a change was the right first move.',
  },
  {
    id: 'sre-workbook-incident-response',
    title: 'Incident Response',
    publisher: 'Google, The Site Reliability Workbook',
    url: 'https://sre.google/workbook/incident-response/',
    subject: 'Incident response',
    why: 'Case studies from several companies on putting incident response into practice, with the mistakes they made on the way.',
  },
  {
    id: 'pagerduty-during',
    title: 'During an Incident',
    publisher: 'PagerDuty Incident Response',
    url: 'https://response.pagerduty.com/during/during_an_incident/',
    subject: 'Incident response',
    why: 'A step-by-step guide for the first minutes of an incident, written to be followed under pressure.',
  },
  {
    id: 'sre-troubleshooting',
    title: 'Effective Troubleshooting',
    publisher: 'Google, Site Reliability Engineering',
    url: 'https://sre.google/sre-book/effective-troubleshooting/',
    subject: 'Troubleshooting method',
    why: 'The method this site teaches: form a hypothesis, test it, and avoid the traps that send investigations in circles.',
  },
  {
    id: 'gregg-methodology',
    title: 'Performance Analysis Methodology',
    publisher: 'Brendan Gregg',
    url: 'https://www.brendangregg.com/methodology.html',
    subject: 'Troubleshooting method',
    why: 'Names the anti-methods everyone falls into, such as changing things at random, and the methods that replace them.',
  },
  {
    id: 'k8s-deployment',
    title: 'Deployments',
    publisher: 'Kubernetes documentation',
    url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/',
    subject: 'Kubernetes',
    why: 'How rollouts, revisions and rollbacks actually work, which is what you are relying on when you undo a release.',
  },
  {
    id: 'k8s-logging',
    title: 'Logging Architecture',
    publisher: 'Kubernetes documentation',
    url: 'https://kubernetes.io/docs/concepts/cluster-administration/logging/',
    subject: 'Kubernetes',
    why: 'Explains where container logs live and why they disappear with the pod, the reason Evidence must be saved first.',
  },
  {
    id: 'k8s-pod-failure-reason',
    title: 'Determine the Reason for Pod Failure',
    publisher: 'Kubernetes documentation',
    url: 'https://kubernetes.io/docs/tasks/debug/debug-application/determine-reason-pod-failure/',
    subject: 'Kubernetes',
    why: 'Where Kubernetes records why a container stopped, and how an application can leave its own last words there for you to read.',
  },
  {
    id: 'k8s-assign-memory',
    title: 'Assign Memory Resources to Containers and Pods',
    publisher: 'Kubernetes documentation',
    url: 'https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/',
    subject: 'Kubernetes',
    why: 'Walks a container past its memory limit until it is OOMKilled, so you recognise exactly what that looks like in kubectl.',
  },
  {
    id: 'k8s-manage-resources',
    title: 'Resource Management for Pods and Containers',
    publisher: 'Kubernetes documentation',
    url: 'https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/',
    subject: 'Kubernetes',
    why: 'What requests and limits mean, and why crossing a CPU limit slows a container while crossing a memory limit kills it.',
  },
  {
    id: 'nodejs-memory-diagnostics',
    title: 'Memory Diagnostics',
    publisher: 'Node.js',
    url: 'https://nodejs.org/en/learn/diagnostics/memory',
    subject: 'Memory and performance',
    why: 'The official guide to finding a Node.js memory leak: heap snapshots, heap profiling and garbage collection traces, and what each costs.',
  },
  {
    id: 'gregg-memory-leaks',
    title: 'Memory Leak (and Growth) Flame Graphs',
    publisher: 'Brendan Gregg',
    url: 'https://www.brendangregg.com/FlameGraphs/memoryflamegraphs.html',
    subject: 'Memory and performance',
    why: 'Compares the ways to find what is growing in a running process, with an honest account of how much each slows production down.',
  },
  {
    id: 'pg-monitoring-stats',
    title: 'The Cumulative Statistics System',
    publisher: 'PostgreSQL documentation',
    url: 'https://www.postgresql.org/docs/current/monitoring-stats.html',
    subject: 'Databases',
    why: 'Documents pg_stat_activity column by column, including every wait event, so you can tell a busy database from a blocked one.',
  },
  {
    id: 'pg-logging',
    title: 'Error Reporting and Logging',
    publisher: 'PostgreSQL documentation',
    url: 'https://www.postgresql.org/docs/current/runtime-config-logging.html',
    subject: 'Databases',
    why: 'How to turn on the slow query log (log_min_duration_statement) and log schema changes, the two settings that solved this Incident fastest.',
  },
  {
    id: 'pg-using-explain',
    title: 'Using EXPLAIN',
    publisher: 'PostgreSQL documentation',
    url: 'https://www.postgresql.org/docs/current/using-explain.html',
    subject: 'Databases',
    why: 'Teaches you to read a query plan: scans, joins, estimated against actual rows, and why EXPLAIN ANALYZE really runs the query.',
  },
  {
    id: 'pg-indexes',
    title: 'Indexes',
    publisher: 'PostgreSQL documentation',
    url: 'https://www.postgresql.org/docs/current/indexes.html',
    subject: 'Databases',
    why: 'What an index is, which queries can use one, and what every index costs on writes. Read it before adding or dropping one.',
  },
  {
    id: 'pg-create-index',
    title: 'CREATE INDEX',
    publisher: 'PostgreSQL documentation',
    url: 'https://www.postgresql.org/docs/current/sql-createindex.html',
    subject: 'Databases',
    why: 'Its section on building indexes concurrently explains the lock a plain build takes, and what to do when a concurrent build leaves an invalid index.',
  },
  {
    id: 'sre-postmortem-culture',
    title: 'Postmortem Culture: Learning from Failure',
    publisher: 'Google, Site Reliability Engineering',
    url: 'https://sre.google/sre-book/postmortem-culture/',
    subject: 'Postmortems',
    why: 'What a blameless postmortem is for, when to write one and how to make sure its action items happen.',
  },
]

export const resourceById = (id: string) => resources.find((r) => r.id === id)
