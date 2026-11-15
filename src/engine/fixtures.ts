// Test helpers shared by the engine's tests.
import type { Dashboard } from './types'

export function dashboardFixture(status: 'firing' | 'resolved', summary: string = status): Dashboard {
  return {
    alert: { status, summary },
    minutes: ['14:00', '14:01'],
    signals: { requests: [1, 1], errors: [0, 0], latency: [1, 1], saturation: [1, 1] },
    markers: [],
    deploys: [],
    logs: [],
  }
}
