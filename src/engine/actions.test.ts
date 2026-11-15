import { describe, expect, test } from 'vitest'
import { complete, dashboard, evidenceStatus, prompt, start, step } from './engine'
import { dashboardFixture } from './fixtures'
import { defineIncident, type Line, type SessionState } from './types'

const incident = defineIncident({
  id: 'actions',
  title: 'Actions',
  difficulty: 1,
  namespace: 'shop',
  alert: { name: 'HighErrorRate', severity: 'page', condition: 'errors > 5%', startedAt: '14:09', summary: '' },
  briefing: '',
  states: ['failing', 'rolled-back', 'outage'],
  initialState: 'failing',
  findings: {
    throws: { summary: 'Checkout throws' },
    missing: { summary: 'PAYMENTS_URL is not set' },
    'old-name': { summary: 'The container has PAYMENT_SERVICE_URL' },
  },
  evidence: {
    'api-logs': { summary: 'Logs from the new pods', lost: 'The new pods are gone, and their logs with them.' },
  },
  resources: {
    failing: ['pod/api-new-1', 'deployment/api', 'pod/db-0'],
    'rolled-back': ['pod/api-old-1', 'deployment/api', 'pod/db-0'],
    outage: ['pod/db-0'],
  },
  shellPodPrefix: 'api-',
  commands: [
    {
      match: ['kubectl get pods'],
      output: { failing: 'api-new-1   Running', 'rolled-back': 'api-old-1   Running', outage: 'db-0   Running' },
    },
    {
      match: ['kubectl logs deployment/api'],
      output: { failing: 'WARN PAYMENTS_URL not set\nERROR checkout failed', 'rolled-back': 'INFO all good' },
      evidence: 'api-logs',
      reveals: [
        { finding: 'throws', seenIn: 'ERROR checkout failed' },
        { finding: 'missing', seenIn: 'WARN PAYMENTS_URL' },
      ],
    },
    {
      match: ['kubectl rollout undo deployment/api'],
      output: { failing: 'deployment.apps/api rolled back' },
      mutating: {
        warning: 'Roll api back to the previous revision.',
        to: 'rolled-back',
        destroys: ['api-logs'],
        consequence: 'Errors stop as the old pods take over.',
      },
    },
    {
      match: ['kubectl delete deployment/api'],
      output: { failing: 'deployment.apps "api" deleted', 'rolled-back': 'deployment.apps "api" deleted' },
      mutating: {
        warning: 'Delete the api Deployment and every pod it owns.',
        to: 'outage',
        destroys: ['api-logs'],
        consequence: 'Every request now fails: the site is down.',
      },
    },
    { match: ['kubectl apply --filename fix.yaml'], output: 'deployment.apps/api configured' },
    { match: ['kubectl scale deployment/api --replicas=0'], output: 'deployment.apps/api scaled' },
    {
      match: ['env'],
      where: 'container',
      output: { failing: 'PAYMENT_SERVICE_URL=http://pay', 'rolled-back': 'PAYMENT_SERVICE_URL=http://pay' },
      reveals: ['old-name'],
    },
  ],
  dashboard: {
    failing: dashboardFixture('firing'),
    'rolled-back': dashboardFixture('resolved'),
    outage: dashboardFixture('firing', 'Every request is failing'),
  },
  expertPath: [],
})

function session() {
  let state: SessionState = start(incident)
  let display: readonly Line[] = []
  const type = (...commands: string[]) => {
    for (const text of commands) {
      const result = step(incident, state, { kind: 'command', text })
      state = result.state
      display = result.display
    }
    return { state, display, text: display.map((l) => l.text).join('\n') }
  }
  return { type, get state() { return state } }
}

describe('flags are read per kubectl subcommand', () => {
  test('-f means --filename for apply, not --follow', () => {
    expect(session().type('kubectl apply -f fix.yaml').text).toContain('deployment.apps/api configured')
  })

  test('a valued flag keeps its value', () => {
    expect(session().type('kubectl scale deployment api --replicas 0').text).toContain('scaled')
  })

  test('-f for logs means --follow, which is a different command', () => {
    expect(session().type('kubectl logs -f deploy/api').text).toContain('not simulated here')
  })
})

describe('resources follow the named state', () => {
  test('a pod that existed before a rollback is NotFound after it', () => {
    const s = session()
    s.type('kubectl rollout undo deployment/api', 'y')
    expect(s.type('kubectl logs api-new-1').display).toContainEqual({
      kind: 'error',
      text: 'Error from server (NotFound): pods "api-new-1" not found',
    })
  })

  test('a command with no output in this state falls back to kubectl errors', () => {
    const s = session()
    s.type('kubectl delete deployment api', 'y')
    expect(s.type('kubectl rollout undo deployment/api').display).toContainEqual({
      kind: 'error',
      text: 'Error from server (NotFound): deployments.apps "api" not found',
    })
  })
})

