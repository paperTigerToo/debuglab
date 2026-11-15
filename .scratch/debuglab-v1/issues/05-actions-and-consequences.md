# 05: Actions and consequences

**What to build:** The Learner can open a shell inside a container (the prompt shows the location) and run Linux tools there; mutating commands ask for confirmation; a rollback moves the Incident to a mitigated state and the dashboard recovers; evidence can be captured explicitly, and a Mitigation taken before capture destroys it; a harmful action has a visible bad consequence; the Incident can be restarted.

**Blocked by:** 03 Investigate Bad Deploy in the terminal, 04 Bad Deploy dashboard

**Status:** resolved

- [x] Shell into a container and exit; prompt reflects location; commands depend on location
- [x] Mutating commands require confirmation
- [x] Rollback transitions to mitigated and the dashboard reflects it
- [x] Evidence capture recorded; uncaptured evidence lost on Mitigation
- [x] Harmful action shows a bad consequence
- [x] Restart returns the Incident to its start
- [x] Engine tests for location, confirmation, transitions and evidence loss; a "mitigate immediately" replay loses evidence

## Comments

- From the review of tickets 01 and 03: the normaliser knows kubectl flags per program, not per subcommand. `-f` always means `--follow` and `-p` always `--previous`, so `kubectl apply -f x.yaml` and `kubectl patch -p '{...}'` normalise wrongly, and an unknown valued flag such as `--replicas 0` splits into a bare flag and a stray positional. Make flags per subcommand before scripting mutating commands.
- The command schema has no location key and no read-only/mutating mark yet; the spec asks for both ("command table per state and location"; "Commands are marked read-only or mutating"). Add them here.
- Done. Flags are now read per kubectl subcommand. Commands carry `where` (local or container) and an optional `mutating` block (warning, target state, evidence destroyed, consequence); an output left out for a named state means the command does not apply there, and kubectl's own NotFound errors take over. Evidence is captured by saving output to a file (`> file`, `>> file`, `| tee file`) and read back with cat, grep, head and tail. Bad Deploy has three named states: failing, rolled-back and outage (deleting or scaling away pantry-api).
