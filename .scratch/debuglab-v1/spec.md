# DebugLab v1: a lab for learning to debug a live web service

Status: ready-for-agent

Vocabulary follows `GLOSSARY.md`. The scripted-terminal decision is recorded in `docs/adr/0001-scripted-terminal-not-real-linux.md`.

## Problem Statement

I can write code and use a terminal, but I have never been on call and do not know how to debug a system that is live and failing. When I read about it I find either abstract advice ("improve observability") or isolated commands with no context for when to reach for them. I also do not want to learn only the reflex of rolling back to the previous release: I want to know how to find out what actually went wrong, and how to prevent it. There is nowhere I can practise this safely, because practising requires a production system that is broken.

## Solution

A static website, hosted on GitHub Pages, with four areas:

- **Concepts**: broad explanations of how production debugging works and how failures are prevented.
- **Playbook**: granular Playbook Entries, each a question an investigator asks, answered with real commands and annotated output.
- **Incident Lab**: five scripted Incidents against one fictional Target System. The Learner sees Symptoms on a dashboard, types real commands into a simulated terminal, mitigates, identifies the Root Cause and receives a Debrief.
- **Resources**: curated links to primary sources, also cited inline from the other three areas.

Every term, command and flag shows an explanation on hover, tap or keyboard focus. Motion is used where it carries meaning. The central lesson is: mitigate first, then investigate, and capture evidence before the Mitigation destroys it.

## User Stories

### Finding my way around

1. As a Learner, I want a home page that explains what the site is and offers the four areas, so that I know where to start.
2. As a Learner, I want a suggested path (a Concept, then the first Incident), so that I am not left to choose with no basis.
3. As a Learner, I want persistent navigation between Concepts, Playbook, Incident Lab and Resources, so that I can move between broad and granular material at any time.
4. As a Learner, I want every page to have its own shareable address that survives a browser refresh on GitHub Pages, so that I can bookmark and link to it.
5. As a Learner, I want a dark operations-console look with a light theme toggle, so that the site fits the subject and I can still read it in a bright room.
6. As a Learner, I want my theme choice remembered, so that I do not set it on every visit.

### Concepts

7. As a Learner, I want a Concept on the incident lifecycle (detect, triage, mitigate, investigate, resolve, review), so that I have a frame for everything else.
8. As a Learner, I want a Concept on mitigating first and investigating second, including how to preserve evidence, so that I learn the correct order and why.
9. As a Learner, I want a Concept on observability (logs, metrics, traces), so that I know what each kind of evidence can and cannot tell me.
10. As a Learner, I want a Concept on golden signals, service level objectives and alerting, so that I can read a dashboard and understand why an alert fired.
11. As a Learner, I want a Concept on investigating by hypothesis (what changed, narrowing scope, bisecting), so that I have a method and not only tools.
12. As a Learner, I want a Concept on working safely in production (read-only first, limiting blast radius, access and audit), so that I do not make an Incident worse.
13. As a Learner, I want a Concept on prevention (canary releases, feature flags, fast rollbacks, load testing), so that I know how failures are stopped before they reach users.
14. As a Learner, I want a Concept on blameless postmortems, so that I know what happens after the Incident and what a good one contains.
15. As a Learner, I want each Concept to be a short summary with an interactive diagram or example, so that I absorb it faster than from prose alone.
16. As a Learner, I want each Concept to link to the Playbook Entries and Incidents that exercise it, so that I can go from the idea to the practice.
17. As a Learner, I want each Concept to cite Resources inline, so that I can read the authoritative source in depth.

### Playbook

18. As a Learner, I want Playbook Entries titled as questions ("Is the container being killed for memory?"), so that I can find one by what I want to know.
19. As a Learner, I want Playbook Entries grouped by layer (cluster, container, host, network, database, application), so that I can browse the layer I suspect.
20. As a Learner, I want to search across all Playbook Entries by question, command or term, so that I find an entry in seconds.
21. As a Learner, I want each Playbook Entry to show the exact commands with a copy button, so that I can reuse them on a real system.
22. As a Learner, I want each Playbook Entry to show realistic sample output with the important parts annotated, so that I know what to look for.
23. As a Learner, I want each Playbook Entry to say what a healthy result looks like next to an unhealthy one, so that I can tell the difference.
24. As a Learner, I want each Playbook Entry to say whether its commands are read-only or change the system, so that I know what is safe to run.
25. As a Learner, I want each Playbook Entry to name the next question to ask depending on the result, so that I learn how an investigation chains.
26. As a Learner, I want each Playbook Entry to link to its Concept, to Incidents that use it and to Resources, so that the granular connects back to the broad.

