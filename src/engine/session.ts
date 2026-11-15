// Facts derived from a session that several parts of the engine need.
import type { Dashboard, IncidentDefinition, SessionState } from './types'

/** What the dashboard shows for the Incident's current named state. */
export function dashboard(definition: IncidentDefinition, state: SessionState): Dashboard {
  return definition.dashboard[state.namedState]!
}

/** Which perishable evidence the Learner saved in time, and which a mutating command destroyed first. */
export function evidenceStatus(state: SessionState): { captured: string[]; lost: string[] } {
  const captured = [...new Set(state.files.flatMap((f) => (f.evidence ? [f.evidence] : [])))]
  return { captured, lost: state.destroyed.filter((e) => !captured.includes(e)) }
}

/** Whether the harm has stopped: the alert that paged the Learner has resolved. */
export function harmStopped(definition: IncidentDefinition, state: SessionState): boolean {
  return dashboard(definition, state).alert.status === 'resolved'
}
