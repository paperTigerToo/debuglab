# 06: Finish and Debrief

**What to build:** The Learner declares a Root Cause from a short list and chooses a Mitigation, then sees the Debrief: their timeline beside the Expert Path, evidence kept and lost, separate verdicts for harm stopped and Root Cause found (with contradicting evidence for a wrong choice), a sample postmortem and prevention notes. The Incident list shows completion, saved in the browser and resettable.

**Blocked by:** 05 Actions and consequences

**Status:** resolved

- [x] Root Cause and Mitigation choices
- [x] Debrief derived from session state and the Incident definition, with all listed sections
- [x] Incident list with completion status; progress persisted, resettable, works without storage
- [x] Engine tests for verdicts and Debrief contents
- [x] Browser test completes Bad Deploy by typing its Expert Path and reaches the Debrief; progress persists across reload

## Comments

- Done. The engine takes a `finish` input (Root Cause plus Mitigation) and derives the Debrief. The Debrief keeps the two verdicts apart: harm stopped is judged from what the Learner's commands did (the alert resolved), and the Mitigation picked in the form is graded on its own. Expert Path steps count as covered by what they achieve (Findings reached, evidence captured, named state reached), not by exact wording. Progress keeps a completed Incident completed even after a weaker later attempt.
- Known gap: Hints used are saved to progress when the Incident is finished, not while it is in progress; a reload mid-Incident loses the session.
- Deferred to tickets 09 and 10: the Debrief does not yet link to Concepts, Playbook Entries or Resources, and the Incident definition has no links field yet.
