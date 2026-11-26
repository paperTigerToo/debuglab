# 16: Full Disk Incident

**What to build:** A Learner can work the Full Disk Incident end to end (a full disk causing write failures, and finding what filled it): its data file, dashboard data, command table, Hints, Root Cause and Mitigation options and Debrief content, plus the Playbook Entries, terms and Resources it needs.

**Blocked by:** 12 Slice checkpoint

**Status:** resolved

- [x] Incident data file read by the existing engine without engine changes for its content
- [x] New Playbook Entries, terms and Resources linked and passing the integrity check
- [x] Expert Path replay and "mitigate immediately" replay tests
- [x] Browser test completes the Incident by typing its Expert Path

## Comments

- From the review of tickets 13 and 14: each Incident file still repeats kubectl table renderers (get pods, top pods), the pod spec block, describeDeployment, the dashboard `timeline` helper and the JSON log-line builder. Move them into `src/incidents/build.ts` as the next Incident needs them, rather than copying a fourth time.
- From the review of ticket 15: describeDeployment and the pod spec block are still written per Incident (their environments differ); share them if Full Disk needs one. Slow Query's topPods still indexes parallel arrays (apiCpu[i]); Connection Pool now puts age, CPU and memory on each pod, which is the pattern to follow.
- Resolved 2026-11-27. After Tuesday's Slow Query Incident a teammate turned on PostgreSQL's logging collector (one file a day) and set log_min_duration_statement to 0 with ALTER SYSTEM. PostgreSQL has logged every statement, about 6 GB a day, into its own 20Gi data volume, which fills on Friday: writes fail with "No space left on device" (SQLSTATE 53100), reads work. The clue is `kubectl logs postgres-0` showing only "redirecting log output to logging collector process". Named states: full, logs-cleared, expanded, wal-deleted. Evidence: the log file listing, saved with `| tee FILE`. Best Mitigation: delete the old log files. The trap: deleting pg_wal, the write-ahead log, which crashes PostgreSQL for good (it was renamed from pg_xlog for this reason).
- The first design used a replication slot filling pg_wal, but PostgreSQL usually crashes when it cannot write WAL, so writes-fail-while-reads-work would have been untrue. The logging story keeps the database up honestly.
- New Playbook Entries: Is a disk full, and which one?; What is filling the disk?; How do I free disk space safely? (the Host layer, so every layer now has Entries); What settings is PostgreSQL running with?. New Resources: k8s-persistent-volumes, gregg-use-method, pg-wal-intro, pg-alter-system.
- Engine changes, both general: kubectl knows PersistentVolumeClaims, PersistentVolumes and StorageClasses by every name. `kubectl exec POD -- CMD` now behaves like the real thing with globs: with no shell, `*` reaches the program as a file name and fails ("du: cannot access ..."), while `sh -c '...'` runs the script through the container's shell. The Expert Path, Hints and Playbook use `sh -c` where a glob is needed.
- From the review: all per-state facts (capacity, disk usage, whether PostgreSQL is up) live in one record; after pg_wal is deleted the container crash-loops, so `kubectl exec` into it fails; du stops counting a deleted file PostgreSQL still holds open while df still does; df allows for ext4's reserved 5%; the dashboard's disk graph fills at the stated 4 MB a minute.
- Not scripted: resetting log_min_duration_statement (ALTER SYSTEM RESET, then SELECT pg_reload_conf()). It changes nothing the dashboard shows, needs two statements, and the postmortem and Mitigation options cover it as the second step.
- Ticket 15's comment on describeDeployment: Full Disk needed none.
