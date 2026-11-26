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
  {
    id: 'why-does-this-container-keep-restarting',
    question: 'Why does this container keep restarting?',
    layer: 'Container',
    summary:
      'A restart wipes the evidence of why the container stopped, except for a few lines Kubernetes keeps: how the last run ended, and its logs.',
    commands: [
      {
        text: 'kubectl describe pod pantry-api-7f9c6d5b48-n2x8v',
        effect: 'read-only',
        what: 'Shows the container’s current state and its Last State: how the previous run ended, with a reason and an exit code.',
      },
      {
        text: 'kubectl logs pantry-api-7f9c6d5b48-n2x8v --previous',
        effect: 'read-only',
        what: 'Prints the logs of the run before this one. Without --previous you only see the fresh container, which has not failed yet.',
      },
      {
        text: 'kubectl get events --sort-by=.lastTimestamp',
        effect: 'read-only',
        what: 'Recent events, newest last: failed probes, kills and back-offs.',
      },
    ],
    healthy: {
      label: 'Never restarted',
      output: table(
        '    State:          Running',
        '      Started:      Mon, 16 Nov 2026 11:13:02 +0000',
        '    Ready:          True',
        '    Restart Count:  0',
      ),
      notes: [{ mark: 'Restart Count:  0', note: 'This container has run since it started. There is no Last State to read.' }],
    },
    unhealthy: {
      label: 'Killed for memory',
      output: table(
        '    State:          Running',
        '      Started:      Thu, 19 Nov 2026 09:10:39 +0000',
        '    Last State:     Terminated',
        '      Reason:       OOMKilled',
        '      Exit Code:    137',
        '      Started:      Thu, 19 Nov 2026 08:30:44 +0000',
        '      Finished:     Thu, 19 Nov 2026 09:10:37 +0000',
        '    Restart Count:  4',
        '    Limits:',
        '      memory:  512Mi',
      ),
      notes: [
        { mark: 'OOMKilled', note: 'The kernel killed the process for using more memory than its limit.' },
        { mark: '137', note: '128 + 9: the process received SIGKILL. It had no chance to log anything or shut down cleanly.' },
        { mark: '08:30:44', note: 'The previous run lasted 40 minutes. A process that dies after a steady interval is often filling up with something.' },
        { mark: '512Mi', note: 'The limit it crossed.' },
      ],
    },
    followOn: [
      {
        if: 'The reason is OOMKilled',
        then: 'Find out whether memory is simply too tight or keeps growing: [Which pods are using the most CPU and memory?](playbook:what-is-using-cpu-and-memory)',
      },
      {
        if: 'The reason is Error, with an exit code such as 1',
        then: 'The application exited by itself. Its last words are in the previous run’s logs: [What is the application logging?](playbook:what-is-the-application-logging), with --previous.',
      },
      {
        if: 'The events say the liveness probe failed',
        then: 'Kubernetes restarted a container that stopped answering its health check. Find out why it stopped answering before you loosen the probe.',
      },
    ],
    links: { concepts: ['investigating-by-hypothesis'], resources: ['k8s-pod-failure-reason', 'k8s-debug-pods'] },
  },
  {
    id: 'what-is-using-cpu-and-memory',
    question: 'Which pods are using the most CPU and memory?',
    layer: 'Container',
    summary:
      'A quick look at saturation. It shows which pod is doing the work, or holding the memory, and how close each is to its limit.',
    commands: [
      { text: 'kubectl top pods', effect: 'read-only', what: 'CPU in millicores (1000m is one core) and memory for each pod, as last sampled by the cluster’s metrics server.' },
      { text: 'kubectl top nodes', effect: 'read-only', what: 'The same for each node, to see whether a whole machine is short of capacity.' },
      {
        text: 'kubectl describe deployment pantry-api',
        effect: 'read-only',
        what: 'Shows the Limits and Requests to compare the figures with. top shows usage, not limits.',
      },
    ],
    healthy: {
      label: 'Steady',
      output: table(
        'NAME                          CPU(cores)   MEMORY(bytes)',
        'pantry-api-5c8d9f7b46-b4xpl   79m          139Mi',
        'pantry-api-5c8d9f7b46-g8kzs   84m          142Mi',
        'pantry-api-5c8d9f7b46-w2nfd   77m          136Mi',
        'postgres-0                    402m         1236Mi',
      ),
      notes: [
        { mark: '142Mi', note: 'Similar memory in every pantry-api pod, far below a 512Mi limit, and it stays there over time.' },
        { mark: '402m', note: 'PostgreSQL is using 0.4 of its 2 cores: busy, with room to spare.' },
      ],
    },
    unhealthy: {
      label: 'Growing memory',
      output: table(
        'NAME                          CPU(cores)   MEMORY(bytes)',
        'pantry-api-7f9c6d5b48-kq7wz   71m          185Mi',
        'pantry-api-7f9c6d5b48-n2x8v   164m         487Mi',
        'pantry-api-7f9c6d5b48-t5hzr   102m         307Mi',
      ),
      notes: [
        { mark: '487Mi', note: 'Nearly at its 512Mi limit. This is the container that restarted longest ago.' },
        { mark: '185Mi', note: 'Restarted 6 minutes ago. Memory that rises with uptime, pod after pod, is the shape of a leak.' },
      ],
    },
    followOn: [
      {
        if: 'Memory is close to the limit and higher the longer a container has run',
        then: 'Something accumulates. Look at what before anything replaces the process: [What is the process holding in memory?](playbook:what-is-the-process-holding-in-memory)',
      },
      {
        if: 'The database pod is the busy one, and the API pods are nearly idle',
        then: 'The API is waiting on the database. Ask it what it is working on: [What is the database doing right now?](playbook:what-is-the-database-doing-right-now)',
      },
      {
        if: 'Every pod is busy in proportion to traffic',
        then: 'The service may simply need more capacity. Check the request rate on the dashboard before you look for a defect.',
      },
    ],
    links: { concepts: ['investigating-by-hypothesis'], resources: ['k8s-manage-resources', 'gregg-methodology'] },
  },
  {
    id: 'what-is-the-process-holding-in-memory',
    question: 'What is the process holding in memory?',
    layer: 'Application',
    summary:
      'Memory that only grows is held by something: a cache, a queue, a list of listeners. The live process can tell you what, but only until it is restarted.',
    commands: [
      {
        text: 'kubectl exec pantry-api-7f9c6d5b48-n2x8v -- curl -s localhost:8080/metrics',
        effect: 'read-only',
        what: 'Asks the process for its own metrics: heap size, garbage collection, and the size of any cache or queue the code reports.',
      },
      {
        text: 'kubectl exec pantry-api-7f9c6d5b48-n2x8v -- curl -s localhost:8080/metrics > pantry-api-metrics.txt',
        effect: 'read-only',
        what: 'Saves the same on your machine, so it outlives the process.',
      },
      {
        text: 'kubectl exec pantry-api-7f9c6d5b48-n2x8v -- kill -USR2 1',
        effect: 'mutating',
        what: 'If Node.js runs with --heapsnapshot-signal=SIGUSR2, writes a heap snapshot you can open in Chrome DevTools. The process freezes while it writes, which can take seconds, and the file stays in the container until you copy it out with kubectl cp.',
      },
    ],
    healthy: {
      label: 'A bounded cache',
      output: table(
        'nodejs_heap_size_used_bytes 63412224',
        'pantry_search_cache_entries 5000',
        'pantry_search_cache_hits_total 88123',
        'pantry_search_cache_evictions_total 41762',
      ),
      notes: [
        { mark: 'pantry_search_cache_entries 5000', note: 'At its configured maximum, and staying there.' },
        { mark: 'pantry_search_cache_evictions_total 41762', note: 'Old entries are removed to make room for new ones, so memory stays flat.' },
      ],
    },
    unhealthy: {
      label: 'A cache that only grows',
      output: table(
        'nodejs_heap_size_used_bytes 438861824',
        'pantry_search_cache_entries 186204',
        'pantry_search_cache_hits_total 1655',
        'pantry_search_cache_evictions_total 0',
      ),
      notes: [
        { mark: '438861824', note: 'About 419Mi of JavaScript heap, most of a 512Mi limit.' },
        { mark: 'pantry_search_cache_hits_total 1655', note: 'Under 1 search in 100 is answered from the cache: its entries are almost never reused.' },
        { mark: 'pantry_search_cache_evictions_total 0', note: 'Nothing has ever been removed. Every search adds memory that is never given back.' },
      ],
    },
    followOn: [
      {
        if: 'A cache or queue grows and never shrinks',
        then: 'That is what holds the memory. Stop the harm with a [rollback](playbook:how-do-i-roll-back-a-deployment), then read the code that fills it.',
      },
      {
        if: 'The heap is small, but the container’s memory keeps growing',
        then: 'The memory is outside the JavaScript heap, in buffers or native code. [Memory Diagnostics](resource:nodejs-memory-diagnostics) covers the tools for that.',
      },
      {
        if: 'The process reports nothing useful',
        then: 'Take two heap snapshots some minutes apart and compare what grew between them. Expect a pause while each is written.',
      },
    ],
    links: { concepts: ['mitigate-then-investigate'], resources: ['nodejs-memory-diagnostics', 'gregg-memory-leaks'] },
  },
  {
    id: 'what-is-the-database-doing-right-now',
    question: 'What is the database doing right now?',
    layer: 'Database',
    summary:
      'PostgreSQL lists every connection and what it is running. When the database is slow, this shows whether it is busy with one query, many queries, or waiting on locks.',
    commands: [
      {
        text: `kubectl exec postgres-0 -- psql -U pantry -c "SELECT pid, now() - query_start AS runtime, wait_event, query FROM pg_stat_activity WHERE state = 'active'"`,
        effect: 'read-only',
        what: 'The queries running at this moment, how long each has run and what, if anything, it is waiting for.',
      },
      {
        text: `kubectl exec postgres-0 -- psql -U pantry -c "SELECT pid, now() - query_start AS runtime, wait_event, query FROM pg_stat_activity WHERE state = 'active'" | tee active-queries.txt`,
        effect: 'read-only',
        what: 'Shows the same and keeps a copy. The picture is gone the moment a Mitigation works.',
      },
      {
        text: 'kubectl exec postgres-0 -- psql -U pantry -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state"',
        effect: 'read-only',
        what: 'How many connections are active, idle, or idle inside a transaction that never finished.',
      },
    ],
    healthy: {
      label: 'Quiet',
      output: table(
        '  pid  |     runtime     |  wait_event  | query',
        '-------+-----------------+--------------+------------------------------------------------',
        ' 48214 | 00:00:00.001804 | ClientRead   | SELECT id, status, total_cents, created_at FROM orders ...',
        '(1 row)',
      ),
      notes: [
        { mark: '00:00:00.001804', note: 'Under two milliseconds: queries finish faster than you can catch them.' },
        { mark: '(1 row)', note: 'Almost nothing is running at any moment.' },
      ],
    },
    unhealthy: {
      label: 'Piling up',
      output: table(
        '  pid  |     runtime     |  wait_event  | query',
        '-------+-----------------+--------------+------------------------------------------------',
        ' 48211 | 00:00:02.871544 |              | SELECT id, status, total_cents, created_at FROM orders WHERE customer_id = $1 ...',
        ' 48214 | 00:00:02.644261 | DataFileRead | SELECT id, status, total_cents, created_at FROM orders WHERE customer_id = $1 ...',
        ' 48217 | 00:00:02.512983 |              | SELECT id, status, total_cents, created_at FROM orders WHERE customer_id = $1 ...',
        ' 48260 | 00:00:00.812417 |              | SELECT id, name, price_cents FROM products WHERE category = $1 ...',
        '(17 rows)',
      ),
      notes: [
        { mark: '00:00:02.871544', note: 'Nearly three seconds for a lookup that should take milliseconds.' },
        { mark: 'WHERE customer_id = $1', note: 'Most rows are the same statement: one query is the trouble, not the whole workload.' },
        { mark: 'DataFileRead', note: 'Waiting to read table data. No Lock wait events, so nothing is blocked; the database is simply busy.' },
      ],
    },
    followOn: [
      {
        if: 'One statement dominates and each run takes seconds',
        then: 'Find out why that statement is slow: [Why is this query slow?](playbook:why-is-this-query-slow)',
      },
      {
        if: 'Queries wait with wait events of type Lock',
        then: 'Something holds a lock. Look for a long transaction, often one left idle in transaction, and what it is holding.',
      },
      {
        if: 'Nothing is running long',
        then: 'The time is spent elsewhere. Look at the API itself: [What is the application logging?](playbook:what-is-the-application-logging)',
      },
    ],
    links: { concepts: ['mitigate-then-investigate'], resources: ['pg-monitoring-stats'] },
  },
  {
    id: 'which-queries-are-slow',
    question: 'Which queries are slow?',
    layer: 'Database',
    summary:
      'With the slow query log turned on, PostgreSQL writes down every statement that took longer than a threshold. It is the quickest way to name the guilty query.',
    commands: [
      {
        text: 'kubectl logs postgres-0 --tail=20',
        effect: 'read-only',
        what: 'The database’s latest log lines. With log_min_duration_statement set, slow statements appear with their duration.',
      },
      {
        text: 'kubectl logs postgres-0 | grep duration',
        effect: 'read-only',
        what: 'Only the slow statements, from as far back as the container’s log goes.',
      },
      {
        text: 'kubectl exec postgres-0 -- psql -U pantry -c "SELECT calls, mean_exec_time, query FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 5"',
        effect: 'read-only',
        what: 'If the pg_stat_statements extension is installed: the statements that have cost the most time in total.',
      },
    ],
    healthy: {
      label: 'Nothing slow',
      output: table(
        '2026-11-24 11:13:02.114 UTC [61] LOG:  checkpoint starting: time',
        '2026-11-24 11:13:09.871 UTC [61] LOG:  checkpoint complete: wrote 412 buffers (2.5%)',
      ),
      notes: [{ mark: 'checkpoint', note: 'Routine housekeeping. No statement crossed the threshold, so none was logged.' }],
    },
    unhealthy: {
      label: 'One query, again and again',
      output: table(
        '2026-11-24 11:38:51.204 UTC [48211] LOG:  duration: 2412.880 ms  execute <unnamed>: SELECT id, status, total_cents, created_at FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 10',
        "2026-11-24 11:38:51.204 UTC [48211] DETAIL:  parameters: $1 = '48213'",
        '2026-11-24 11:38:53.241 UTC [48218] LOG:  duration: 2571.302 ms  execute <unnamed>: SELECT id, status, total_cents, created_at FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 10',
      ),
      notes: [
        { mark: 'duration: 2412.880 ms', note: 'Each run takes about 2.4 seconds.' },
        { mark: "$1 = '48213'", note: 'The value it ran with. Use it to reproduce the query with EXPLAIN.' },
      ],
    },
    followOn: [
      {
        if: 'One statement appears over and over',
        then: 'See what is running right now and keep a copy: [What is the database doing right now?](playbook:what-is-the-database-doing-right-now). Then [Why is this query slow?](playbook:why-is-this-query-slow)',
      },
      {
        if: 'Many different statements are slow',
        then: 'The database as a whole is short of something. Check its CPU and memory: [Which pods are using the most CPU and memory?](playbook:what-is-using-cpu-and-memory)',
      },
      {
        if: 'Nothing is logged',
        then: 'The slow query log may be off. log_min_duration_statement must be set for statements to appear.',
      },
    ],
    links: { concepts: ['investigating-by-hypothesis'], resources: ['pg-logging'] },
  },
  {
    id: 'why-is-this-query-slow',
    question: 'Why is this query slow?',
    layer: 'Database',
    summary:
      'A query is slow because of how the database runs it. The plan shows whether it reads a few rows through an index or every row in the table.',
    commands: [
      {
        text: 'kubectl exec postgres-0 -- psql -U pantry -c "\\d orders"',
        effect: 'read-only',
        what: 'Describes the table: its columns and, under Indexes, every index it has.',
      },
      {
        text: 'kubectl exec postgres-0 -- psql -U pantry -c "EXPLAIN ANALYZE SELECT id, status, total_cents, created_at FROM orders WHERE customer_id = 48213 ORDER BY created_at DESC LIMIT 10"',
        effect: 'read-only',
        what: 'Runs the query and reports the plan with real timings. ANALYZE executes it, so never use it on a statement that writes.',
      },
      {
        text: 'kubectl exec postgres-0 -- psql -U pantry -c "EXPLAIN SELECT id, status, total_cents, created_at FROM orders WHERE customer_id = 48213"',
        effect: 'read-only',
        what: 'The plan without running the query: instant, with estimated costs only.',
      },
    ],
    healthy: {
      label: 'Uses an index',
      output: table(
        ' Limit  (actual time=0.071..0.074 rows=10 loops=1)',
        '   ->  Index Scan using orders_customer_id_idx on orders  (actual time=0.021..0.052 rows=33 loops=1)',
        '         Index Cond: (customer_id = 48213)',
        ' Execution Time: 0.093 ms',
      ),
      notes: [
        { mark: 'Index Scan using orders_customer_id_idx', note: 'Jumps straight to this customer’s 33 orders through the index.' },
        { mark: 'Execution Time: 0.093 ms', note: 'Under a tenth of a millisecond.' },
      ],
    },
    unhealthy: {
      label: 'Reads the whole table',
      output: table(
        ' Limit  (actual time=2391.064..2398.120 rows=10 loops=1)',
        '   ->  Parallel Seq Scan on orders  (actual time=161.233..2384.388 rows=11 loops=3)',
        '         Filter: (customer_id = 48213)',
        '         Rows Removed by Filter: 1399986',
        ' Execution Time: 2398.187 ms',
      ),
      notes: [
        { mark: 'Parallel Seq Scan on orders', note: 'Reads every row of the table, in three parallel workers, to find one customer’s orders.' },
        { mark: 'Rows Removed by Filter: 1399986', note: 'In each of three workers. About 4.2 million rows read and thrown away in all, to find 33.' },
        { mark: 'Execution Time: 2398.187 ms', note: 'And it does this for every account page.' },
      ],
    },
    followOn: [
      {
        if: 'A Seq Scan filters on a column that has no index',
        then: 'Find out whether the index ever existed and what removed it: [What was deployed, and when?](playbook:what-was-deployed). Then [add it back without blocking writes](playbook:how-do-i-add-an-index-without-blocking-writes).',
      },
      {
        if: 'An index exists but the plan does not use it',
        then: 'Check \\d for an index marked INVALID, and whether the query wraps the column in a function or casts it.',
      },
    ],
    links: { concepts: ['investigating-by-hypothesis'], resources: ['pg-using-explain', 'pg-indexes'] },
  },
  {
    id: 'how-do-i-add-an-index-without-blocking-writes',
    question: 'How do I add an index without blocking writes?',
    layer: 'Database',
    summary:
      'A plain CREATE INDEX locks the table against writes until it finishes. On a busy table, CONCURRENTLY builds the same index while writes carry on.',
    commands: [
      {
        text: 'kubectl exec postgres-0 -- psql -U pantry -c "CREATE INDEX CONCURRENTLY orders_customer_id_idx ON orders (customer_id)"',
        effect: 'mutating',
        what: 'Builds the index without blocking inserts and updates. It takes longer and adds load while it runs, and it cannot run inside a transaction.',
      },
      {
        text: 'kubectl exec postgres-0 -- psql -U pantry -c "\\d orders"',
        effect: 'read-only',
        what: 'Confirms the index exists. A concurrent build that failed leaves an index marked INVALID, which no query uses.',
      },
      {
        text: 'kubectl exec postgres-0 -- psql -U pantry -c "DROP INDEX CONCURRENTLY orders_customer_id_idx"',
        effect: 'mutating',
        what: 'Removes an INVALID index so you can build it again, also without blocking writes.',
      },
    ],
    healthy: {
      label: 'Built',
      output: table(
        'Indexes:',
        '    "orders_pkey" PRIMARY KEY, btree (id)',
        '    "orders_created_at_idx" btree (created_at)',
        '    "orders_customer_id_idx" btree (customer_id)',
      ),
      notes: [{ mark: '"orders_customer_id_idx" btree (customer_id)', note: 'The index exists and is valid: queries can use it at once.' }],
    },
    unhealthy: {
      label: 'A failed build',
      output: table(
        'Indexes:',
        '    "orders_pkey" PRIMARY KEY, btree (id)',
        '    "orders_created_at_idx" btree (created_at)',
        '    "orders_customer_id_idx" btree (customer_id) INVALID',
      ),
      notes: [
        { mark: 'INVALID', note: 'The concurrent build was interrupted. The index is kept up to date but never used. Drop it concurrently and build it again.' },
      ],
    },
    followOn: [
      {
        if: 'The index is built and valid',
        then: 'Check the query plan uses it: [Why is this query slow?](playbook:why-is-this-query-slow). Then make sure the migration that removed it cannot run again.',
      },
      {
        if: 'The build fails or leaves an INVALID index',
        then: 'Drop the invalid index concurrently and build it again. Look in the database’s log for the reason, such as a deadlock or a statement timeout.',
      },
    ],
    links: { concepts: ['mitigate-then-investigate'], resources: ['pg-create-index'] },
  },
  {
    id: 'is-the-service-waiting-for-database-connections',
    question: 'Is the service waiting for database connections?',
    layer: 'Application',
    summary:
      'A service keeps a small pool of database connections. When every one is taken, requests queue for one and time out, while CPU everywhere looks calm.',
    commands: [
      {
        text: 'kubectl logs deployment/pantry-api --tail=20',
        effect: 'read-only',
        what: 'The latest log lines. A full pool shows as requests giving up while they wait for a connection.',
      },
      {
        text: 'kubectl logs deployment/pantry-api | grep -c "waiting for a database connection"',
        effect: 'read-only',
        what: 'Counts those timeouts in the log, to tell a burst from a steady state.',
      },
      {
        text: 'kubectl exec postgres-0 -- psql -U pantry -c "SELECT state, count(*) FROM pg_stat_activity GROUP BY state"',
        effect: 'read-only',
        what: 'The other side of the pool: how many connections PostgreSQL has, and what state each is in.',
      },
    ],
    healthy: {
      label: 'Connections to spare',
      output: table(
        '{"level":"info","msg":"request completed","method":"GET","path":"/api/cart","status":200,"ms":11}',
        '{"level":"info","msg":"request completed","method":"GET","path":"/api/products/4411","status":200,"ms":9}',
      ),
      notes: [{ mark: '"ms":11', note: 'Requests that need the database finish in milliseconds: they got a connection at once.' }],
    },
    unhealthy: {
      label: 'Pool exhausted',
      output: table(
        '{"level":"error","msg":"timed out waiting for a database connection","waitMs":5000,"pool":{"size":10,"inUse":10,"idle":0,"waiting":37}}',
        '{"level":"info","msg":"request completed","method":"GET","path":"/api/cart","status":503,"ms":5003}',
      ),
      notes: [
        { mark: '"inUse":10', note: 'All ten connections are taken, and none is idle.' },
        { mark: '"waiting":37', note: '37 requests are queued for a connection.' },
        { mark: '"ms":5003', note: 'The request gave up after the 5-second wait and answered 503, though nothing failed in the database.' },
      ],
    },
    followOn: [
      {
        if: 'The pool is full but the database is idle',
        then: 'The connections are held, not used. See what they are doing: [What is the database doing right now?](playbook:what-is-the-database-doing-right-now)',
      },
      {
        if: 'The pool is full and the database is busy',
        then: 'Queries are slow, so connections come back late: [Which queries are slow?](playbook:which-queries-are-slow)',
      },
      {
        if: 'Nothing is waiting for a connection',
        then: 'The time goes somewhere else. Check the services it calls: [Is a dependency slow?](playbook:is-a-dependency-slow)',
      },
    ],
    links: { concepts: ['investigating-by-hypothesis'], resources: ['node-postgres-pool', 'sre-cascading-failures'] },
  },
  {
    id: 'is-a-dependency-slow',
    question: 'Is a dependency slow?',
    layer: 'Network',
    summary:
      'A service is only as fast as the slowest thing it waits for. A dependency that slows down can stall the caller, even when the caller is healthy.',
    commands: [
      {
        text: 'kubectl logs deployment/pantry-api | grep payments',
        effect: 'read-only',
        what: 'What the service logged about its calls to one dependency: slow calls, timeouts, errors.',
      },
      {
        text: 'kubectl exec pantry-api-8c5d7f9b64-jx2mq -- curl -s -o /dev/null -w "%{time_total}\\n" http://payments.payments.svc.cluster.local/healthz',
        effect: 'read-only',
        what: 'Times one request to the dependency from inside a pod, as the service sees it. A fast health check does not prove the real calls are fast.',
      },
      {
        text: 'kubectl describe deployment pantry-api',
        effect: 'read-only',
        what: 'Shows the timeouts the service is configured with, to compare with how slow the dependency is.',
      },
    ],
    healthy: {
      label: 'Fast',
      output: table('{"level":"info","msg":"payments request completed","orderId":880102,"ms":211}'),
      notes: [{ mark: '"ms":211', note: 'A charge takes about a fifth of a second.' }],
    },
    unhealthy: {
      label: 'Slow, and waited for',
      output: table(
        '{"level":"warn","msg":"payments request slow","orderId":880412,"ms":19840}',
        '{"level":"info","msg":"request completed","method":"POST","path":"/api/checkout","status":200,"ms":19871}',
      ),
      notes: [
        { mark: '"ms":19840', note: 'Twenty seconds for a charge that normally takes 200 milliseconds.' },
        { mark: '"status":200', note: 'It still succeeds. Slow is worse than down here: the caller waits instead of failing fast.' },
      ],
    },
    followOn: [
      {
        if: 'The dependency is slow and the caller waits a long time for it',
        then: 'Make the caller give up sooner, so it stops tying up its own resources: [How do I change a setting without a release?](playbook:how-do-i-change-a-setting-without-a-release)',
      },
      {
        if: 'The dependency is fast',
        then: 'Look inside the service instead: [Is the service waiting for database connections?](playbook:is-the-service-waiting-for-database-connections)',
      },
    ],
    links: { concepts: ['investigating-by-hypothesis'], resources: ['sre-cascading-failures', 'fowler-circuit-breaker'] },
  },
  {
    id: 'how-do-i-change-a-setting-without-a-release',
    question: 'How do I change a setting without a release?',
    layer: 'Cluster',
    summary:
      'Many Mitigations are a setting: a timeout, a feature flag, a pool size. Changing it on the Deployment rolls out new pods with the new value, without building a new version.',
    commands: [
      {
        text: 'kubectl set env deployment/pantry-api PAYMENTS_TIMEOUT_MS=2000',
        effect: 'mutating',
        what: 'Sets an environment variable on the pod template. Kubernetes rolls out new pods to apply it, replacing the old ones.',
      },
      { text: 'kubectl rollout status deployment/pantry-api', effect: 'read-only', what: 'Waits until every new pod is running and Ready.' },
      {
        text: 'kubectl rollout undo deployment/pantry-api',
        effect: 'mutating',
        what: 'Puts the previous pod template back, setting included, if the change made things worse.',
      },
    ],
    healthy: {
      label: 'Rolled out',
      output: table('deployment.apps/pantry-api env updated', 'deployment "pantry-api" successfully rolled out'),
      notes: [{ mark: 'successfully rolled out', note: 'Every pod now runs with the new setting.' }],
    },
    unhealthy: {
      label: 'Forgotten',
      output: table('    Environment:', '      PAYMENTS_TIMEOUT_MS:  2000'),
      notes: [
        {
          mark: 'PAYMENTS_TIMEOUT_MS:  2000',
          note: 'The cluster now differs from the manifest in source control. The next deploy puts the old value back unless the change is copied there too.',
        },
      ],
    },
    followOn: [
      {
        if: 'The harm has stopped',
        then: 'Record the change where the manifest lives, then find out why the old value hurt: [Is a dependency slow?](playbook:is-a-dependency-slow)',
      },
      {
        if: 'The new pods are not becoming Ready',
        then: 'The setting may be wrong. Undo it, then read why: [Why does this container keep restarting?](playbook:why-does-this-container-keep-restarting)',
      },
    ],
    links: { concepts: ['mitigate-then-investigate'], resources: ['kubectl-set-env'] },
  },
  {
    id: 'is-a-disk-full',
    question: 'Is a disk full, and which one?',
    layer: 'Host',
    summary:
      'A full disk shows up as writes failing with "No space left on device" while reads still work. A container sees several filesystems; only one of them is full.',
    commands: [
      { text: 'kubectl exec postgres-0 -- df -h', effect: 'read-only', what: 'Every filesystem the container sees, how big it is and how full, in K, M and G.' },
      { text: 'kubectl get pvc', effect: 'read-only', what: 'The persistent volumes claimed in the namespace, and the size of each.' },
      {
        text: 'kubectl describe pvc data-postgres-0',
        effect: 'read-only',
        what: 'One volume’s capacity, storage class and the pod using it, with any resize events.',
      },
    ],
    healthy: {
      label: 'Room to spare',
      output: table(
        'Filesystem      Size  Used Avail Use% Mounted on',
        'overlay          95G   38G   57G  40% /',
        '/dev/sdb         20G  6.2G   14G  31% /var/lib/postgresql/data',
      ),
      notes: [{ mark: '31%', note: 'The database’s volume is under a third full.' }],
    },
    unhealthy: {
      label: 'Full',
      output: table(
        'Filesystem      Size  Used Avail Use% Mounted on',
        'overlay          95G   38G   57G  40% /',
        '/dev/sdb         20G   20G     0 100% /var/lib/postgresql/data',
      ),
      notes: [
        { mark: '100%', note: 'Not a byte left on the volume PostgreSQL keeps its data on, so every write fails.' },
        { mark: '40%', note: 'The container’s own filesystem has plenty of room: it is not the machine that is full, but one volume.' },
      ],
    },
    followOn: [
      {
        if: 'One filesystem is full',
        then: 'Find out what on it takes the space before you delete anything: [What is filling the disk?](playbook:what-is-filling-the-disk)',
      },
      {
        if: 'Nothing is full',
        then: '"No space left on device" can also mean no free inodes. Check with df -i.',
      },
    ],
    links: { concepts: ['investigating-by-hypothesis'], resources: ['gregg-use-method', 'k8s-persistent-volumes'] },
  },
  {
    id: 'what-is-filling-the-disk',
    question: 'What is filling the disk?',
    layer: 'Host',
    summary:
      'Measure, directory by directory, from the top of the full filesystem down. The answer is usually one directory, and often something nobody expected to grow.',
    commands: [
      {
        text: "kubectl exec postgres-0 -- sh -c 'du -sh /var/lib/postgresql/data/*'",
        effect: 'read-only',
        what: 'The total size of each file and directory at the top of the volume. The * needs the container’s shell to expand it, hence sh -c.',
      },
      {
        text: 'kubectl exec postgres-0 -- ls -lh /var/lib/postgresql/data/log',
        effect: 'read-only',
        what: 'The files in the largest directory, with their sizes and when each was last written.',
      },
      {
        text: 'kubectl exec postgres-0 -- ls -lh /var/lib/postgresql/data/log | tee postgres-log-files.txt',
        effect: 'read-only',
        what: 'The same, with a copy kept on your machine. If freeing space means deleting these files, this listing is all that remains of them.',
      },
    ],
    healthy: {
      label: 'Mostly data',
      output: table('3.1G\t/var/lib/postgresql/data/base', '1.4G\t/var/lib/postgresql/data/log', '1.0G\t/var/lib/postgresql/data/pg_wal'),
      notes: [{ mark: '3.1G', note: 'base holds the tables and indexes: on a healthy database it is the biggest directory.' }],
    },
    unhealthy: {
      label: 'Something unexpected',
      output: table('3.1G\t/var/lib/postgresql/data/base', '15G\t/var/lib/postgresql/data/log', '1.0G\t/var/lib/postgresql/data/pg_wal'),
      notes: [
        { mark: '15G', note: 'PostgreSQL’s own message logs take five times as much room as the data.' },
        { mark: 'pg_wal', note: 'The write-ahead log, a normal 1.0G. Despite the name it is not a log of messages: never delete it.' },
      ],
    },
    followOn: [
      {
        if: 'Old logs or other disposable files take the space',
        then: 'Keep their listing, then free the space: [How do I free disk space safely?](playbook:how-do-i-free-disk-space-safely)',
      },
      {
        if: 'Logs grow far faster than they used to',
        then: 'Something is making the service log more. Check its settings: [What settings is PostgreSQL running with?](playbook:what-settings-is-postgresql-running-with)',
      },
      {
        if: 'The data itself has grown',
        then: 'The volume is simply too small for the data now. Grow it, then find out what grew and whether it should have.',
      },
    ],
    links: { concepts: ['investigating-by-hypothesis'], resources: ['gregg-use-method'] },
  },
  {
    id: 'what-settings-is-postgresql-running-with',
    question: 'What settings is PostgreSQL running with?',
    layer: 'Database',
    summary:
      'Settings changed with ALTER SYSTEM live in postgresql.auto.conf inside the data directory, not in any manifest. They are easy to forget and outlive the reason they were made.',
    commands: [
      {
        text: 'kubectl exec postgres-0 -- cat /var/lib/postgresql/data/postgresql.auto.conf',
        effect: 'read-only',
        what: 'Every setting changed with ALTER SYSTEM, in one short file.',
      },
      {
        text: 'kubectl exec postgres-0 -- psql -U pantry -c "SHOW log_min_duration_statement"',
        effect: 'read-only',
        what: 'The value of one setting as the running server sees it.',
      },
      {
        text: "kubectl exec postgres-0 -- psql -U pantry -c \"SELECT name, setting, sourcefile FROM pg_settings WHERE source <> 'default'\"",
        effect: 'read-only',
        what: 'Every setting that differs from the default, and which file set it.',
      },
    ],
    healthy: {
      label: 'Nothing surprising',
      output: table('# Do not edit this file manually!', '# It will be overwritten by the ALTER SYSTEM command.', "log_min_duration_statement = '500ms'"),
      notes: [{ mark: "'500ms'", note: 'Only statements slower than half a second are logged: a few lines a minute.' }],
    },
    unhealthy: {
      label: 'A debug setting left on',
      output: table(
        '# Do not edit this file manually!',
        '# It will be overwritten by the ALTER SYSTEM command.',
        "logging_collector = 'on'",
        "log_min_duration_statement = '0'",
      ),
      notes: [
        { mark: "log_min_duration_statement = '0'", note: 'Every statement is logged, however fast: thousands of lines a second on a busy database.' },
        { mark: "logging_collector = 'on'", note: 'Logs go to files in the data directory, on the same volume as the data, instead of to the container output.' },
      ],
    },
    followOn: [
      {
        if: 'A setting was changed for debugging and never put back',
        then: 'Once the harm has stopped, reset it with ALTER SYSTEM RESET, reload with SELECT pg_reload_conf(), and record who changed it and why.',
      },
      {
        if: 'The settings look normal',
        then: 'The growth comes from somewhere else. Go back to [What is filling the disk?](playbook:what-is-filling-the-disk)',
      },
    ],
    links: { concepts: ['investigating-by-hypothesis'], resources: ['pg-alter-system', 'pg-logging'] },
  },
  {
    id: 'how-do-i-free-disk-space-safely',
    question: 'How do I free disk space safely?',
    layer: 'Host',
    summary:
      'Delete only what the system can do without, and only after you know what it is. On a database volume, some files that look disposable are what keeps the data intact.',
    commands: [
      {
        text: "kubectl exec postgres-0 -- sh -c 'rm /var/lib/postgresql/data/log/*.log'",
        effect: 'mutating',
        what: 'Deletes PostgreSQL’s message logs, which the database never reads back. A file still open keeps its space until the server starts a new one.',
      },
      {
        text: `kubectl patch pvc data-postgres-0 -p '{"spec":{"resources":{"requests":{"storage":"40Gi"}}}}'`,
        effect: 'mutating',
        what: 'Grows the volume, if its storage class allows expansion. Buys time without deleting anything, and can never be undone.',
      },
      { text: 'kubectl get storageclass', effect: 'read-only', what: 'Shows whether each storage class allows volumes to grow.' },
    ],
    healthy: {
      label: 'Safe to delete',
      output: table(
        '-rw------- 1 postgres postgres 5.9G Nov 25 23:59 postgresql-2026-11-25.log',
        '-rw------- 1 postgres postgres 6.1G Nov 26 23:59 postgresql-2026-11-26.log',
      ),
      notes: [{ mark: 'postgresql-2026-11-25.log', note: 'Closed message logs from past days. Keep their listing, then delete them.' }],
    },
    unhealthy: {
      label: 'Never delete',
      output: table('000000010000000000000089', '00000001000000000000008A', '00000001000000000000008B'),
      notes: [
        {
          mark: '00000001000000000000008A',
          note: 'Segments of pg_wal, the write-ahead log. They hold changes not yet written into the tables. Deleting them crashes PostgreSQL and loses data.',
        },
      ],
    },
    followOn: [
      {
        if: 'Space is free and writes work again',
        then: 'Stop whatever filled the disk from filling it again: [What settings is PostgreSQL running with?](playbook:what-settings-is-postgresql-running-with)',
      },
      {
        if: 'Nothing on the volume is safe to delete',
        then: 'Grow the volume, then plan how the data will fit from now on.',
      },
    ],
    links: { concepts: ['mitigate-then-investigate'], resources: ['pg-wal-intro', 'k8s-persistent-volumes'] },
  },
]

export const entryById = (id: string) => playbook.find((e) => e.id === id)
