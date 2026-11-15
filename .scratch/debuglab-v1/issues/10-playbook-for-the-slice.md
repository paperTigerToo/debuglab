# 10: Playbook for the slice

**What to build:** The Playbook Entries Bad Deploy uses, titled as questions, grouped by layer, searchable by question, command or term, each with copyable commands, read-only/mutating marks, annotated healthy and unhealthy output, follow-on questions and links.

**Blocked by:** 08 Tooltips

**Status:** resolved

- [x] Entries grouped by layer with all listed parts
- [x] Search across question, command and term
- [x] Copy button on each command
- [x] Browser test searches the Playbook and opens an entry; a deep link to an entry loads directly

## Comments

- From ticket 07: Bad Deploy's Hints name Playbook Entries by question text (`playbook` field). Give each Entry a stable identifier, switch the Hints to it, and link it from the Hint panel and the Debrief.
- From ticket 08: tooltips have no links yet. When adding a link field to a term: the tooltip is `aria-hidden` and closes when its trigger loses hover or focus, so a link inside it is unreachable. Make it reachable by keyboard and pointer (no gap that closes it on the way in), and extend the content integrity test so a term's link must resolve.
- From ticket 09: Concepts do not yet link to Playbook Entries, because none existed. Add a `playbook` link kind to content prose (`[text](playbook:id)`, parsed in the content prose module and given a path in the site paths module), link each Concept to the Entries it relies on, and let terms gain a Playbook link if useful. Extend the content integrity test so every new link resolves; it already fails on link markup it cannot parse, so a `playbook:` link fails until the kind is added.
- Resolved. Six Playbook Entries for Bad Deploy, titled as questions and grouped by layer (Cluster, Container, Application; empty layers are hidden). Each has commands with a copy button and a read-only or "changes the system" mark, healthy and unhealthy sample output with numbered notes, what to ask next, and links to the Incidents that use it, its Concepts and Resources. Search covers question, command and sample output, and a term's other spellings ("printenv" finds env); the query stays in the address. Hints name Entries by identifier and link to them; the Debrief lists the Entries the Incident used and marks those the Learner needed a Hint for. Concepts link to Entries through `[text](playbook:id)`, and three terms (rollout history, rollout undo, logs) link their tooltip to an Entry. The integrity test resolves every new link, checks each sample note points at text in its output, and requires every Entry to be used by an Incident. Two Kubernetes Resources added.
- Also fixed from review: Bad Deploy's oldest ReplicaSet hash used a character Kubernetes never generates (now `5f7c9d8b6z`), and its 8 November ReplicaSet showed `6d` where kubectl prints `6d3h`.
- Review leftovers, not fixed here: terms in the sample output have no tooltips, because the output is split into marked spans. A term's `concept?` and `playbook?` could become one `deeper` link so "one or the other" is structural rather than tested. The `playbook` field on Hint and Term holds an Entry id; `playbookEntry` would say so. Adding a link kind still touches the prose type, its pattern, the site paths and the integrity switch. GLOSSARY.md has no entry for layer, the Playbook as a whole, or follow-on questions.

