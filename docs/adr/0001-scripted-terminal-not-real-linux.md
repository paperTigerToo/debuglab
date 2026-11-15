# The Incident Lab terminal is scripted, not a real Linux system

The site is hosted on GitHub Pages, which serves only static files, so an Incident cannot run against a real server. We decided each Incident is a data file that maps the commands a Learner may type to canned, realistic output across a few named states, read by one shared engine. Commands outside an Incident's script reply "not simulated here".

## Considered Options

- **A real Linux system in the browser through WebAssembly.** Rejected: it cannot run Kubernetes, PostgreSQL and Redis together at usable speed, the download would be very large, and reproducing a specific failure inside it reliably is harder than scripting it.
- **A read-only guide with quizzes.** Rejected: it explains investigation without letting the Learner practise it.

## Consequences

- Every command an Incident accepts must be written by hand, so an Incident only teaches the paths its author anticipated.
- Output can drift from what the real tools print; it must be modelled on real output and checked when tools change format.
- Each Incident needs a test that replays its Expert Path, because nothing else proves it can be solved.