describe('a shell inside a container', () => {
  test('kubectl exec opens it, the prompt shows where you are, and exit leaves', () => {
    const s = session()
    s.type('kubectl exec -it api-new-1 -- sh')
    expect(prompt(s.state)).toBe('root@api-new-1:/app#')
    expect(s.type('env').text).toContain('PAYMENT_SERVICE_URL=http://pay')
    expect(s.state.findings).toEqual(['old-name'])
    s.type('exit')
    expect(prompt(s.state)).toBe('you@laptop:~$')
  })

  test('container commands do not run on your machine, and kubectl does not run in the container', () => {
    expect(session().type('env').text).toContain('not simulated here')
    const s = session()
    s.type('kubectl exec -it api-new-1 -- bash')
    expect(s.type('kubectl get pods').display).toContainEqual({ kind: 'error', text: 'bash: kubectl: command not found' })
  })

  test('kubectl exec with a command runs it once and stays on your machine', () => {
    const s = session()
    expect(s.type('kubectl exec api-new-1 -- env').text).toContain('PAYMENT_SERVICE_URL=http://pay')
    expect(prompt(s.state)).toBe('you@laptop:~$')
  })

  test('a pod without a shell is not simulated and a missing pod is NotFound', () => {
    expect(session().type('kubectl exec -it db-0 -- sh').text).toContain('not simulated here')
    expect(session().type('kubectl exec -it nope -- sh').text).toContain('pods "nope" not found')
  })
})

describe('mutating commands', () => {
  test('ask for confirmation before changing anything', () => {
    const s = session()
    const asked = s.type('kubectl rollout undo deployment/api')
    expect(asked.display).toContainEqual({ kind: 'warning', text: expect.stringContaining('Roll api back') })
    expect(s.state.namedState).toBe('failing')
    expect(prompt(s.state)).toBe('Proceed? [y/N]')
  })

  test('anything but yes cancels', () => {
    const s = session()
    s.type('kubectl rollout undo deployment/api')
    expect(s.type('n').text).toContain('Cancelled')
    expect(s.state.namedState).toBe('failing')
    expect(s.state.timeline).toEqual([{ text: 'kubectl rollout undo deployment/api', result: 'cancelled' }])
  })

  test('yes runs the command, moves the named state and changes the dashboard', () => {
    const s = session()
    s.type('kubectl rollout undo deployment/api')
    const done = s.type('yes')
    expect(done.text).toContain('deployment.apps/api rolled back')
    expect(done.text).toContain('Errors stop')
    expect(s.state.namedState).toBe('rolled-back')
    expect(dashboard(incident, s.state).alert.status).toBe('resolved')
    expect(s.state.timeline).toEqual([{ text: 'kubectl rollout undo deployment/api', result: 'ran' }])
  })

  test('a harmful command has a visible bad consequence', () => {
    const s = session()
    s.type('kubectl delete deployment api')
    expect(s.type('y').text).toContain('the site is down')
    expect(dashboard(incident, s.state).alert).toEqual({ status: 'firing', summary: 'Every request is failing' })
  })
})

describe('evidence', () => {
  test('redirecting output to a file captures it without showing it', () => {
    const s = session()
    const saved = s.type('kubectl logs deploy/api > api.log')
    expect(saved.display).toHaveLength(1)
    expect(s.state.findings).toEqual([])
    expect(evidenceStatus(incident, s.state)).toEqual({ captured: ['api-logs'], lost: [] })
  })

  test('a Mitigation before capture destroys the evidence and says so', () => {
    const s = session()
    s.type('kubectl rollout undo deployment/api')
    expect(s.type('y').text).toContain('their logs with them')
    expect(evidenceStatus(incident, s.state)).toEqual({ captured: [], lost: ['api-logs'] })
    expect(s.type('kubectl logs deploy/api').text).toContain('INFO all good')
  })

  test('captured evidence survives the Mitigation and can still be investigated', () => {
    const s = session()
    s.type('kubectl logs deploy/api > api.log', 'kubectl rollout undo deployment/api', 'y')
    expect(evidenceStatus(incident, s.state)).toEqual({ captured: ['api-logs'], lost: [] })
    expect(s.type('grep ERROR api.log').display).toContainEqual({ kind: 'output', text: 'ERROR checkout failed' })
    expect(s.state.findings).toEqual(['throws'])
    expect(s.type('cat api.log').text).toContain('WARN PAYMENTS_URL not set')
    expect(s.state.findings).toEqual(['throws', 'missing'])
  })

  test('saving output after the evidence is gone does not capture it', () => {
    const s = session()
    s.type('kubectl rollout undo deployment/api', 'y', 'kubectl logs deploy/api > late.log')
    expect(evidenceStatus(incident, s.state)).toEqual({ captured: [], lost: ['api-logs'] })
  })

  test('tee shows the output and saves it', () => {
    const s = session()
    expect(s.type('kubectl logs deploy/api | tee api.log').text).toContain('ERROR checkout failed')
    expect(evidenceStatus(incident, s.state).captured).toEqual(['api-logs'])
  })

  test('ls lists saved files and reading a missing one fails like the real tool', () => {
    const s = session()
    s.type('kubectl logs deploy/api > api.log', 'kubectl get pods >> pods.txt')
    expect(s.type('ls').display).toContainEqual({ kind: 'output', text: 'api.log  pods.txt' })
    expect(s.type('cat nope.log').display).toContainEqual({ kind: 'error', text: 'cat: nope.log: No such file or directory' })
  })
})

describe('tab completion follows location', () => {
  test('offers container commands inside a container', () => {
    const s = session()
    s.type('kubectl exec -it api-new-1 -- sh')
    expect(complete(incident, s.state, 'en')).toEqual({ text: 'env ', options: [] })
  })

  test('offers saved file names and current pod names', () => {
    const s = session()
    s.type('kubectl logs deploy/api > api.log')
    expect(complete(incident, s.state, 'cat ap').text).toBe('cat api.log ')
    expect(complete(incident, s.state, 'kubectl logs api-').text).toBe('kubectl logs api-new-1 ')
  })
})
