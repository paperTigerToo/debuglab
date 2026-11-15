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

## Comments

- From the review of tickets 01 and 03: the normaliser knows kubectl flags per program, not per subcommand. `-f` always means `--follow` and `-p` always `--previous`, so `kubectl apply -f x.yaml` and `kubectl patch -p '{...}'` normalise wrongly, and an unknown valued flag such as `--replicas 0` splits into a bare flag and a stray positional. Make flags per subcommand before scripting mutating commands.
- The command schema has no location key and no read-only/mutating mark yet; the spec asks for both ("command table per state and location"; "Commands are marked read-only or mutating"). Add them here.