### Tooltips

27. As a Learner, I want any technical term to show a short explanation on hover, so that I never have to leave the page to understand a word.
28. As a Learner, I want commands and individual flags to show what they do on hover, so that I understand a command and do not just copy it.
29. As a Learner, I want terms inside simulated terminal output and dashboard panels to have the same tooltips, so that the output itself teaches me.
30. As a Learner, I want the same term to show the same explanation everywhere, so that I am not confused by varying definitions.
31. As a Learner on a touch screen, I want tooltips to open on tap, so that I can use them without a mouse.
32. As a Learner using a keyboard or screen reader, I want tooltips reachable by focus and announced, so that the site is accessible.
33. As a Learner, I want a tooltip to link to the fuller Concept or Playbook Entry where one exists, so that I can go deeper when the short version is not enough.

### Incident Lab: starting

34. As a Learner, I want a list of the five Incidents ordered easy to hard with their completion status, so that I can pick the next one.
35. As a Learner, I want a short briefing on the Target System (its parts and how a request flows through them), so that I understand what I am debugging.
36. As a Learner, I want each Incident to open with the alert that paged me, so that it starts the way a real one does.
37. As a Learner, I want to work a Bad Deploy Incident, so that I learn to correlate a failure with a release.
38. As a Learner, I want to work a Memory Leak Incident, so that I learn to recognise out-of-memory kills and restart loops.
39. As a Learner, I want to work a Slow Query Incident, so that I learn to trace latency to a database query and a missing index.
40. As a Learner, I want to work a Connection Pool Exhaustion Incident, so that I learn how a slow dependency makes a healthy service hang.
41. As a Learner, I want to work a Full Disk Incident, so that I learn to find what filled a disk and why writes fail.

### Incident Lab: dashboard

42. As a Learner, I want to see the firing alert with its condition and start time, so that I know what was detected.
43. As a Learner, I want graphs of request rate, error rate, latency and resource saturation, so that I can see the shape of the failure.
44. As a Learner, I want the graphs to mark when deploys happened, so that I can see whether the failure lines up with a change.
45. As a Learner, I want a searchable, filterable log view, so that I can look for errors without the terminal.
46. As a Learner, I want the recent deploy history, so that I can ask "what changed?".
47. As a Learner, I want the dashboard to change when my actions change the Target System, so that I see the effect of what I did.

### Incident Lab: terminal

48. As a Learner, I want to type commands freely, so that I build recall of the real commands.
49. As a Learner, I want flag order, spacing and common short and long flag forms to be accepted as equivalent, so that I am not punished for harmless variations.
50. As a Learner, I want tab completion for commands and resource names, so that typing feels like a real shell.
51. As a Learner, I want command history with the up and down arrows, so that I can repeat and edit commands.
52. As a Learner, I want output that looks like what the real tool prints, so that I recognise it later on a real system.
53. As a Learner, I want a clear "not simulated here" reply for a valid-looking command outside the Incident's script, so that I know the limit is the lab's and not my mistake.
54. As a Learner, I want a distinct reply for a mistyped command with a suggestion, so that I can correct typos.
55. As a Learner, I want to open a shell inside a container and run Linux tools there, so that I practise both cluster and host-level investigation.
56. As a Learner, I want the prompt to show where I am (my machine or inside a container), so that I do not lose track.
57. As a Learner, I want a warning before a command that changes the Target System, so that I learn to pause before acting in production.

### Incident Lab: state and consequences

