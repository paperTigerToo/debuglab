import type { IncidentDefinition } from '../engine/types'
import { badDeploy } from './bad-deploy'

/** Every Incident, ordered easy to hard. */
export const incidents: readonly IncidentDefinition[] = [badDeploy]

/** The Incidents whose Hints point to a Playbook Entry. */
export const incidentsUsing = (entryId: string) => incidents.filter((i) => i.hints.some((h) => h.playbook === entryId))

export function findIncident(id: string): IncidentDefinition | undefined {
  return incidents.find((i) => i.id === id)
}
