# 03: Investigate Bad Deploy in the terminal

**What to build:** A Learner opens the Bad Deploy Incident in the Incident Lab, reads the alert that paged them, and investigates by typing read-only commands into a simulated terminal. Output looks like the real tools. Flag order, spacing and short/long flags are forgiving; tab completion and up/down history work; a real but unscripted command replies "not simulated here"; an unrecognised one gets a typo suggestion. Includes the pure Incident engine, the typed Incident definition format, and the Expert Path replay test.

**Blocked by:** 01 Walking skeleton

**Status:** ready-for-agent

- [ ] Incident engine is a pure module: (Incident definition, session state, input) to (new state, display)
- [ ] Bad Deploy is one typed data file read by the engine
- [ ] Command normalisation accepts whitespace, flag-order and short/long flag variations
- [ ] "Not simulated here" reply for known-but-unscripted commands; typo suggestion for unknown ones
- [ ] Tab completion of commands and resource names; up/down history
- [ ] Key findings are recorded when the Learner reaches them
- [ ] Engine tests cover normalisation, both failure replies and finding progress
- [ ] Expert Path replay test reaches every key finding for Bad Deploy
- [ ] Browser test types the Expert Path's read-only commands and sees the expected output
