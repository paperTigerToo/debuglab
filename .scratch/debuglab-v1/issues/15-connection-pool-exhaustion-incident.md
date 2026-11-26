# 15: Connection Pool Exhaustion Incident

**What to build:** A Learner can work the Connection Pool Exhaustion Incident end to end (a slow dependency exhausting the connection pool so a healthy service hangs): its data file, dashboard data, command table, Hints, Root Cause and Mitigation options and Debrief content, plus the Playbook Entries, terms and Resources it needs.

**Blocked by:** 12 Slice checkpoint

**Status:** resolved

- [x] Incident data file read by the existing engine without engine changes for its content
- [x] New Playbook Entries, terms and Resources linked and passing the integrity check
- [x] Expert Path replay and "mitigate immediately" replay tests
- [x] Browser test completes the Incident by typing its Expert Path

## Comments

- From the review of tickets 13 and 14: each Incident file still repeats kubectl table renderers (get pods, top pods), the pod spec block, describeDeployment, the dashboard `timeline` helper and the JSON log-line builder. Move them into `src/incidents/build.ts` as the next Incident needs them, rather than copying a fourth time.
- From ticket 14: SQL spelling variants (closing semicolon, case) are listed by hand per statement. If this Incident runs psql too, normalise SQL in the engine instead (trailing `;`, case of keywords, runs of spaces) and delete `sqlSpellings`. The Slow Query Playbook Entries on pg_stat_activity can be reused.
- Resolved 2026-11-26. Nothing was deployed: the payments service slows to about 20 seconds a charge, and pantry-api's checkout holds a database connection in an open transaction while it waits (PAYMENTS_TIMEOUT_MS is 30000). All 30 connections stick, every other request waits 5 seconds for one and fails with 503, while the pods and PostgreSQL look idle. Named states: exhausted, failing-fast, restarted. Evidence: pg_stat_activity's connections idle in transaction, saved with `| tee FILE`. Best Mitigation: `kubectl set env deployment/pantry-api PAYMENTS_TIMEOUT_MS=2000`.
- The alert is PantryApiHighErrorRate, the same one Bad Deploy fires, on purpose: the same alert can have a different cause.
- New Playbook Entries: Is the service waiting for database connections?; Is a dependency slow? (the first in the Network layer); How do I change a setting without a release?. New Resources: kubectl-set-env, node-postgres-pool, pg-client-config, sre-cascading-failures, fowler-circuit-breaker (new subject: Resilience).
- Both comments above are done. SQL is normalised in the engine (keyword case, runs of spaces, a closing semicolon, and `-d` naming the role's own database); string literals keep their case. `sqlSpellings` is gone. build.ts now holds kubectlTable, podsTable, runningPod, topTable, psqlTable, appLog and samples; every Incident uses them, and the snapshot of all outputs before and after changed only kubectl column widths, which now size the way kubectl does.
- Engine change, general rather than content-specific: the psql normalisation above. Recorded as an accepted deviation like tickets 13 and 14.
- From the review: `ps` was removed from postgres-0 in this Incident and in Slow Query, because the official postgres image does not include it.
- Not scripted: `kubectl set env deployment/pantry-api CHECKOUT_ENABLED=false` (offered as a Mitigation in the finish form only) and scaling up.
