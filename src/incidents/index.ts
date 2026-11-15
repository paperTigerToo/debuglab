import type { IncidentDefinition } from '../engine/types'
import { badDeploy } from './bad-deploy'

/** Every Incident, ordered easy to hard. */
export const incidents: readonly IncidentDefinition[] = [badDeploy]

export function findIncident(id: string): IncidentDefinition | undefined {
  return incidents.find((i) => i.id === id)
}
