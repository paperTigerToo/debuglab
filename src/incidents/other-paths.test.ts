// Paths off the Expert Path that the replays do not walk, where the Target System must still behave like the real one.
import { expect, test } from 'vitest'
import { currentHint, dashboard, start, step } from '../engine/engine'
import type { IncidentDefinition, SessionState } from '../engine/types'
import { connectionPool } from './connection-pool'
import { memoryLeak } from './memory-leak'
import { slowQuery } from './slow-query'

function play(incident: IncidentDefinition, ...commands: string[]) {
  let state: SessionState = start(incident)
  let text = ''
  for (const command of commands) {
    const result = step(incident, state, { kind: 'command', text: command })
    state = result.state
    text = result.display.map((l) => l.text).join('\n')
  }
  return { state, text }
}

test('Memory Leak: after a restart, a plain rollout undo brings back the same leaking release', () => {
  const { state, text } = play(memoryLeak, 'kubectl rollout restart deployment/pantry-api', 'y', 'kubectl rollout undo deployment/pantry-api', 'y')
  expect(state.namedState).toBe('restarted')
  expect(text).toContain('--to-revision=44')
})

test('Memory Leak: after a restart, rolling back to revision 44 reaches v2.14.1', () => {
  const { state } = play(memoryLeak, 'kubectl rollout restart deployment/pantry-api', 'y', 'kubectl rollout undo deployment/pantry-api --to-revision=44', 'y')
  expect(state.namedState).toBe('rolled-back')
})

test('Slow Query: rolling back and then rebuilding the index stops the harm on v2.15.1', () => {
  const { state } = play(
    slowQuery,
    'kubectl rollout undo deployment/pantry-api',
    'y',
    'kubectl exec postgres-0 -- psql -U pantry -c "CREATE INDEX CONCURRENTLY orders_customer_id_idx ON orders (customer_id)"',
    'y',
  )
  expect(dashboard(slowQuery, state).alert.status).toBe('resolved')
  expect(play(slowQuery, 'kubectl rollout undo deployment/pantry-api', 'y', 'kubectl get pods').text).toContain('pantry-api-6f8b7d9c55')
  const after = step(slowQuery, state, { kind: 'command', text: 'curl https://pantry.example.com/healthz' })
  expect(after.display.map((l) => l.text).join('\n')).toContain('2.15.1')
})

test('Slow Query: an investigation that rolls back before rebuilding the index has no Hint left at the end', () => {
  const investigate = slowQuery.expertPath.slice(0, -1).map((s) => s.command)
  const rebuild = slowQuery.expertPath.at(-1)!.command
  const { state } = play(slowQuery, ...investigate, 'kubectl rollout undo deployment/pantry-api', 'y', rebuild, 'y')
  expect(state.namedState).toBe('rolled-back-indexed')
  expect(currentHint(slowQuery, state)).toBeUndefined()
})

test('Connection Pool Exhaustion: a restart frees the pool only until slow checkouts fill it again', () => {
  const restarted = play(connectionPool, 'kubectl rollout restart deployment/pantry-api', 'y')
  expect(dashboard(connectionPool, restarted.state).alert.status).toBe('firing')
  expect(restarted.text).toContain('pools fill up again')
  const mitigated = step(connectionPool, restarted.state, { kind: 'command', text: 'kubectl set env deploy/pantry-api PAYMENTS_TIMEOUT_MS=2000' })
  const confirmed = step(connectionPool, mitigated.state, { kind: 'command', text: 'y' }).state
  expect(dashboard(connectionPool, confirmed).alert.status).toBe('resolved')
})
