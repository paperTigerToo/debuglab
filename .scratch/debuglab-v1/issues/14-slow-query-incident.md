# 14: Slow Query Incident

**What to build:** A Learner can work the Slow Query Incident end to end (latency traced to a database query with a missing index): its data file, dashboard data, command table, Hints, Root Cause and Mitigation options and Debrief content, plus the Playbook Entries, terms and Resources it needs.

**Blocked by:** 12 Slice checkpoint

**Status:** resolved

- [x] Incident data file read by the existing engine without engine changes for its content
- [x] New Playbook Entries, terms and Resources linked and passing the integrity check
- [x] Expert Path replay and "mitigate immediately" replay tests
- [x] Browser test completes the Incident by typing its Expert Path

## Comments

- Resolved with ticket 13. Release v2.16.0 runs migration 0042, which drops orders_customer_id_idx as "unused"; the order-history lookup seq-scans 4.2 million rows and saturates PostgreSQL. Rolling back pantry-api changes nothing (a rollout undo restores code, not schema); the best Mitigation is CREATE INDEX CONCURRENTLY. Named states: slow, rolled-back, indexed, rolled-back-indexed. Evidence: a pg_stat_activity snapshot, saved with `| tee FILE`.
- New Playbook Entries (the Database layer is now populated): What is the database doing right now?; Which queries are slow?; Why is this query slow?; How do I add an index without blocking writes?. New Resources: pg-monitoring-stats, pg-logging, pg-using-explain, pg-indexes, pg-create-index.
- Accepted deviation from "without engine changes for its content": three small, general engine changes. psql flags (-U, -d, -c) are now known, so flag order does not matter; `kubectl exec POD -- CMD` keeps quoted arguments whole (a real bug for any quoted argument); dashboard data names what its saturation graph measures (`saturationOf`). A state goal for a Hint or Expert Path step may name several states. None is specific to one Incident.
- shellPodPrefix is postgres-0, so the Learner can shell into the database but not into pantry-api in this Incident (the engine allows one prefix per Incident).
- SQL is matched exactly, apart from a closing semicolon and letter case (listed by hand in `sqlSpellings`). Extra spaces inside a statement do not match. The Hint and Playbook Entry give the exact text, and the Playbook has copy buttons.