58. As a Learner, I want Mitigations to take effect (errors drop after a rollback), so that the simulation responds to me.
59. As a Learner, I want a Mitigation to be able to destroy evidence (a restarted container's logs and memory are gone), so that I experience why evidence is captured first.
60. As a Learner, I want to be able to capture evidence before mitigating (save logs, record a memory snapshot), so that I can investigate afterwards.
61. As a Learner, I want to be able to continue investigating after mitigating, so that I practise finding the Root Cause once users are safe.
62. As a Learner, I want a harmful action (deleting the wrong thing, restarting everything) to have a visible bad consequence, so that I learn caution without real damage.
63. As a Learner, I want to restart an Incident from the beginning, so that I can try a better approach.

### Incident Lab: Hints

64. As a Learner, I want a Hint button, so that I am never permanently stuck.
65. As a Learner, I want the first Hint tier to give only the question to ask, so that I still do the thinking.
66. As a Learner, I want the second tier to point to the Playbook Entry that answers it, so that I learn where the knowledge lives.
67. As a Learner, I want the third tier to give the exact command, so that I can always progress.
68. As a Learner, I want Hints to follow where I am in the investigation, so that they are relevant to my next step and not a fixed list.

### Incident Lab: finishing and Debrief

69. As a Learner, I want to declare the Root Cause by choosing from a short list of plausible causes, so that I must commit to a conclusion.
70. As a Learner, I want to choose the Mitigation I would apply, so that I practise both halves of the response.
71. As a Learner, I want to be told whether my Root Cause was right and, if wrong, which evidence contradicts it, so that I learn from the error.
72. As a Learner, I want the Debrief to show my command timeline beside the Expert Path, so that I see where I wandered and what I missed.
73. As a Learner, I want the Debrief to show which evidence I captured and which an early Mitigation destroyed, so that the central lesson is concrete.
74. As a Learner, I want the Debrief to assess two things separately, whether I stopped user harm and whether I found the Root Cause, so that neither is mistaken for the other.
75. As a Learner, I want the Debrief to include a filled-in sample postmortem for the Incident, so that I see what a good write-up looks like.
76. As a Learner, I want the Debrief to say how this Incident could have been prevented and link to the relevant Concept, so that I connect debugging to prevention.
77. As a Learner, I want the Debrief to link the Playbook Entries and Resources that applied, so that I can study what I was weak on.

### Progress

78. As a Learner, I want my completed Incidents and Hints used saved in my browser, so that I can leave and return.
79. As a Learner, I want to reset my progress, so that I can start over.
80. As a Learner, I want the site to work fully if browser storage is unavailable, so that private browsing does not break it.

### Resources

81. As a Learner, I want a Resources page grouped by subject, each link with a line on why it is worth reading, so that I can choose what to study next.
82. As a Learner, I want Resources limited to primary, authoritative sources, so that I can trust them.
83. As a Learner, I want every Resource link to work, so that I do not hit dead ends.

### Motion and devices

84. As a Learner, I want graphs to draw in and react to my actions, the alert to pulse, terminal output to stream and pages to transition smoothly, so that the site feels alive and polished.
85. As a Learner who has asked my system for reduced motion, I want animations switched off, so that the site is comfortable for me.
86. As a Learner on a phone, I want Concepts, Playbook and Resources to read well, so that I can study anywhere.
87. As a Learner on a phone, I want the Incident Lab to tell me it needs a keyboard and larger screen, so that I am not left with a broken terminal.
88. As a repeat Learner, I want animations short enough not to slow me down, so that polish does not become friction.

### Authoring and delivery

89. As the author, I want each Incident to be a single data file read by a shared engine, so that adding a sixth Incident needs no engine code.
90. As the author, I want all tooltip explanations in one term list, so that I correct a definition once.
91. As the author, I want an automated check that every Incident can be solved by its Expert Path, so that I never publish an unwinnable Incident.
92. As the author, I want an automated check that every cross-link between Concepts, Playbook Entries, Incidents, terms and Resources resolves, so that content does not rot silently.
93. As the author, I want the site built and published to GitHub Pages automatically when the main branch changes, and only if the tests pass, so that publishing is safe and effortless.

## Implementation Decisions

### Platform

- A single-page application built with Vite, React and TypeScript, styled with Tailwind, animated with the Motion library. Output is static files only; there is no backend.
- Hosted as a GitHub Pages project page of a public repository named `DebugLab`, so the site is served from a sub-path. Routing must work under that sub-path and survive refresh and deep links on a static host.
- A GitHub Actions workflow runs tests, builds and deploys on changes to the main branch.

### Target System

- One fictional service used by all five Incidents: a Node.js HTTP API, PostgreSQL, Redis and nginx as the load balancer, running on Kubernetes. Its name and business purpose are cosmetic and chosen by the implementer.
- The Learner can open a shell inside a container; the terminal therefore has a notion of current location (local machine or a named container) that decides which commands are available.

### Incident engine (the deep module)

- Per ADR 0001, the terminal is scripted. The engine is a pure module with no dependency on the interface: given an Incident definition, a session state and one input (a typed command, a Hint request, an evidence capture, a Root Cause declaration or a Mitigation choice), it returns the new session state and what to display.
- Session state holds: the Incident's current named state, the terminal location, the command timeline, evidence captured, Hints revealed, and outcome.
- An Incident has a small number of named states (for example: failing, mitigated, mitigated with evidence lost). Command output, dashboard data and log contents are a function of the named state.
- Command matching normalises input before lookup: whitespace, flag order, and equivalent short and long flags. A command that is recognisably real but unscripted yields "not simulated here"; an unrecognisable one yields a typo suggestion.
- Commands are marked read-only or mutating. Mutating commands require confirmation and may trigger a state transition, which may destroy evidence not yet captured.
- Hints are attached to investigation progress (which key findings the Learner has reached), not to a fixed sequence, and each has three tiers.
- The Debrief is derived from session state and the Incident definition: timeline against Expert Path, evidence kept and lost, separate verdicts for harm stopped and Root Cause found.

### Incident definition (content schema)

- One data file per Incident containing: briefing and alert; named states and transitions; dashboard series, deploy history and logs per state; the command table per state and location; key findings; Hints; the Root Cause options with the correct one and the contradicting evidence for each wrong one; Mitigation options and their effects; the Expert Path; the sample postmortem; prevention notes; and links to Concepts, Playbook Entries and Resources.
- Definitions are typed, so a malformed Incident fails at build time.

### Content model

- Concepts, Playbook Entries, Resources and the term list are also typed data, cross-referenced by stable identifiers. A build-time check fails on any identifier that does not resolve.
- A Playbook Entry carries: its question, layer, commands with a read-only or mutating mark, annotated sample output for healthy and unhealthy cases, follow-on questions, and links.
- The term list is the single source for every tooltip. A term has a short explanation and optionally a link to a Concept or Playbook Entry. Terms are recognised in prose, in command text and in simulated output.

### Interface

- Tooltips open on hover, tap and keyboard focus, and are exposed to assistive technology.
- Visual direction: dark operations console with monospace accents, graph panels and status colours; a light theme toggle; the choice is remembered.
- Desktop-first. Concepts, Playbook and Resources are responsive down to phone width; the Incident Lab shows a notice on small or keyboardless screens.
- Motion is restricted to meaningful changes (graphs drawing and reacting, alert pulse, output streaming, page and panel transitions) and is disabled when the system requests reduced motion.
- Progress (Incidents completed, Hints used, theme) is stored in browser local storage only. The site must function with storage unavailable.

### Content sourcing

- All content is written for this project. Command output is modelled on the real tools' formats.
- Resources are primary sources only: the Google Site Reliability Engineering books, Kubernetes and PostgreSQL documentation, Brendan Gregg's performance material, the PagerDuty incident response guide, and equivalents. Every link is opened and confirmed live before release.

### Build order

- First deliverable is a vertical slice: the engine, the Bad Deploy Incident end to end (dashboard, terminal, Hints, Debrief), the tooltip system, and only the Concepts, Playbook Entries and Resources that Incident touches. The Learner's reaction to the slice is gathered before the remaining four Incidents and the rest of the content are written.

## Testing Decisions

- A good test exercises external behaviour only: what the Learner types or clicks and what they then see. Tests must not assert on internal data shapes or component structure, so the engine and interface can be refactored freely.
- **Engine seam (primary).** Tests feed an Incident definition and a sequence of inputs to the engine and assert on displayed output, state transitions and outcome. Covered here: command normalisation and the two failure replies; location changes; mutating-command confirmation; evidence capture and loss across transitions; Hint tiers following progress; Root Cause and Mitigation verdicts; Debrief contents.
- **Expert Path replay.** One test per Incident replays its Expert Path through the engine and asserts the Root Cause is reached with evidence intact. A second per Incident replays "mitigate immediately" and asserts the expected evidence is lost.
- **Content integrity.** A test asserts every cross-reference between Incidents, Concepts, Playbook Entries, terms and Resources resolves.
- **Interface seam.** Automated browser tests drive the built site as a Learner would. At minimum: complete the Bad Deploy Incident by typing its Expert Path and reach the Debrief; open a tooltip by hover and by keyboard focus; search the Playbook and open an entry; load a deep link directly; confirm progress persists across reload; confirm reduced-motion is honoured. One such end-to-end run per Incident as each is added.
- Animation quality and visual polish are judged by eye in the browser, not by automated tests.
- There is no prior art: the repository has no code yet. These tests establish the conventions.

## Out of Scope

- Any backend, accounts, sync across devices, leaderboards or analytics.
- A real Linux system or real cluster in the browser (ADR 0001).
- Systems other than the one Target System: mobile apps, data pipelines, embedded, serverless, other cloud-vendor tooling.
- Incidents beyond the five listed, including security incidents and data loss.
- Vendor-specific observability products; the dashboard is generic and real tools are named only in explanations.
- A full Incident Lab experience on phones.
- Translations.
- An in-site editor for authoring Incidents.

## Further Notes

- Creating the remote GitHub repository and pushing require the owner's explicit go-ahead; initialising git locally does not.
- The slice is a checkpoint, not a release: expect the terminal's feel, Hint pacing and Debrief layout to change after it is tried.
- External link liveness is checked before release rather than in the test suite, so that a third party's outage does not fail the build.
