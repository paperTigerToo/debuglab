// Test helpers shared by the engine's tests.
import type { Dashboard, MitigationOption, Postmortem } from './types'

export function dashboardFixture(status: 'firing' | 'resolved', summary: string = status): Dashboard {
  return {
    alert: { status, summary },
    minutes: ['14:00', '14:01'],
    signals: { requests: [1, 1], errors: [0, 0], latency: [1, 1], saturation: [1, 1] },
    saturationOf: 'CPU',
    markers: [],
    deploys: [],
    logs: [],
  }
}

/** The finishing parts of a definition, for fixtures that do not test finishing. */
export const finishFixture = {
  hints: [],
  rootCauses: [{ id: 'cause', label: 'The cause', correct: true }],
  mitigations: [{ id: 'rollback', label: 'Roll back', verdict: 'best', explanation: '' }] as MitigationOption[],
  postmortem: { summary: '', impact: '', timeline: [], rootCause: '', resolution: '', actionItems: [] } as Postmortem,
  prevention: [],
  links: { concepts: [], resources: [] },
} as const
