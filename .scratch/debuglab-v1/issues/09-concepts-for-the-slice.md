# 09: Concepts for the slice

**What to build:** Three Concepts (incident lifecycle, mitigate then investigate, investigating by hypothesis), each a short summary with an interactive example, linked to Playbook Entries and Incidents and citing Resources inline; the Resources page grouped by subject with those sources; and the cross-link check.

**Blocked by:** 08 Tooltips

**Status:** ready-for-agent

- [ ] Three Concepts with interactive examples and links
- [ ] Resources page grouped by subject, each with a reason to read it
- [ ] Content integrity test fails on any unresolved identifier

## Comments

- From ticket 08: tooltips have no links yet. When adding a link field to a term: the tooltip is `aria-hidden` and closes when its trigger loses hover or focus, so a link inside it is unreachable. Make it reachable by keyboard and pointer (no gap that closes it on the way in), and extend the content integrity test so a term's link must resolve.
