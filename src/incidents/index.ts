import type { IncidentDefinition } from '../engine/types'
import { badDeploy } from './bad-deploy'
import { connectionPool } from './connection-pool'
import { memoryLeak } from './memory-leak'
import { slowQuery } from './slow-query'

/** Every Incident, ordered easy to hard. */
export const incidents: readonly IncidentDefinition[] = [badDeploy, memoryLeak, slowQuery, connectionPool]

/** The Incidents whose Hints point to a Playbook Entry. */
export const incidentsUsing = (entryId: string) => incidents.filter((i) => i.hints.some((h) => h.playbook === entryId))

export function findIncident(id: string): IncidentDefinition | undefined {
  return incidents.find((i) => i.id === id)
}
