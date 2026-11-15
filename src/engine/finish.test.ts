import { describe, expect, test } from 'vitest'
import { currentHint, debrief, hintsUsed, start, step } from './engine'
import { dashboardFixture } from './fixtures'
import { defineIncident, type Input, type SessionState } from './types'

const incident = defineIncident({
  id: 'finish',
  title: 'Finish',
  difficulty: 1,
  namespace: 'shop',
  alert: { name: 'HighErrorRate', severity: 'page', condition: 'errors > 5%', startedAt: '14:09', summary: '' },
  briefing: '',
  states: ['failing', 'mitigated'],
  initialState: 'failing',
  findings: {
    young: { summary: 'The pods are young' },
    throws: { summary: 'Checkout throws' },
    config: { summary: 'The config key is missing' },
  },
  evidence: { logs: { summary: 'Logs of the new pods', lost: 'gone with the pods' } },
  resources: { failing: ['deployment/api'], mitigated: ['deployment/api'] },
  shellPodPrefix: 'api-',
  commands: [
    { match: ['kubectl get pods'], output: 'api-new   Running', reveals: ['young'] },
    {
      match: ['kubectl logs deployment/api'],
      output: { failing: 'ERROR checkout', mitigated: 'INFO fine' },
      evidence: 'logs',
      reveals: [{ finding: 'throws', seenIn: 'ERROR checkout' }],
    },
    {
      match: ['kubectl rollout undo deployment/api'],
      output: { failing: 'rolled back' },
      mutating: { warning: 'Roll back.', to: 'mitigated', destroys: ['logs'], consequence: 'Errors stop.' },
    },
    { match: ['kubectl describe deployment/api'], output: 'Environment: OLD_KEY', reveals: ['config'] },
  ],
  dashboard: { failing: dashboardFixture('firing'), mitigated: dashboardFixture('resolved') },
  expertPath: [
    { command: 'kubectl get pods', why: 'Look broadly', reaches: ['young'] },
    { command: 'kubectl logs deployment/api --tail=5', why: 'Read errors', reaches: ['throws'] },
    { command: 'kubectl logs deployment/api > api.log', why: 'Save evidence', achieves: { captured: 'logs' } },
    { command: 'kubectl rollout undo deployment/api', why: 'Stop the harm', achieves: { state: 'mitigated' } },
    { command: 'kubectl describe deployment api', why: 'Check config', reaches: ['config'] },
  ],
  hints: [
    { goal: { finding: 'young' }, question: 'Are the pods new?', playbook: 'Are the pods running?', command: 'kubectl get pods' },
    {
      goal: { finding: 'throws' },
      needs: { evidence: 'logs' },
      question: 'What errors?',
      playbook: 'What is the application logging?',
      command: 'kubectl logs deployment/api',
    },
    { goal: { captured: 'logs' }, question: 'Will the logs survive?', playbook: 'How do I keep evidence?', command: 'kubectl logs deployment/api > api.log' },
    { goal: { state: 'mitigated' }, question: 'How do you stop the harm?', playbook: 'How do I roll back?', command: 'kubectl rollout undo deployment/api' },
    { goal: { finding: 'config' }, question: 'What config does it get?', playbook: 'What config is running?', command: 'kubectl describe deployment api' },
  ],
  rootCauses: [
    { id: 'renamed-key', label: 'The release renamed a config key the manifest still uses', correct: true },
    {
      id: 'payments-down',
      label: 'The payments service is down',
      contradictedBy: [{ finding: 'throws', why: 'The request never left the API.' }],
    },
  ],
  mitigations: [
    { id: 'rollback', label: 'Roll back', verdict: 'best', explanation: 'Fast and safe.' },
    { id: 'restart', label: 'Restart the pods', verdict: 'no-effect', explanation: 'Same release, same config.' },
  ],
  postmortem: {
    summary: 'Checkout failed for 13 minutes.',
    impact: '9% of requests',
    timeline: [{ at: '14:02', event: 'Deploy' }],
    rootCause: 'Renamed key',
    resolution: 'Rollback',
    actionItems: ['Validate config at startup'],
  },
  prevention: ['Validate configuration at startup.'],
  links: { concepts: ['mitigate-then-investigate'], resources: ['k8s-logging'] },
})

function play(...inputs: (string | Input)[]): SessionState {
  let state = start(incident)
  for (const input of inputs) {
    state = step(incident, state, typeof input === 'string' ? { kind: 'command', text: input } : input).state
  }
  return state
}

const hint: Input = { kind: 'hint' }
const finish = (rootCause: string, mitigation: string): Input => ({ kind: 'finish', rootCause, mitigation })
const expertPath = ['kubectl get pods', 'kubectl logs deployment/api --tail=5', 'kubectl logs deployment/api > api.log', 'kubectl rollout undo deployment/api', 'y', 'kubectl describe deployment api']

