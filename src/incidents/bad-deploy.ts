import { defineIncident } from '../engine/types'

// Bad Deploy: release v2.14.0 of pantry-api renamed a config key from PAYMENT_SERVICE_URL to
// PAYMENTS_URL, but the Deployment manifest still sets the old name. Health checks pass, so the
// rollout looked fine; every checkout fails with an Invalid URL error.

const apiPodPlacement = [
  { pod: 'pantry-api-6d8f9c7b54-7xk2p', node: 'node-b', nodeIp: '10.0.1.21', ip: '10.42.1.37', started: '14:02:14' },
  { pod: 'pantry-api-6d8f9c7b54-m4q9t', node: 'node-c', nodeIp: '10.0.1.22', ip: '10.42.2.19', started: '14:02:41' },
  { pod: 'pantry-api-6d8f9c7b54-zr8vn', node: 'node-a', nodeIp: '10.0.1.20', ip: '10.42.0.88', started: '14:03:09' },
]
const apiPods = apiPodPlacement.map((p) => p.pod)

const getPods = `NAME                          READY   STATUS    RESTARTS   AGE
pantry-api-6d8f9c7b54-7xk2p   1/1     Running   0          12m
pantry-api-6d8f9c7b54-m4q9t   1/1     Running   0          12m
pantry-api-6d8f9c7b54-zr8vn   1/1     Running   0          11m
postgres-0                    1/1     Running   0          41d
redis-7c9d5b8f6-hq2lw         1/1     Running   0          41d`

const getPodsWide = `NAME                          READY   STATUS    RESTARTS   AGE   IP            NODE     NOMINATED NODE   READINESS GATES
pantry-api-6d8f9c7b54-7xk2p   1/1     Running   0          12m   10.42.1.37    node-b   <none>           <none>
pantry-api-6d8f9c7b54-m4q9t   1/1     Running   0          12m   10.42.2.19    node-c   <none>           <none>
pantry-api-6d8f9c7b54-zr8vn   1/1     Running   0          11m   10.42.0.88    node-a   <none>           <none>
postgres-0                    1/1     Running   0          41d   10.42.0.12    node-a   <none>           <none>
redis-7c9d5b8f6-hq2lw         1/1     Running   0          41d   10.42.2.7     node-c   <none>           <none>`

const startup = [
  `{"level":"info","time":"2026-11-14T14:02:19.412Z","pid":1,"msg":"pantry-api v2.14.0 starting","node":"v22.11.0"}`,
  `{"level":"warn","time":"2026-11-14T14:02:19.418Z","pid":1,"msg":"config key not set","key":"PAYMENTS_URL"}`,
  `{"level":"info","time":"2026-11-14T14:02:19.502Z","pid":1,"msg":"connected to postgres","pool":10}`,
  `{"level":"info","time":"2026-11-14T14:02:19.517Z","pid":1,"msg":"connected to redis"}`,
  `{"level":"info","time":"2026-11-14T14:02:19.521Z","pid":1,"msg":"listening","port":8080}`,
]

const checkoutError = (time: string, ms: number, id: string) =>
  `{"level":"error","time":"2026-11-14T${time}Z","pid":1,"reqId":"${id}","msg":"request failed","method":"POST","path":"/api/checkout","status":500,"ms":${ms},"err":{"type":"TypeError","code":"ERR_INVALID_URL","message":"Invalid URL","input":"undefined/v1/charges","stack":"TypeError: Invalid URL\\n    at new URL (node:internal/url:816:29)\\n    at createCharge (/app/src/payments/client.js:18:15)\\n    at checkout (/app/src/routes/checkout.js:42:24)"}}`

const ok = (time: string, method: string, path: string, ms: number, id: string) =>
  `{"level":"info","time":"2026-11-14T${time}Z","pid":1,"reqId":"${id}","msg":"request completed","method":"${method}","path":"${path}","status":200,"ms":${ms}}`

const recent = [
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
]

const middle = [
  ok('14:02:24.207', 'GET', '/healthz', 1, 'r-0001'),
  ok('14:02:26.930', 'GET', '/api/products?category=produce', 27, 'r-0002'),
  checkoutError('14:02:31.448', 6, 'r-0003'),
  ok('14:02:33.016', 'GET', '/api/cart', 13, 'r-0004'),
]

