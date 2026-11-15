# 10: Playbook for the slice

**What to build:** The Playbook Entries Bad Deploy uses, titled as questions, grouped by layer, searchable by question, command or term, each with copyable commands, read-only/mutating marks, annotated healthy and unhealthy output, follow-on questions and links.

**Blocked by:** 08 Tooltips

**Status:** ready-for-agent

- [ ] Entries grouped by layer with all listed parts
- [ ] Search across question, command and term
- [ ] Copy button on each command
- [ ] Browser test searches the Playbook and opens an entry; a deep link to an entry loads directly

## Comments

- From ticket 07: Bad Deploy's Hints name Playbook Entries by question text (`playbook` field). Give each Entry a stable identifier, switch the Hints to it, and link it from the Hint panel and the Debrief.
- From ticket 08: tooltips have no links yet. When adding a link field to a term: the tooltip is `aria-hidden` and closes when its trigger loses hover or focus, so a link inside it is unreachable. Make it reachable by keyboard and pointer (no gap that closes it on the way in), and extend the content integrity test so a term's link must resolve.
