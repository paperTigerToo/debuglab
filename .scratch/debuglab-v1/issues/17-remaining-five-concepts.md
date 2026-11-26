# 17: Remaining five Concepts

**What to build:** Concepts on observability, golden signals and alerting, working safely in production, prevention, and blameless postmortems, each a short summary with an interactive example, linked to Playbook Entries, Incidents and Resources.

**Blocked by:** 12 Slice checkpoint

**Status:** ready-for-agent

- [ ] Five Concepts with interactive examples
- [ ] Links resolve under the integrity check

## Comments

- From ticket 09: the content integrity test requires every Concept to be practised by at least one Incident (via the Incident's links), so each new Concept needs an Incident that names it. Concept summaries must stay plain text; links go in the body. The Debrief's "Study next" lists the Incident's linked Concepts, so link the prevention Concept from Bad Deploy to satisfy spec story 76.
- From tickets 13 and 14: Memory Leak and Slow Query both turn on the saturation signal (memory of limit, database CPU), so link the golden signals Concept from both. Slow Query's lesson "a rollback restores code, not the database" belongs in the prevention or working-safely Concept.
- From ticket 16: Full Disk turns on saturation of a non-CPU resource (disk capacity), as Connection Pool does (database connections). The golden signals Concept can use both; the USE method Resource (gregg-use-method) fits it. The working-safely Concept can use the pg_wal trap: know what must never be deleted.
