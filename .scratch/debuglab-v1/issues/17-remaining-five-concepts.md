# 17: Remaining five Concepts

**What to build:** Concepts on observability, golden signals and alerting, working safely in production, prevention, and blameless postmortems, each a short summary with an interactive example, linked to Playbook Entries, Incidents and Resources.

**Blocked by:** 12 Slice checkpoint

**Status:** resolved

- [x] Five Concepts with interactive examples
- [x] Links resolve under the integrity check

## Comments

- From ticket 09: the content integrity test requires every Concept to be practised by at least one Incident (via the Incident's links), so each new Concept needs an Incident that names it. Concept summaries must stay plain text; links go in the body. The Debrief's "Study next" lists the Incident's linked Concepts, so link the prevention Concept from Bad Deploy to satisfy spec story 76.
- From tickets 13 and 14: Memory Leak and Slow Query both turn on the saturation signal (memory of limit, database CPU), so link the golden signals Concept from both. Slow Query's lesson "a rollback restores code, not the database" belongs in the prevention or working-safely Concept.
- From ticket 16: Full Disk turns on saturation of a non-CPU resource (disk capacity), as Connection Pool does (database connections). The golden signals Concept can use both; the USE method Resource (gregg-use-method) fits it. The working-safely Concept can use the pg_wal trap: know what must never be deleted.
- Resolved 2026-11-26. Five Concepts, in the spec's reading order among the first three (lifecycle, mitigate first, observability, golden signals and alerting, hypothesis, working safely, prevention, blameless postmortems). Examples: "Which signal answers it?" (logs, metrics or traces for four questions); "Tune the alert" (a threshold and a duration over half an hour of Bad Deploy's error rate, showing false pages, missed pages and error budget spent); "What can it break?" (sorting six commands into reads, changes or destroys); "What would have caught it?" (the safeguard for each of the five Incidents); "Blame or system?" (marking postmortem sentences and seeing blaming ones rewritten). Four share one ChoiceQuiz component.
- All three earlier comments are acted on: every Incident links the prevention Concept (story 76); the saturation Incidents link golden signals, which cites the USE method; working safely carries "a rollback restores code, never data or schema" and the pg_wal trap.
- Eleven Resources, under two new subjects (Monitoring and alerting; Releasing safely) and Kubernetes. Etsy's blameless postmortem article was left out: its site refuses automated requests, so its link cannot be checked.
- From the review: each Incident links only the Concepts it exercises, so the Debrief's Study next stays short; the alert example's baseline sits within its own 99.9% objective and its budget counts the whole half hour; the Memory Leak quiz accepts a soak test as well as a feature flag; each quiz has its own nudge; the trace term no longer matches "stack trace".
