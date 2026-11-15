# DebugLab

A static teaching site that simulates debugging a live web service, so a developer who has never been on call can practise finding the cause of a failure, not only undoing it.

## Language

### The simulated world

**Target System**:
The single fictional web service every Incident happens to: an HTTP API with a database, a cache and a load balancer.
_Avoid_: Prod, the app, the server

**Incident**:
One scripted failure of the Target System that the Learner works through from first symptom to Root Cause.
_Avoid_: Scenario, level, exercise, bug

**Symptom**:
Evidence the Learner is shown at the start of an Incident or uncovers during it: an alert, a graph, a log line or command output.
_Avoid_: Clue, hint

**Mitigation**:
An action that stops user harm without explaining the failure, such as a rollback or turning a feature flag off.
_Avoid_: Fix, workaround

**Root Cause**:
The specific defect or condition that produced the Incident's Symptoms; identifying it is what completes the investigation.
_Avoid_: The bug, the problem

**Hint**:
Graduated help inside an Incident, given in three tiers: the question to ask, the Playbook Entry that answers it, then the exact command.
_Avoid_: Tip, clue, help

**Expert Path**:
The reference sequence of commands that takes an Incident from first Symptom to Root Cause, shown for comparison in the Debrief.
_Avoid_: Solution, walkthrough, answer key

**Debrief**:
The review shown when an Incident ends: the Learner's command timeline beside the Expert Path, the evidence an early Mitigation would have destroyed, and a sample postmortem.
_Avoid_: Results, score screen, summary

### The site

**Learner**:
The person using the site: able to code and use a terminal, never been on call.
_Avoid_: User, player, student

**Concept**:
A broad idea explained in prose, such as observability or the incident lifecycle.
_Avoid_: Topic, lesson, article

**Playbook Entry**:
One granular investigative question with the real commands that answer it and their annotated output.
_Avoid_: Cheat sheet, recipe, runbook

**Incident Lab**:
The interactive area where the Learner works an Incident through a simulated terminal and dashboard.
_Avoid_: Simulator, sandbox, game

**Resource**:
An external link to an authoritative source, cited from a Concept, Playbook Entry or Incident.
_Avoid_: Reference, further reading