const apiLogs = [...startup, ...middle, ...recent].join('\n')

const describeDeployment = `Name:                   pantry-api
Namespace:              pantry
CreationTimestamp:      Thu, 16 Apr 2026 09:12:40 +0000
Labels:                 app=pantry-api
Annotations:            deployment.kubernetes.io/revision: 42
                        kubernetes.io/change-cause: release v2.14.0
Selector:               app=pantry-api
Replicas:               3 desired | 3 updated | 3 total | 3 available | 0 unavailable
StrategyType:           RollingUpdate
MinReadySeconds:        0
RollingUpdateStrategy:  25% max unavailable, 25% max surge
Pod Template:
  Labels:  app=pantry-api
  Containers:
   api:
    Image:      registry.example.com/pantry/api:2.14.0
    Port:       8080/TCP
    Host Port:  0/TCP
    Limits:
      cpu:     1
      memory:  512Mi
    Requests:
      cpu:      250m
      memory:   256Mi
    Liveness:   http-get http://:8080/healthz delay=10s timeout=1s period=10s #success=1 #failure=3
    Readiness:  http-get http://:8080/healthz delay=5s timeout=1s period=5s #success=1 #failure=3
    Environment:
      NODE_ENV:             production
      DATABASE_URL:         <set to the key 'url' in secret 'pantry-db'>  Optional: false
      REDIS_URL:            redis://redis:6379
      PAYMENT_SERVICE_URL:  http://payments.payments.svc.cluster.local
    Mounts:                 <none>
  Volumes:                  <none>
Conditions:
  Type           Status  Reason
  ----           ------  ------
  Available      True    MinimumReplicasAvailable
  Progressing    True    NewReplicaSetAvailable
OldReplicaSets:  pantry-api-84b7d5f9cd (0/0 replicas created)
NewReplicaSet:   pantry-api-6d8f9c7b54 (3/3 replicas created)
Events:
  Type    Reason             Age   From                   Message
  ----    ------             ----  ----                   -------
  Normal  ScalingReplicaSet  12m   deployment-controller  Scaled up replica set pantry-api-6d8f9c7b54 to 1
  Normal  ScalingReplicaSet  12m   deployment-controller  Scaled down replica set pantry-api-84b7d5f9cd to 2 from 3
  Normal  ScalingReplicaSet  12m   deployment-controller  Scaled up replica set pantry-api-6d8f9c7b54 to 2 from 1
  Normal  ScalingReplicaSet  11m   deployment-controller  Scaled down replica set pantry-api-84b7d5f9cd to 1 from 2
  Normal  ScalingReplicaSet  11m   deployment-controller  Scaled up replica set pantry-api-6d8f9c7b54 to 3 from 2
  Normal  ScalingReplicaSet  11m   deployment-controller  Scaled down replica set pantry-api-84b7d5f9cd to 0 from 1`

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

const describePod = ({ pod: name, node, nodeIp, ip, started }: (typeof apiPodPlacement)[number]) => `Name:             ${name}
Namespace:        pantry
Priority:         0
Service Account:  pantry-api
Node:             ${node}/${nodeIp}
Start Time:       Sat, 14 Nov 2026 ${started} +0000
Labels:           app=pantry-api
                  pod-template-hash=6d8f9c7b54
Status:           Running
IP:               ${ip}
Controlled By:    ReplicaSet/pantry-api-6d8f9c7b54
Containers:
  api:
    Image:          registry.example.com/pantry/api:2.14.0
    Port:           8080/TCP
    State:          Running
      Started:      Sat, 14 Nov 2026 ${started} +0000
    Ready:          True
    Restart Count:  0
    Limits:
      cpu:     1
      memory:  512Mi
    Requests:
      cpu:      250m
      memory:   256Mi
    Liveness:   http-get http://:8080/healthz delay=10s timeout=1s period=10s #success=1 #failure=3
    Readiness:  http-get http://:8080/healthz delay=5s timeout=1s period=5s #success=1 #failure=3
    Environment:
      NODE_ENV:             production
      DATABASE_URL:         <set to the key 'url' in secret 'pantry-db'>  Optional: false
      REDIS_URL:            redis://redis:6379
      PAYMENT_SERVICE_URL:  http://payments.payments.svc.cluster.local
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
  Normal  Scheduled  12m   default-scheduler  Successfully assigned pantry/${name} to ${node}
  Normal  Pulled     12m   kubelet            Container image "registry.example.com/pantry/api:2.14.0" already present on machine
  Normal  Created    12m   kubelet            Created container api
  Normal  Started    12m   kubelet            Started container api`

