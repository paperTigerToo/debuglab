import { describe, expect, test } from 'vitest'
import { start, step } from '../engine/engine'
import { incidents } from './index'

describe.each(incidents.map((i) => [i.title, i] as const))('%s', (_title, incident) => {
  test('its Expert Path runs every command and reaches every key finding', () => {
    let state = start(incident)
    for (const expert of incident.expertPath) {
      const result = step(incident, state, { kind: 'command', text: expert.command })
      state = result.state
      expect(state.timeline.at(-1), expert.command).toEqual({ text: expert.command, result: 'ran' })
      for (const finding of expert.reaches ?? []) expect(state.findings, expert.command).toContain(finding)
    }
    expect([...state.findings].sort()).toEqual(Object.keys(incident.findings).sort())
  })

  test('every scripted command has output for every named state', () => {
    for (const command of incident.commands) {
      if (typeof command.output === 'string') continue
      for (const named of incident.states) expect(command.output[named], command.match[0]).toBeDefined()
    }
  })
})
