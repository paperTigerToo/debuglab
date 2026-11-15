# 04: Bad Deploy dashboard

**What to build:** Beside the terminal, the Learner sees the firing alert with condition and start time, graphs of request rate, error rate, latency and saturation with deploy markers, a searchable and filterable log view, and the recent deploy history, all driven by the Incident's current named state.

**Blocked by:** 03 Investigate Bad Deploy in the terminal

**Status:** resolved

- [x] Alert panel shows condition and start time
- [x] Four golden-signal graphs with deploy markers
- [x] Log view with search and level filter
- [x] Deploy history list
- [x] Dashboard data comes from the Incident definition for the current named state

## Comments

- Done. Each named state carries its dashboard: alert status, four golden-signal series with deploy and action markers, deploy history, and the load balancer access log (nginx). The log view shows access logs rather than application logs on purpose: they survive a rollback, while application logs live only in the pods, which is what makes evidence capture matter. Graph line colours were checked with the dataviz palette validator against both theme surfaces.
