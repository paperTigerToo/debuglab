import { describe, expect, test } from 'vitest'
import { currentHint, evidenceStatus, start, step } from '../engine/engine'
import type { IncidentDefinition, SessionState } from '../engine/types'
import { incidents } from './index'

/** Type a command, confirming it if the engine asks. */
function type(incident: IncidentDefinition, state: SessionState, command: string): SessionState {
  let next = step(incident, state, { kind: 'command', text: command }).state
  if (next.pending) next = step(incident, next, { kind: 'command', text: 'y' }).state
  return next
}

const isMutating = (incident: IncidentDefinition, command: string) =>
  step(incident, start(incident), { kind: 'command', text: command }).state.pending !== undefined

describe.each(incidents.map((i) => [i.title, i] as const))('%s', (_title, incident) => {
  test('its Expert Path runs every command, reaches every key finding and keeps the evidence', () => {
    let state = start(incident)
    for (const expert of incident.expertPath) {
      state = type(incident, state, expert.command)
      expect(state.timeline.at(-1), expert.command).toEqual({ text: expert.command, result: 'ran' })
      for (const finding of expert.reaches ?? []) expect(state.findings, expert.command).toContain(finding)
    }
    expect([...state.findings].sort()).toEqual(Object.keys(incident.findings).sort())
    expect(evidenceStatus(state).lost).toEqual([])
    expect(incident.dashboard[state.namedState]?.alert.status).toBe('resolved')
  })

  test('mitigating immediately stops the harm but loses evidence and the Root Cause with it', () => {
    const mitigation = incident.expertPath.find((s) => isMutating(incident, s.command))
    expect(mitigation, 'the Expert Path includes a Mitigation').toBeDefined()
    let state = type(incident, start(incident), mitigation!.command)
    for (const expert of incident.expertPath) {
      if (expert !== mitigation) state = type(incident, state, expert.command)
    }
    expect(incident.dashboard[state.namedState]?.alert.status).toBe('resolved')
    expect(evidenceStatus(state).lost).not.toEqual([])
    expect(state.findings.length).toBeLessThan(Object.keys(incident.findings).length)
  })

  test('every named state has a dashboard, and every command applies in at least one state', () => {
    for (const named of incident.states) expect(incident.dashboard[named], named).toBeDefined()
    for (const command of incident.commands) {
      const outputs = typeof command.output === 'string' ? [command.output] : Object.values(command.output)
      expect(outputs.length, command.match[0]).toBeGreaterThan(0)
    }
  })
})

describe.each(incidents.map((i) => [i.title, i] as const))('%s finishing content', (_title, incident) => {
  test('has exactly one correct Root Cause, and every wrong one says what rules it out', () => {
    expect(incident.rootCauses.filter((c) => c.correct)).toHaveLength(1)
    for (const cause of incident.rootCauses.filter((c) => !c.correct)) {
      expect(cause.contradictedBy?.length, cause.id).toBeGreaterThan(0)
    }
  })

  test('has a best Mitigation, and its Hints lead through the whole Expert Path', () => {
    expect(incident.mitigations.some((m) => m.verdict === 'best')).toBe(true)
    let state = start(incident)
    for (const expert of incident.expertPath) state = type(incident, state, expert.command)
    expect(currentHint(incident, state)).toBeUndefined()
  })

  test('every Hint goal is reachable by following that Hint\'s own command in order', () => {
    let state = start(incident)
    for (const hint of incident.hints) {
      expect(currentHint(incident, state)?.index, hint.question).toBe(incident.hints.indexOf(hint))
      state = type(incident, state, hint.command)
    }
    expect(currentHint(incident, state)).toBeUndefined()
  })
})
