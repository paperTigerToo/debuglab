import { linksIn } from './prose'

// The broad ideas. Each Concept is a short summary, a few paragraphs that cite Resources inline as
// [text](resource:id), and an interactive example. Incidents that exercise a Concept name it in their
// own links, so the Concept page lists them without keeping a second copy here.

export type Concept = {
  id: string
  title: string
  /** One or two sentences: the idea in brief. Shown on the Concepts list and at the top of the page. Plain text, no links. */
  summary: string
  /** Short paragraphs. Links are written [text](kind:id). */
  body: readonly string[]
  /** Which interactive example the page shows. */
  example: 'lifecycle' | 'mitigate-first' | 'hypothesis' | 'observability' | 'alerting' | 'working-safely' | 'prevention' | 'postmortem'
}

export const concepts: readonly Concept[] = [
  {
    id: 'incident-lifecycle',
    title: 'The incident lifecycle',
    summary:
      'Every incident moves through the same six stages: detect, triage, mitigate, investigate, resolve and review. Knowing which stage you are in tells you what to do next.',
    body: [
      'An alert, a customer report or a graph that looks wrong starts the clock. Triage decides how bad it is and who needs to know: how many users are affected, since when, and whether it is getting worse. On Kubernetes the first look is usually [Are the pods running, and since when?](playbook:are-the-pods-running)',
      'Then the order matters. You mitigate before you investigate, because every minute spent finding the Root Cause is a minute users are still being harmed. [Mitigate first, then investigate](concept:mitigate-then-investigate) explains why, and how not to destroy the Evidence on the way.',
      'Once the harm has stopped, you investigate until you can name the Root Cause, then resolve it properly: a fix that is reviewed, tested and released like any other change. [During an Incident](resource:pagerduty-during) is a good guide to the first minutes; [Managing Incidents](resource:sre-managing-incidents) shows what changes when several people are involved.',
      'Review closes the loop. A [blameless postmortem](concept:blameless-postmortems) records what happened, why, and what will change so it does not happen again. [Postmortem Culture](resource:sre-postmortem-culture) explains what makes one worth writing.',
    ],
    example: 'lifecycle',
  },
  {
    id: 'mitigate-then-investigate',
    title: 'Mitigate first, then investigate',
    summary:
      'Stop the harm before you look for the cause, but save the Evidence a Mitigation would destroy first. Usually that takes one extra command and about a minute.',
    body: [
      'A Mitigation stops users being harmed without explaining why they were. After a bad release the usual one is a rollback; others are turning a feature flag off, moving traffic away from a broken zone, or adding capacity.',
      'Investigating first feels responsible, but users pay for every minute of it. [Effective Troubleshooting](resource:sre-troubleshooting) puts it plainly: stopping the bleeding comes first, because you are not helping users while you hunt for the cause. For how this plays out in real incidents, read [Emergency Response](resource:sre-emergency-response) and [the Site Reliability Workbook](resource:sre-workbook-incident-response).',
      'The catch is that a Mitigation often destroys what you need to find the cause. A rollback replaces the pods, and the logs inside them go with them: [Logging Architecture](resource:k8s-logging) explains why. So before you change anything, ask what will be lost, and save it to a file: [How do I keep the Evidence before changing anything?](playbook:how-do-i-keep-the-evidence) has the commands. Then mitigate.',
      'Rolling back is safe only because Kubernetes keeps earlier revisions of a Deployment; [Deployments](resource:k8s-deployment) explains rollouts and rollbacks in detail, and [How do I roll back a Deployment?](playbook:how-do-i-roll-back-a-deployment) gives the commands.',
    ],
    example: 'mitigate-first',
  },
  {
    id: 'observability',
    title: 'Observability: logs, metrics and traces',
    summary:
      'Logs tell you what happened to one request, metrics tell you how much and how often, and traces tell you where the time went. Each answers questions the others cannot.',
    body: [
      'A log is a record of one event, written by the code that saw it: a request completed, a query failed, a setting was missing. Logs carry detail, such as the exact error and the values involved, so they answer "why did this fail?". They are also the most expensive signal to keep, and on Kubernetes they vanish with the pod unless something ships them elsewhere: [What is the application logging?](playbook:what-is-the-application-logging)',
      'A metric is a number measured over time: requests per second, errors as a share of requests, memory in use. Metrics are cheap to keep for months and quick to graph, so they answer "is it worse than usual, and since when?". They cannot tell you which request failed or why. [What is the process holding in memory?](playbook:what-is-the-process-holding-in-memory) reads metrics a process publishes about itself.',
      'A trace follows one request through every service it touches, timing each step. It answers "where did the time go?", which neither logs nor metrics can when a request crosses several services. The [Observability primer](resource:otel-observability-primer) from OpenTelemetry explains all three signals and how they connect.',
      'In practice you move between them. A metric tells you something is wrong and when it started, logs from that moment tell you what the failures say, and a trace shows which hop is slow. When one signal is missing, as traces are in this lab, you reason from the others, as in [Connection Pool Exhaustion](incident:connection-pool-exhaustion).',
    ],
    example: 'observability',
  },
  {
    id: 'golden-signals-and-alerting',
    title: 'Golden signals, SLOs and alerting',
    summary:
      'Four measurements describe most services: traffic, errors, latency and saturation. An objective says how good is good enough, and an alert pages a person only when users are being harmed.',
    body: [
      'The golden signals are the first four graphs on any dashboard. Traffic is how much is being asked of the service. Errors are how much of it fails. Latency is how long it takes, best read as a percentile, because an average hides the slow tail. Saturation is how full the scarcest resource is: CPU, memory, database connections or disk. [Monitoring Distributed Systems](resource:sre-monitoring-distributed-systems) introduced them.',
      'Saturation is the one people forget, and it is often the earliest warning. In [Memory Leak](incident:memory-leak) memory climbed for hours before anything was killed; in [Full Disk](incident:full-disk) the disk filled for three days before a write failed. [The USE Method](resource:gregg-use-method) gives a checklist for every resource, and [Which pods are using the most CPU and memory?](playbook:what-is-using-cpu-and-memory) is the quickest look.',
      'A service level objective (SLO) turns a signal into a promise: 99.9% of requests succeed, measured over 30 days. Whatever the promise leaves over is the error budget: 0.1% of requests may fail, about 43 minutes of complete outage a month. [Service Level Objectives](resource:sre-service-level-objectives) explains how to choose one.',
      'An alert should page a person only when the objective is in danger, and should say what users are suffering. Alert on symptoms, such as errors and latency, rather than on causes such as high CPU, and require the condition to hold for a few minutes so a brief blip does not wake anyone. [Alerting on SLOs](resource:sre-alerting-on-slos) works through the trade-offs.',
    ],
    example: 'alerting',
  },
  {
    id: 'investigating-by-hypothesis',
    title: 'Investigating by hypothesis',
    summary:
      'Guess a cause, predict what you would see if it were true, then run the one command that checks. Each answer rules something out and narrows the search.',
    body: [
      'Start with what changed. Most failures follow a change: a release, a configuration edit, a traffic spike, an expired certificate. If the Symptoms began just after a deploy, that deploy is the first suspect: [What was deployed, and when?](playbook:what-was-deployed) finds it.',
      'Then state a hypothesis you can test: "if the payments service were down, the logs would show requests to it timing out". Run the check and let the output decide. A hypothesis the output contradicts is crossed off, however likely it seemed. Each Playbook Entry, such as [What is the application logging?](playbook:what-is-the-application-logging), is one such check. [Effective Troubleshooting](resource:sre-troubleshooting) sets out this method in full.',
      'Narrow the scope as you go: all requests or only some, every pod or one, since when. Halving the search space each time (bisecting) finds the cause in a few steps even among many changes.',
      'Avoid the anti-methods: changing things at random to see what helps, or looking only where it is easy to look. [Performance Analysis Methodology](resource:gregg-methodology) names them. Try the method on [Bad Deploy](incident:bad-deploy).',
    ],
    example: 'hypothesis',
  },
  {
    id: 'working-safely-in-production',
    title: 'Working safely in production',
    summary:
      'Look before you touch: read-only commands first, the smallest possible change next, and nothing irreversible without knowing exactly what it does. An investigation must never become a second Incident.',
    body: [
      'Most of an investigation needs no changes at all. get, describe, logs and top only read, and saving their output to a file on your own machine changes nothing in the cluster. Every Playbook Entry marks its commands as read-only or as changing the system; [What configuration is a container running with?](playbook:what-configuration-is-a-container-running-with) is a typical read-only one.',
      'When you must change something, limit the blast radius. Change one pod before all of them, one replica before the Deployment, and prefer the change you can undo: a rollback can be rolled back, a deleted Deployment cannot. Some tools offer a safe form of a dangerous operation, such as building an index CONCURRENTLY so writes keep flowing: [How do I add an index without blocking writes?](playbook:how-do-i-add-an-index-without-blocking-writes)',
      'Know what is irreversible before you are tired and under pressure. Deleting pg_wal destroys a database; EXPLAIN ANALYZE really runs the statement it explains, so on a DELETE it deletes; and a rollback restores code, never data or schema, as [Slow Query](incident:slow-query) shows. [How do I free disk space safely?](playbook:how-do-i-free-disk-space-safely) lists what may and may not go.',
      'Access and audit make this enforceable. Give people the least access they need with [Role-Based Access Control](resource:k8s-rbac), check what you are allowed to do with [kubectl auth can-i](resource:kubectl-auth-can-i) before you rely on it, and keep an [audit log](resource:k8s-auditing) of who changed what, so the postmortem can rebuild the timeline.',
    ],
    example: 'working-safely',
  },
  {
    id: 'prevention',
    title: 'Prevention: catching failures before users do',
    summary:
      'Most failures can be caught before they reach everyone: release to a few users first, ship risky code switched off, test with real sizes and real failures, and make rolling back fast and dull.',
    body: [
      'A canary release sends a small share of traffic to the new version and compares it with the old before going further. A canary that runs a synthetic checkout would have stopped [Bad Deploy](incident:bad-deploy) at a handful of failed orders. [Canarying Releases](resource:sre-canarying-releases) covers how to judge a canary.',
      'A feature flag ships new code switched off, so it can be turned on for a few users, watched, and turned off again in seconds without a release. [Feature Toggles](resource:fowler-feature-toggles) describes the kinds of flag and their costs. Changing a setting is often the fastest Mitigation there is: [How do I change a setting without a release?](playbook:how-do-i-change-a-setting-without-a-release)',
      'Load and failure testing find what only production would otherwise show. A soak test at real traffic shows memory climbing in hours; a migration run against a production-sized copy shows a missing index; a test that slows a dependency on purpose shows whether timeouts hold. [Addressing Cascading Failures](resource:sre-cascading-failures) explains why the slow dependency matters most.',
      'And when prevention fails, recovery should be fast and routine. Keep earlier revisions, practise rollbacks, alert on trends before limits, and make every change reversible, because [Release Engineering](resource:sre-release-engineering) is what turns a bad release into a minor event.',
    ],
    example: 'prevention',
  },
  {
    id: 'blameless-postmortems',
    title: 'Blameless postmortems',
    summary:
      'After an Incident, write down what happened, why, and what will change, without blaming anyone. People act sensibly on what they knew at the time; the system let a sensible action cause harm.',
    body: [
      'A postmortem records the impact, a timeline, the Root Cause, what stopped the harm and the action items that will keep it from happening again. The Debrief of every Incident in this lab ends with a sample: read one after you work [Bad Deploy](incident:bad-deploy).',
      'Blameless means asking why a reasonable person did what they did, not who made the mistake. "A teammate left debug logging on" ends the inquiry; "temporary settings had no owner or expiry" leads to a fix. People who expect blame hide what they know, and the next Incident is harder to understand. [Postmortem Culture](resource:sre-postmortem-culture) makes the case.',
      'Good action items change the system, not people’s resolve: a check in the pipeline, an alert on a trend, a safer default, an expiry on a temporary change. Each has an owner and a date. [Postmortem Culture](resource:sre-workbook-postmortem-culture) in the Site Reliability Workbook shows good and bad examples side by side.',
      'Write the timeline from the Evidence you saved, which is one more reason to keep it before a Mitigation: [How do I keep the Evidence before changing anything?](playbook:how-do-i-keep-the-evidence)',
    ],
    example: 'postmortem',
  },
]

export const conceptById = (id: string) => concepts.find((c) => c.id === id)

/** The Resource identifiers a Concept cites, in the order it first cites them. */
export const citedResourceIds = (concept: Concept) => [
  ...new Set(concept.body.flatMap((text) => linksIn(text).flatMap((l) => (l.kind === 'resource' ? [l.id] : [])))),
]