const findManifest = { finding: 'manifest-old-name', seenIn: 'PAYMENT_SERVICE_URL' } as const

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
  states: ['failing'],
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
  commands: [
    { match: ['kubectl get pods'], output: getPods, reveals: ['recent-rollout'] },
    { match: ['kubectl get pods -o wide'], output: getPodsWide, reveals: ['recent-rollout'] },
    {
      match: ['kubectl get deployments'],
      output: `NAME         READY   UP-TO-DATE   AVAILABLE   AGE
pantry-api   3/3     3            3           212d
redis        1/1     1            1           212d`,
    },
    {
      match: ['kubectl get replicasets'],
      output: `NAME                    DESIRED   CURRENT   READY   AGE
pantry-api-6d8f9c7b54   3         3         3       12m
pantry-api-84b7d5f9cd   0         0         0       6d
pantry-api-5f7c9d8b6a   0         0         0       19d
redis-7c9d5b8f6         1         1         1       212d`,
      reveals: ['recent-rollout'],
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
      output: `LAST SEEN   TYPE     REASON              OBJECT                            MESSAGE
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
      reveals: ['recent-rollout'],
    },
    {
      match: ['kubectl top pods'],
      output: `NAME                          CPU(cores)   MEMORY(bytes)
pantry-api-6d8f9c7b54-7xk2p   46m          141Mi
pantry-api-6d8f9c7b54-m4q9t   51m          139Mi
pantry-api-6d8f9c7b54-zr8vn   44m          143Mi
postgres-0                    112m         486Mi
redis-7c9d5b8f6-hq2lw         9m           38Mi`,
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
      output: `deployment.apps/pantry-api
REVISION  CHANGE-CAUSE
40        release v2.13.0
41        release v2.13.1
42        release v2.14.0`,
      reveals: ['deploy-correlates'],
    },
    {
      match: ['kubectl rollout history deployment/pantry-api --revision=42'],
      output: revision(42, 'v2.14.0', '6d8f9c7b54'),
      reveals: ['deploy-correlates', findManifest],
    },
    {
      match: ['kubectl rollout history deployment/pantry-api --revision=41'],
      output: revision(41, 'v2.13.1', '84b7d5f9cd'),
    },
    {
      match: ['kubectl rollout status deployment/pantry-api'],
      output: 'deployment "pantry-api" successfully rolled out',
    },
    {
      match: ['kubectl describe deployment/pantry-api'],
      output: describeDeployment,
      reveals: ['deploy-correlates', findManifest],
    },
    ...apiPodPlacement.map((placement) => ({
      match: [`kubectl describe pod/${placement.pod}`],
      output: describePod(placement),
      reveals: [findManifest],
    })),
    {
      match: ['kubectl logs deployment/pantry-api', ...apiPods.map((pod) => `kubectl logs pod/${pod}`)],
      output: apiLogs,
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
      output: '{"status":"ok","version":"2.14.0"}',
    },
  ],
  completions: [...apiPods, 'postgres-0', 'redis-7c9d5b8f6-hq2lw', 'deployment/pantry-api', 'pantry-api'],
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
      command: 'kubectl logs deployment/pantry-api | grep -i warn',
      why: 'An "undefined" address smells like missing configuration. Did the service complain about its configuration when it started?',
      reaches: ['payments-url-missing'],
    },
    {
      command: 'kubectl describe deployment pantry-api',
      why: 'What configuration does the Deployment actually give the container?',
      reaches: ['manifest-old-name'],
    },
  ],
})
