# 03: Investigate Bad Deploy in the terminal

**What to build:** A Learner opens the Bad Deploy Incident in the Incident Lab, reads the alert that paged them, and investigates by typing read-only commands into a simulated terminal. Output looks like the real tools. Flag order, spacing and short/long flags are forgiving; tab completion and up/down history work; a real but unscripted command replies "not simulated here"; an unrecognised one gets a typo suggestion. Includes the pure Incident engine, the typed Incident definition format, and the Expert Path replay test.

**Blocked by:** 01 Walking skeleton

**Status:** resolved

- [x] Incident engine is a pure module: (Incident definition, session state, input) to (new state, display)
- [x] Bad Deploy is one typed data file read by the engine
- [x] Command normalisation accepts whitespace, flag-order and short/long flag variations
- [x] "Not simulated here" reply for known-but-unscripted commands; typo suggestion for unknown ones
- [x] Tab completion of commands and resource names; up/down history
- [x] Key findings are recorded when the Learner reaches them
- [x] Engine tests cover normalisation, both failure replies and finding progress
- [x] Expert Path replay test reaches every key finding for Bad Deploy
- [x] Browser test types the Expert Path's read-only commands and sees the expected output

## Comments

- Done. Beyond the ticket: pipes into `grep` (with -i -v -c -E), `head`, `tail` and `wc -l`; any `kubectl logs --tail N`; `help` and `clear`; a Findings panel. A Finding can require its evidence to be on screen (`seenIn`), so `--tail` or a pipe that hides it does not count. Typos in kube resource types and pod names get kubectl's own errors.
