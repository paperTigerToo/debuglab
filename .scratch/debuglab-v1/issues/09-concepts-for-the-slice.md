# 09: Concepts for the slice

**What to build:** Three Concepts (incident lifecycle, mitigate then investigate, investigating by hypothesis), each a short summary with an interactive example, linked to Playbook Entries and Incidents and citing Resources inline; the Resources page grouped by subject with those sources; and the cross-link check.

**Blocked by:** 08 Tooltips

**Status:** resolved

- [x] Three Concepts with interactive examples and links
- [x] Resources page grouped by subject, each with a reason to read it
- [x] Content integrity test fails on any unresolved identifier

## Comments

- From ticket 08: tooltips have no links yet. When adding a link field to a term: the tooltip is `aria-hidden` and closes when its trigger loses hover or focus, so a link inside it is unreachable. Make it reachable by keyboard and pointer (no gap that closes it on the way in), and extend the content integrity test so a term's link must resolve.
- Resolved. Three Concepts, each with an interactive example (lifecycle stages, choosing the order of mitigation, testing hypotheses), linked to Bad Deploy and citing Resources inline as `[text](kind:id)`. The Resources page groups nine primary sources by subject, each with a reason to read it. The content integrity test resolves every Concept link, term Concept link and Incident link, fails on link markup that does not parse, requires every Resource to be cited, secure and explained, and requires every Concept to be practised by an Incident. Tooltips now link to their Concept, reachable by pointer and keyboard (Enter moves focus to the link; Tab or Escape returns to the term). The Debrief gains "Study next".
- Deferred: links from Concepts to Playbook Entries (ticket 10, which creates them); the Debrief's prevention Concept link (ticket 17).
- Review leftovers, not fixed here: GLOSSARY.md does not yet define the everyday sense of incident (the `incident-general` term), Subject, hypothesis, the lifecycle stages or the Debrief's "Study next"; worth a /domain-modeling pass. Concept and Resource ids are bare strings, so only the integrity test catches typos; a typed id union is an option. TermTip carries hover, pinning and focus hand-off in one component.
