# 15: Connection Pool Exhaustion Incident

**What to build:** A Learner can work the Connection Pool Exhaustion Incident end to end (a slow dependency exhausting the connection pool so a healthy service hangs): its data file, dashboard data, command table, Hints, Root Cause and Mitigation options and Debrief content, plus the Playbook Entries, terms and Resources it needs.

**Blocked by:** 12 Slice checkpoint

**Status:** ready-for-agent

- [ ] Incident data file read by the existing engine without engine changes for its content
- [ ] New Playbook Entries, terms and Resources linked and passing the integrity check
- [ ] Expert Path replay and "mitigate immediately" replay tests
- [ ] Browser test completes the Incident by typing its Expert Path

## Comments

- From the review of tickets 13 and 14: each Incident file still repeats kubectl table renderers (get pods, top pods), the pod spec block, describeDeployment, the dashboard `timeline` helper and the JSON log-line builder. Move them into `src/incidents/build.ts` as the next Incident needs them, rather than copying a fourth time.
- From ticket 14: SQL spelling variants (closing semicolon, case) are listed by hand per statement. If this Incident runs psql too, normalise SQL in the engine instead (trailing `;`, case of keywords, runs of spaces) and delete `sqlSpellings`. The Slow Query Playbook Entries on pg_stat_activity can be reused.
