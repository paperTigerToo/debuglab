# 12: Slice checkpoint

**What to build:** The owner tries the slice (Bad Deploy end to end, tooltips, slice Concepts, Playbook and Resources) and records what should change before the remaining Incidents and content are written.

**Blocked by:** 06 Finish and Debrief, 07 Hints, 09 Concepts for the slice, 10 Playbook for the slice, 11 Motion and small screens

**Status:** ready-for-human

- [ ] Owner has worked the Bad Deploy Incident
- [ ] Feedback recorded as tickets or changes to tickets 13 to 18

## Comments

- Simplifications to judge while trying the slice, left from the reviews of tickets 04 to 07:
  - Restarting or deleting a pod keeps the same pod names and ages, and does not count as destroying evidence, because the replacement pods log the same warning and errors.
  - Scaling pantry-api to zero and deleting the Deployment share one "outage" state; after scaling, real kubectl would still list the Deployment at 0/0.
  - All three v2.14.0 pods print identical logs.
  - Evidence is captured by saving output to a file (> FILE, | tee FILE). There is no separate capture button yet.
