import { expect, test } from 'vitest'
import { dashboard, start, step } from '../engine/engine'
import { badDeploy } from './bad-deploy'

const run = (...commands: string[]) => {
  let state = start(badDeploy)
  let text = ''
  for (const command of commands) {
    const result = step(badDeploy, state, { kind: 'command', text: command })
    state = result.state
    text = result.display.map((l) => l.text).join('\n')
  }
  return { state, text }
}

test('logs of a pod that does not exist yet are NotFound', () => {
  expect(run('kubectl logs pantry-api-84b7d5f9cd-h2k8w').text).toContain('pods "pantry-api-84b7d5f9cd-h2k8w" not found')
})

test('during the outage customers keep sending requests, and every one fails', () => {
  const { state } = run('kubectl delete deployment pantry-api', 'y')
  const { signals } = dashboard(badDeploy, state)
  expect(signals.requests.at(-1)).toBeGreaterThan(100)
  expect(signals.errors.at(-1)).toBe(100)
})
