# 05: Actions and consequences

**What to build:** The Learner can open a shell inside a container (the prompt shows the location) and run Linux tools there; mutating commands ask for confirmation; a rollback moves the Incident to a mitigated state and the dashboard recovers; evidence can be captured explicitly, and a Mitigation taken before capture destroys it; a harmful action has a visible bad consequence; the Incident can be restarted.

**Blocked by:** 03 Investigate Bad Deploy in the terminal, 04 Bad Deploy dashboard

**Status:** ready-for-agent

- [ ] Shell into a container and exit; prompt reflects location; commands depend on location
- [ ] Mutating commands require confirmation
- [ ] Rollback transitions to mitigated and the dashboard reflects it
- [ ] Evidence capture recorded; uncaptured evidence lost on Mitigation
- [ ] Harmful action shows a bad consequence
- [ ] Restart returns the Incident to its start
- [ ] Engine tests for location, confirmation, transitions and evidence loss; a "mitigate immediately" replay loses evidence
