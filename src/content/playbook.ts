// The granular half of DebugLab. Each Playbook Entry is one question an investigator asks, answered
// with real commands and annotated sample output. Follow-on answers are prose, so they can link to
// the next Entry as [question](playbook:id). Incidents name the Entries they use in their Hints, so
// an Entry lists those Incidents without keeping a second copy here.

export const layers = ['Cluster', 'Container', 'Host', 'Network', 'Database', 'Application'] as const
export type Layer = (typeof layers)[number]

export type PlaybookCommand = {
  text: string
  /** Whether running it changes the system. Saving output to a file on your own machine is read-only. */
  effect: 'read-only' | 'mutating'
  /** What it does, in a sentence. */
  what: string
}

export type SampleOutput = {
  /** What this sample shows, such as "Healthy" or "Too late". */
  label: string
  output: string
  /** The parts worth noticing. Each mark is text that appears in the output. */
  notes: readonly { mark: string; note: string }[]
}

export type PlaybookEntry = {
  id: string
  question: string
  layer: Layer
  /** Why you would ask it, in a sentence or two. Plain text, no links. */
  summary: string
  commands: readonly PlaybookCommand[]
  healthy: SampleOutput
  unhealthy: SampleOutput
  /** What to ask next, depending on the result. `then` is prose and may link to another Entry. */
  followOn: readonly { if: string; then: string }[]
  links: { concepts: readonly string[]; resources: readonly string[] }
}

const table = (...rows: string[]) => rows.join('\n')

