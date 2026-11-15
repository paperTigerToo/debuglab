# 08: Tooltips

**What to build:** One term list drives explanations for terms, commands and flags in prose, in commands and in simulated terminal output. Tooltips open on hover, tap and keyboard focus, are announced to assistive technology, and link to a fuller Concept or Playbook Entry where one exists.

**Blocked by:** 03 Investigate Bad Deploy in the terminal

**Status:** resolved

- [x] Single typed term list
- [x] Terms recognised in prose, commands and terminal output
- [x] Hover, tap and focus open the tooltip; accessible
- [x] Browser test opens a tooltip by hover and by keyboard focus

## Comments

- Resolved. One term list (`terms`) drives every tooltip; glossary words are worded as in GLOSSARY.md. Terms are annotated in prose, Hints, the Debrief, the alert, chart titles, deploy history, the access log header and terminal input and output. Each term is marked once per block, and once across the whole terminal log. Tooltips open on hover and focus, pin on tap, close on Escape (however opened), a second tap or a tap elsewhere; screen readers hear the explanation as the term's description. Unit tests cover matching; browser tests cover hover, focus, tap, Escape and the terminal.
- Not done here: links from a tooltip to a Concept or Playbook Entry, because none exist yet. Moved to tickets 09 and 10 (see their comments).
- Review notes left for the checkpoint (12): `terms` mixes glossary words, Kubernetes and shell reference, and Bad Deploy specifics (`PAYMENTS_URL`, `ERR_INVALID_URL`); a number such as 500 is marked as a status code wherever it appears.
