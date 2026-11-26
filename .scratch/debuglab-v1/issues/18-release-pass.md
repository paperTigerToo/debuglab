# 18: Release pass

**What to build:** The Target System briefing, the suggested path on the home page, the complete Resources page with every link opened and confirmed live, and a final check across all five Incidents.

**Blocked by:** 13 Memory Leak Incident, 14 Slow Query Incident, 15 Connection Pool Exhaustion Incident, 16 Full Disk Incident, 17 Remaining five Concepts

**Status:** ready-for-agent

- [ ] Target System briefing page
- [ ] Suggested path on the home page
- [ ] Every Resource link opened and confirmed live
- [ ] All five Incidents worked end to end in the browser

## Comments

- From tickets 13 and 14: the ten new Resource links answered 200 on 2026-11-25; check them again here.
- From the review of ticket 16: each Incident still declares its own `Pod` type, in four different shapes (some with age, CPU or memory per state). Unify them in build.ts if the release pass touches them; nothing breaks if left. A new kube resource type needs both `kubeResourceTypes` and, when its plural is irregular, `notFoundKind` in the engine.