export const playbook: readonly PlaybookEntry[] = [
  {
    id: 'are-the-pods-running',
    question: 'Are the pods running, and since when?',
    layer: 'Cluster',
    summary:
      'The broadest first look. It tells you whether the service is crashing, starved of capacity or healthy, and whether its pods were replaced recently.',
    commands: [
      { text: 'kubectl get pods', effect: 'read-only', what: 'Lists the pods with whether they are Ready, their status, restarts and age.' },
      { text: 'kubectl get pods -o wide', effect: 'read-only', what: 'Adds each pod’s IP address and the node it runs on, to spot a problem confined to one node.' },
      {
        text: 'kubectl describe pod pantry-api-6d8f9c7b54-7xk2p',
        effect: 'read-only',
        what: 'Shows one pod’s events: scheduling, image pulls, failed probes and kills.',
      },
    ],
    healthy: {
      label: 'Healthy',
      output: table(
        'NAME                          READY   STATUS    RESTARTS   AGE',
        'pantry-api-84b7d5f9cd-h2k8w   1/1     Running   0          6d3h',
        'pantry-api-84b7d5f9cd-p9x4c   1/1     Running   0          6d3h',
        'pantry-api-84b7d5f9cd-t6m3j   1/1     Running   0          6d3h',
      ),
      notes: [
        { mark: '1/1', note: 'Every container in the pod is Ready, so the pod receives traffic.' },
        { mark: '6d3h', note: 'Six days old: nothing has replaced these pods recently.' },
      ],
    },
    unhealthy: {
      label: 'Unhealthy',
      output: table(
        'NAME                          READY   STATUS             RESTARTS      AGE',
        'pantry-api-7b9d4c6f58-2kq7r   0/1     CrashLoopBackOff   6 (41s ago)   8m',
        'pantry-api-7b9d4c6f58-c5wz9   1/1     Running            0             8m',
        'pantry-api-7b9d4c6f58-x8hn4   1/1     Running            0             8m',
      ),
      notes: [
        { mark: 'CrashLoopBackOff', note: 'The container keeps exiting, and Kubernetes waits longer before each restart.' },
        { mark: '6 (41s ago)', note: 'Six restarts, the last 41 seconds ago.' },
        { mark: '0/1', note: 'Not Ready, so it receives no traffic. The other pods carry the load alone.' },
        { mark: '8m', note: 'Eight minutes old: these pods were created recently, so something replaced the old ones.' },
      ],
    },
    followOn: [
      {
        if: 'Every pod is Running but only minutes old',
        then: 'Something replaced them shortly before the trouble began. Ask [What was deployed, and when?](playbook:what-was-deployed)',
      },
      {
        if: 'A pod is restarting or in CrashLoopBackOff',
        then: 'Read what its last run printed before it exited: [What is the application logging?](playbook:what-is-the-application-logging), with --previous.',
      },
      {
        if: 'The pods are old, Ready and not restarting',
        then: 'The Root Cause is probably not in the pods. Look further out: the load balancer in front of them, or the database behind them.',
      },
    ],
    links: { concepts: ['investigating-by-hypothesis'], resources: ['k8s-debug-pods'] },
  },
  {
    id: 'what-was-deployed',
    question: 'What was deployed, and when?',
    layer: 'Cluster',
    summary:
      'Most failures follow a change. Lining up the latest rollout with the moment the Symptoms began is the quickest way to a first suspect.',
    commands: [
      { text: 'kubectl rollout history deployment/pantry-api', effect: 'read-only', what: 'Lists the Deployment’s revisions and the change-cause recorded for each. It shows no times.' },
      {
        text: 'kubectl get replicasets -l app=pantry-api',
        effect: 'read-only',
        what: 'Each revision has its own ReplicaSet. The AGE column shows when it was created, so when that version was first rolled out.',
      },
      {
        text: 'kubectl rollout history deployment/pantry-api --revision=42',
        effect: 'read-only',
        what: 'Shows one revision’s pod template: image, environment and configuration, to compare with the one before.',
      },
    ],
    healthy: {
      label: 'No recent change',
      output: table(
        'NAME                    DESIRED   CURRENT   READY   AGE',
        'pantry-api-84b7d5f9cd   3         3         3       6d3h',
        'pantry-api-5f7c9d8b6z   0         0         0       19d',
      ),
      notes: [
        { mark: '6d3h', note: 'The ReplicaSet serving traffic was created six days ago: no rollout lines up with a problem that began today.' },
        { mark: 'pantry-api-5f7c9d8b6z', note: 'An older revision, scaled to zero. Kubernetes keeps it so you can roll back to it.' },
      ],
    },
    unhealthy: {
      label: 'A rollout lines up',
      output: table(
        'NAME                    DESIRED   CURRENT   READY   AGE',
        'pantry-api-6d8f9c7b54   3         3         3       12m',
        'pantry-api-84b7d5f9cd   0         0         0       6d3h',
      ),
      notes: [
        { mark: '12m', note: 'A new ReplicaSet appeared 12 minutes ago. If the Symptoms began then, this release is the first suspect.' },
        { mark: 'pantry-api-84b7d5f9cd', note: 'The previous revision, scaled to zero but still there: the target of a rollback.' },
      ],
    },
    followOn: [
      {
        if: 'A rollout lines up with the start of the Symptoms',
        then: 'If users are being harmed now, plan a [rollback](playbook:how-do-i-roll-back-a-deployment), but first [keep the Evidence](playbook:how-do-i-keep-the-evidence). Then find out what the new version does wrong: [What is the application logging?](playbook:what-is-the-application-logging)',
      },
      {
        if: 'Nothing was rolled out recently',
        then: 'Look for a change outside the release: configuration or a Secret edited in place, a traffic spike, a dependency, an expired certificate.',
      },
    ],
    links: { concepts: ['investigating-by-hypothesis'], resources: ['k8s-deployment'] },
  },
  {
    id: 'what-is-the-application-logging',
    question: 'What is the application logging?',
    layer: 'Application',
    summary: 'The application’s own account of what went wrong. One error message often names the failing call and the bad value.',
    commands: [
      {
        text: 'kubectl logs deployment/pantry-api --tail=50',
        effect: 'read-only',
        what: 'Prints the last 50 lines from one of the Deployment’s pods. Run it per pod when only some are failing.',
      },
      {
        text: 'kubectl logs pantry-api-6d8f9c7b54-7xk2p --previous',
        effect: 'read-only',
        what: 'Prints what the container logged in its previous run, before it crashed and was restarted.',
      },
      { text: 'grep -i warn pantry-api-v2.14.0.log', effect: 'read-only', what: 'Searches a saved log file for warnings, ignoring case.' },
    ],
    healthy: {
      label: 'Healthy',
      output: table(
        '{"level":"info","time":"2026-11-14T10:41:07.212Z","pid":1,"reqId":"r-3a10","msg":"request completed","method":"GET","path":"/api/cart","status":200,"ms":12}',
        '{"level":"info","time":"2026-11-14T10:41:07.655Z","pid":1,"reqId":"r-3a11","msg":"request completed","method":"POST","path":"/api/checkout","status":200,"ms":184}',
      ),
      notes: [
        { mark: '"level":"info"', note: 'Routine lines only. Nothing at warn or error level.' },
        { mark: '"path":"/api/checkout","status":200', note: 'Checkout succeeds, and takes as long as a call to the payments service should.' },
      ],
    },
    unhealthy: {
      label: 'Unhealthy',
      output: table(
        '{"level":"warn","time":"2026-11-14T14:02:19.418Z","pid":1,"msg":"config key not set","key":"PAYMENTS_URL"}',
        '{"level":"error","time":"2026-11-14T14:13:43.002Z","pid":1,"reqId":"r-81f5","msg":"request failed","method":"POST","path":"/api/checkout","status":500,"ms":4,"err":{"type":"TypeError","code":"ERR_INVALID_URL","message":"Invalid URL","input":"undefined/v1/charges","stack":"TypeError: Invalid URL\\n    at new URL (node:internal/url:816:29)\\n    at createCharge (/app/src/payments/client.js:18:15)\\n    at checkout (/app/src/routes/checkout.js:42:24)"}}',
      ),
      notes: [
        { mark: '"config key not set"', note: 'Logged once at startup, easy to miss: the application could not find a setting it needs.' },
        { mark: '"status":500', note: 'Checkout fails with a server error.' },
        { mark: '"ms":4', note: 'Four milliseconds is far too fast to have called another service: the request failed before it was sent.' },
        { mark: 'undefined/v1/charges', note: 'The payments address was undefined, so the URL could not be built.' },
      ],
    },
    followOn: [
      {
        if: 'An error names a missing or malformed setting',
        then: 'Check what the container was actually given: [What configuration is a container running with?](playbook:what-configuration-is-a-container-running-with)',
      },
      {
        if: 'You are about to restart or roll back',
        then: 'These logs go with the pods. [Keep the evidence](playbook:how-do-i-keep-the-evidence) first.',
      },
      {
        if: 'The logs are clean',
        then: 'The failure may happen before a request reaches the application. Check the load balancer’s logs and the status codes it returns.',
      },
    ],
    links: { concepts: ['investigating-by-hypothesis'], resources: ['k8s-logging'] },
  },
  {
    id: 'how-do-i-keep-the-evidence',
    question: 'How do I keep the Evidence before changing anything?',
    layer: 'Container',
    summary:
      'A container’s logs live only as long as its pod. Before a restart, rollback or scale-down replaces the pods, save what you will need to find the Root Cause.',
    commands: [
      {
        text: 'kubectl logs deployment/pantry-api > pantry-api-v2.14.0.log',
        effect: 'read-only',
        what: 'Saves one pod’s logs to a file on your machine. Changes nothing in the cluster.',
      },
      {
        text: 'kubectl logs -l app=pantry-api --prefix --tail=-1 > pantry-api-all.log',
        effect: 'read-only',
        what: 'Saves every matching pod’s logs, each line prefixed with its pod. With a label selector kubectl shows only 10 lines per pod unless you pass --tail=-1.',
      },
      {
        text: 'kubectl get events --sort-by=.lastTimestamp > events.txt',
        effect: 'read-only',
        what: 'Saves the cluster’s recent events. By default they are kept for only an hour.',
      },
    ],
    healthy: {
      label: 'Saved in time',
      output: table('$ kubectl logs deployment/pantry-api > pantry-api-v2.14.0.log', '$ wc -l pantry-api-v2.14.0.log', '1843 pantry-api-v2.14.0.log'),
      notes: [{ mark: '1843', note: 'The file holds the logs. They now outlive the pods, so you can mitigate and still investigate.' }],
    },
    unhealthy: {
      label: 'Too late',
      output: table('$ kubectl logs pantry-api-6d8f9c7b54-7xk2p', 'Error from server (NotFound): pods "pantry-api-6d8f9c7b54-7xk2p" not found'),
      notes: [{ mark: 'NotFound', note: 'The rollback replaced the pod, and its logs went with it.' }],
    },
    followOn: [
      { if: 'The evidence is saved', then: 'Stop the harm: [How do I roll back a Deployment?](playbook:how-do-i-roll-back-a-deployment)' },
      {
        if: 'The pod is already gone',
        then: 'Look for copies elsewhere: a central log store, if the cluster ships its logs to one, or the load balancer’s logs.',
      },
    ],
    links: { concepts: ['mitigate-then-investigate'], resources: ['k8s-logging', 'kubectl-quick-reference'] },
  },
  {
    id: 'how-do-i-roll-back-a-deployment',
    question: 'How do I roll back a Deployment?',
    layer: 'Cluster',
    summary: 'The usual Mitigation after a bad release: put the previous version back, so users stop being harmed while you investigate.',
    commands: [
      { text: 'kubectl rollout undo deployment/pantry-api', effect: 'mutating', what: 'Rolls the Deployment back to its previous revision, replacing every pod.' },
      { text: 'kubectl rollout undo deployment/pantry-api --to-revision=41', effect: 'mutating', what: 'Rolls back to a specific revision from the rollout history.' },
      { text: 'kubectl rollout status deployment/pantry-api', effect: 'read-only', what: 'Follows the rollout and reports when it has finished, or why it is stuck.' },
    ],
    healthy: {
      label: 'Rolled back',
      output: table(
        '$ kubectl rollout undo deployment/pantry-api',
        'deployment.apps/pantry-api rolled back',
        '$ kubectl rollout status deployment/pantry-api',
        'Waiting for deployment "pantry-api" rollout to finish: 2 of 3 updated replicas are available...',
        'deployment "pantry-api" successfully rolled out',
      ),
      notes: [
        { mark: 'rolled back', note: 'Kubernetes accepted the change. The pods are not replaced yet.' },
        { mark: 'successfully rolled out', note: 'Every pod now runs the previous version. Check that the errors have stopped.' },
      ],
    },
    unhealthy: {
      label: 'Stuck',
      output: table(
        '$ kubectl rollout status deployment/pantry-api',
        'Waiting for deployment "pantry-api" rollout to finish: 1 of 3 updated replicas are available...',
        'error: deployment "pantry-api" exceeded its progress deadline',
      ),
      notes: [
        { mark: '1 of 3', note: 'Only one pod of the old version became Ready.' },
        { mark: 'exceeded its progress deadline', note: 'The rollout has stalled. The old version cannot start either, perhaps because something it depends on has changed since.' },
      ],
    },
    followOn: [
      {
        if: 'The rollout finished and the errors stopped',
        then: 'The harm has stopped. Now find out why, from the logs you saved: [What is the application logging?](playbook:what-is-the-application-logging)',
      },
      {
        if: 'The errors continue after the rollback',
        then: 'The release was not the cause, or not the only one. Start again from [Are the pods running, and since when?](playbook:are-the-pods-running)',
      },
      { if: 'The rollout is stuck', then: 'Describe one of the new pods and read its events to see why it will not become Ready.' },
    ],
    links: { concepts: ['mitigate-then-investigate'], resources: ['k8s-deployment'] },
  },
  {
    id: 'what-configuration-is-a-container-running-with',
    question: 'What configuration is a container running with?',
    layer: 'Container',
    summary: 'What the container was actually given, as opposed to what the code expects. A renamed or missing setting is a common cause of failure after a release.',
    commands: [
      { text: 'kubectl describe deployment pantry-api', effect: 'read-only', what: 'Shows the pod template, including the environment variables the manifest sets.' },
      {
        text: 'kubectl exec pantry-api-6d8f9c7b54-7xk2p -- env',
        effect: 'read-only',
        what: 'Prints the environment inside a running container. It only reads, but it runs a process in a live container, which some teams restrict.',
      },
      {
        text: 'kubectl rollout history deployment/pantry-api --revision=41',
        effect: 'read-only',
        what: 'Shows the configuration an earlier revision ran with, to compare with the current one.',
      },
    ],
    healthy: {
      label: 'Matches the code',
      output: table(
        '    Environment:',
        '      NODE_ENV:      production',
        '      REDIS_URL:     redis://redis:6379',
        '      PAYMENTS_URL:  http://payments.payments.svc.cluster.local',
      ),
      notes: [{ mark: 'PAYMENTS_URL', note: 'The name this version of the code reads, set to an address: the setting reaches the application.' }],
    },
    unhealthy: {
      label: 'A name has drifted',
      output: table(
        '    Environment:',
        '      NODE_ENV:             production',
        '      REDIS_URL:            redis://redis:6379',
        '      PAYMENT_SERVICE_URL:  http://payments.payments.svc.cluster.local',
      ),
      notes: [
        {
          mark: 'PAYMENT_SERVICE_URL',
          note: 'The manifest still sets the old name, but v2.14.0 reads PAYMENTS_URL. The value is there; the code looks for it under another name.',
        },
      ],
    },
    followOn: [
      {
        if: 'A name or value differs from what the code expects',
        then: 'That is a Root Cause candidate. Confirm it with the startup warnings: [What is the application logging?](playbook:what-is-the-application-logging)',
      },
      {
        if: 'The configuration matches',
        then: 'Compare it with the revision before: [What was deployed, and when?](playbook:what-was-deployed)',
      },
    ],
    links: { concepts: ['investigating-by-hypothesis'], resources: ['kubectl-quick-reference'] },
  },
]

export const entryById = (id: string) => playbook.find((e) => e.id === id)
