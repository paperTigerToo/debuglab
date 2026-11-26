# 13: Memory Leak Incident

**What to build:** A Learner can work the Memory Leak Incident end to end (out-of-memory kills and a restart loop): its data file, dashboard data, command table, Hints, Root Cause and Mitigation options and Debrief content, plus the Playbook Entries, terms and Resources it needs.

**Blocked by:** 12 Slice checkpoint

**Status:** resolved

- [x] Incident data file read by the existing engine without engine changes for its content
- [x] New Playbook Entries, terms and Resources linked and passing the integrity check
- [x] Expert Path replay and "mitigate immediately" replay tests
- [x] Browser test completes the Incident by typing its Expert Path

## Comments

- Resolved with ticket 14. Release v2.15.0 adds an unbounded search cache keyed per shopper; containers are OOMKilled (exit 137) every 35 to 40 minutes. Named states: leaking, restarted, rolled-back, outage. Evidence: the leaking process's /metrics, saved with `kubectl exec POD -- curl -s localhost:8080/metrics > FILE`.
- New Playbook Entries: Why does this container keep restarting?; Which pods are using the most CPU and memory?; What is the process holding in memory?. New Resources: k8s-pod-failure-reason, k8s-assign-memory, k8s-manage-resources, nodejs-memory-diagnostics, gregg-memory-leaks.
- Accepted deviation from "without engine changes for its content": three small, general engine changes. psql flags (-U, -d, -c) are now known, so flag order does not matter; `kubectl exec POD -- CMD` keeps quoted arguments whole (a real bug for any quoted argument); dashboard data names what its saturation graph measures (`saturationOf`). A state goal for a Hint or Expert Path step may name several states. None is specific to one Incident.
- `rollout restart` gives new pod names and a new revision, so a plain `rollout undo` afterwards returns to the same leaking release; only `--to-revision=44` reaches v2.14.1. Covered by a test.
- NODE_OPTIONS sets the V8 heap ceiling (768MB) above the 512Mi container limit, so the kernel kills the process first: OOMKilled, not "JavaScript heap out of memory".
- Partial for spec story 60 ("record a memory snapshot"): the Evidence is a metrics scrape. A heap snapshot appears only as a Playbook command (`kill -USR2 1`), not scripted in the Incident.
- Simplification: container commands are not per pod, so `curl localhost:8080/metrics` reports the fullest pod (n2x8v) whichever pod you exec into. `kubectl logs` does differ per pod.
