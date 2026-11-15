# 07: Hints

**What to build:** A Hint button gives three tiers (the question, the Playbook Entry, the exact command), chosen by the Learner's investigation progress rather than a fixed list. Hints used are recorded for the Debrief and progress.

**Blocked by:** 03 Investigate Bad Deploy in the terminal

**Status:** resolved

- [x] Three tiers revealed in order
- [x] The Hint shown follows which key findings are reached
- [x] Engine tests for tier order and progress-following

## Comments

- Done. Each Hint has a goal (a Finding, captured evidence, or a named state); the current Hint is the first whose goal is unmet and still reachable, so Hints follow the investigation and skip goals that lost evidence made impossible. Hints used counts tiers revealed, deliberately: asking for the exact command costs more than asking for the question.
- Deferred to ticket 10: the second tier names its Playbook Entry by its question as free text. Replace it with the Entry's stable identifier and a link when the Playbook exists.
