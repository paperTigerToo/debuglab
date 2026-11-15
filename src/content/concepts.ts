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
  example: 'lifecycle' | 'mitigate-first' | 'hypothesis'
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
      'Review closes the loop. A blameless postmortem records what happened, why, and what will change so it does not happen again. [Postmortem Culture](resource:sre-postmortem-culture) explains what makes one worth writing.',
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
]

export const conceptById = (id: string) => concepts.find((c) => c.id === id)

/** The Resource identifiers a Concept cites, in the order it first cites them. */
export const citedResourceIds = (concept: Concept) => [
  ...new Set(concept.body.flatMap((text) => linksIn(text).flatMap((l) => (l.kind === 'resource' ? [l.id] : [])))),
]