describe('Hints', () => {
  test('nothing is revealed until the Learner asks', () => {
    expect(currentHint(incident, play())).toEqual({ index: 0, tier: 0 })
  })

  test('tiers reveal the question, then the Playbook Entry, then the exact command', () => {
    expect(currentHint(incident, play(hint))).toEqual({ index: 0, tier: 1, question: 'Are the pods new?' })
    expect(currentHint(incident, play(hint, hint))).toEqual({
      index: 0,
      tier: 2,
      question: 'Are the pods new?',
      playbook: 'Are the pods running?',
    })
    const all = { index: 0, tier: 3, question: 'Are the pods new?', playbook: 'Are the pods running?', command: 'kubectl get pods' }
    expect(currentHint(incident, play(hint, hint, hint))).toEqual(all)
    expect(currentHint(incident, play(hint, hint, hint, hint))).toEqual(all)
  })

  test('the Hint follows the investigation: reaching a goal moves on to the next one, starting fresh', () => {
    expect(currentHint(incident, play(hint, 'kubectl get pods'))).toEqual({ index: 1, tier: 0 })
    expect(currentHint(incident, play('kubectl logs deployment/api', 'kubectl get pods'))).toEqual({ index: 2, tier: 0 })
  })

  test('an earlier goal still unmet comes first, whatever order the Learner works in', () => {
    expect(currentHint(incident, play('kubectl logs deployment/api'))).toEqual({ index: 0, tier: 0 })
  })

  test('Hints that rely on lost evidence are skipped', () => {
    expect(currentHint(incident, play('kubectl get pods', 'kubectl rollout undo deployment/api', 'y'))).toEqual({
      index: 4,
      tier: 0,
    })
  })

  test('when every goal is met there is no Hint left', () => {
    expect(currentHint(incident, play(...expertPath))).toBeUndefined()
  })

  test('Hints used counts every tier revealed', () => {
    expect(hintsUsed(play(hint, hint, 'kubectl get pods', hint))).toBe(3)
  })
})

describe('finishing', () => {
  test('declaring a Root Cause and a Mitigation ends the Incident', () => {
    const state = play('kubectl get pods', finish('renamed-key', 'rollback'))
    expect(state.outcome).toEqual({ rootCause: 'renamed-key', mitigation: 'rollback' })
    const after = step(incident, state, { kind: 'command', text: 'kubectl get pods' })
    expect(after.state).toEqual(state)
    expect(after.display).toContainEqual({ kind: 'notice', text: expect.stringContaining('This Incident is over') })
  })

  test('an unknown choice is ignored', () => {
    expect(play(finish('nope', 'rollback')).outcome).toBeUndefined()
  })
})

describe('the Debrief', () => {
  test('after the Expert Path: Root Cause found, harm stopped, nothing missed or lost', () => {
    const d = debrief(incident, play(...expertPath, finish('renamed-key', 'rollback')))
    expect(d.rootCause).toEqual({
      correct: true,
      chosen: 'The release renamed a config key the manifest still uses',
      actual: 'The release renamed a config key the manifest still uses',
      contradictions: [],
    })
    expect(d.harm).toEqual({
      stopped: true,
      summary: 'resolved',
      mitigation: { id: 'rollback', label: 'Roll back', verdict: 'best', explanation: 'Fast and safe.' },
    })
    expect(d.expertPath.every((s) => s.covered)).toBe(true)
    expect(d.evidence).toEqual({ captured: ['Logs of the new pods'], lost: [] })
    expect(d.findings).toEqual({
      reached: ['The pods are young', 'Checkout throws', 'The config key is missing'],
      missed: [],
    })
  })

  test('the two verdicts are separate: harm stopped without finding the Root Cause', () => {
    const d = debrief(incident, play('kubectl rollout undo deployment/api', 'y', finish('payments-down', 'rollback')))
    expect(d.harm.stopped).toBe(true)
    expect(d.rootCause.correct).toBe(false)
    expect(d.rootCause.contradictions).toEqual([{ why: 'The request never left the API.', finding: 'Checkout throws', reached: false }])
    expect(d.evidence).toEqual({ captured: [], lost: ['Logs of the new pods'] })
  })

  test('the Root Cause found without stopping the harm', () => {
    const d = debrief(incident, play('kubectl logs deployment/api', finish('renamed-key', 'restart')))
    expect(d.harm.stopped).toBe(false)
    expect(d.harm.mitigation.verdict).toBe('no-effect')
    expect(d.rootCause.correct).toBe(true)
  })

  test('the timeline lists what the Learner ran, against which Expert Path steps were covered', () => {
    const d = debrief(incident, play('kubectl get pods', 'kubectl get secrets', 'kubectl logs deploy/api | grep ERROR', finish('renamed-key', 'rollback')))
    expect(d.timeline).toEqual([
      { text: 'kubectl get pods', result: 'ran' },
      { text: 'kubectl get secrets', result: 'not-simulated' },
      { text: 'kubectl logs deploy/api | grep ERROR', result: 'ran' },
    ])
    expect(d.expertPath.map((s) => s.covered)).toEqual([true, true, false, false, false])
  })

  test('carries the Hints used, the sample postmortem, the prevention notes and what to study next', () => {
    const d = debrief(incident, play(hint, hint, finish('renamed-key', 'rollback')))
    expect(d.hintsUsed).toBe(2)
    expect(d.postmortem.summary).toBe('Checkout failed for 13 minutes.')
    expect(d.prevention).toEqual(['Validate configuration at startup.'])
    expect(d.links).toEqual({ concepts: ['mitigate-then-investigate'], resources: ['k8s-logging'] })
  })
})

describe('Expert Path coverage follows what the Learner achieved, not the exact words', () => {
  test('saving the evidence after it was destroyed does not cover the capture step', () => {
    const d = debrief(incident, play('kubectl rollout undo deployment/api', 'y', 'kubectl logs deployment/api > late.log', finish('renamed-key', 'rollback')))
    expect(d.expertPath[2]).toMatchObject({ why: 'Save evidence', covered: false })
    expect(d.expertPath[3]).toMatchObject({ why: 'Stop the harm', covered: true })
  })

  test('capturing with tee instead of a redirect covers the capture step', () => {
    const d = debrief(incident, play('kubectl logs deployment/api | tee saved.txt', finish('renamed-key', 'rollback')))
    expect(d.expertPath[2]).toMatchObject({ covered: true })
  })
})
