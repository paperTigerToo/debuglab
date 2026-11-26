# 16: Full Disk Incident

**What to build:** A Learner can work the Full Disk Incident end to end (a full disk causing write failures, and finding what filled it): its data file, dashboard data, command table, Hints, Root Cause and Mitigation options and Debrief content, plus the Playbook Entries, terms and Resources it needs.

**Blocked by:** 12 Slice checkpoint

**Status:** ready-for-agent

- [ ] Incident data file read by the existing engine without engine changes for its content
- [ ] New Playbook Entries, terms and Resources linked and passing the integrity check
- [ ] Expert Path replay and "mitigate immediately" replay tests
- [ ] Browser test completes the Incident by typing its Expert Path

## Comments

- From the review of tickets 13 and 14: each Incident file still repeats kubectl table renderers (get pods, top pods), the pod spec block, describeDeployment, the dashboard `timeline` helper and the JSON log-line builder. Move them into `src/incidents/build.ts` as the next Incident needs them, rather than copying a fourth time.
- From the review of ticket 15: describeDeployment and the pod spec block are still written per Incident (their environments differ); share them if Full Disk needs one. Slow Query's topPods still indexes parallel arrays (apiCpu[i]); Connection Pool now puts age, CPU and memory on each pod, which is the pattern to follow.
