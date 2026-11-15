import { describe, expect, test } from 'vitest'
import { complete, prompt, start, step } from './engine'
import { dashboardFixture, finishFixture } from './fixtures'
import { defineIncident, type Line, type SessionState } from './types'

const incident = defineIncident({
  id: 'fixture',
  title: 'Fixture',
  difficulty: 1,
  namespace: 'shop',
  alert: { name: 'HighErrorRate', severity: 'page', condition: 'errors > 5%', startedAt: '14:09', summary: '' },
  briefing: '',
  states: ['failing'],
  initialState: 'failing',
  findings: {
    replaced: { summary: 'The pods were replaced twelve minutes ago' },
    throws: { summary: 'Checkout throws on every request' },
  },
  commands: [
    { match: ['kubectl get pods'], output: 'NAME        READY\napi-7f9c-2xk   1/1', reveals: ['replaced'] },
    {
      match: ['kubectl logs deployment/api', 'kubectl logs deployment/api --since 5m'],
      output: 'INFO started\nERROR checkout failed\nerror: retry failed',
      reveals: [{ finding: 'throws', seenIn: 'ERROR checkout failed' }],
    },
    { match: ['ps aux'], output: 'USER PID' },
  ],
  evidence: {},
  resources: ['pod/api-7f9c-2xk', 'deployment/api'],
  shellPodPrefix: 'api-',
  dashboard: { failing: dashboardFixture('firing') },
  ...finishFixture,
  expertPath: [
    { command: 'kubectl get pods', why: '', reaches: ['replaced'] },
    { command: 'kubectl logs deploy/api --tail=3', why: '', reaches: ['throws'] },
  ],
})

function run(...commands: string[]) {
  let state: SessionState = start(incident)
  let display: readonly Line[] = []
  let clear = false
  for (const text of commands) {
    const result = step(incident, state, { kind: 'command', text })
    state = result.state
    display = result.display
    clear = result.clear ?? false
  }
  return { state, display, clear, text: display.map((l) => l.text).join('\n') }
}

describe('running a scripted command', () => {
  test('echoes the input and shows its output', () => {
    const { display } = run('kubectl get pods')
    expect(display[0]).toEqual({ kind: 'input', prompt: prompt(start(incident)), text: 'kubectl get pods' })
    expect(display).toContainEqual({ kind: 'output', text: 'NAME        READY\napi-7f9c-2xk   1/1' })
  })
})

describe('forgiving command matching', () => {
  test.each([
    ['extra spacing', '  kubectl   get    pods  '],
    ['singular resource name', 'kubectl get pod'],
    ['short resource name', 'kubectl get po'],
    ['the default namespace spelled out', 'kubectl get pods -n shop'],
    ['the long namespace flag', 'kubectl get pods --namespace=shop'],
    ['the namespace flag first', 'kubectl -n shop get pods'],
  ])('accepts %s', (_why, text) => {
    expect(run(text).text).toContain('api-7f9c-2xk   1/1')
  })

  test.each([
    ['type/name shorthand', 'kubectl logs deploy/api --tail 3'],
    ['flag with equals', 'kubectl logs deployment/api --tail=3'],
    ['flag before the resource', 'kubectl logs --tail 3 deployment/api'],
  ])('accepts %s for logs', (_why, text) => {
    expect(run(text).text).toContain('ERROR checkout failed')
  })

  test('accepts clustered short flags in any order', () => {
    expect(run('ps xua').text).toContain('USER PID')
  })

  test('does not match a different namespace', () => {
    expect(run('kubectl get pods -n kube-system').text).not.toContain('api-7f9c-2xk')
  })
})

describe('commands outside the script', () => {
  test('a real but unscripted command says it is not simulated here', () => {
    const { display } = run('kubectl get secrets')
    expect(display).toContainEqual({ kind: 'notice', text: expect.stringContaining('not simulated here') })
  })

  test('a mistyped program suggests the real one', () => {
    const { display } = run('kubeclt get pods')
    expect(display).toContainEqual({ kind: 'error', text: expect.stringMatching(/kubeclt: command not found.*kubectl/s) })
  })

  test('a mistyped kubectl subcommand suggests the real one', () => {
    const { display } = run('kubectl gte pods')
    expect(display).toContainEqual({ kind: 'error', text: expect.stringMatching(/unknown command "gte".*get/s) })
  })

  test('an unrecognisable command is not found, with no suggestion', () => {
    const { display } = run('xyzzy')
    expect(display).toContainEqual({ kind: 'error', text: 'xyzzy: command not found' })
  })

  test('an empty line only echoes the prompt', () => {
    const { display } = run('   ')
    expect(display).toHaveLength(1)
  })

  test('every command is recorded on the timeline with how it went', () => {
    const { state } = run('kubectl get pods', 'kubectl get secrets', 'kubeclt get pods')
    expect(state.timeline).toEqual([
      { text: 'kubectl get pods', result: 'ran' },
      { text: 'kubectl get secrets', result: 'not-simulated' },
      { text: 'kubeclt get pods', result: 'unknown' },
    ])
  })
})

describe('key findings', () => {
  test('running a revealing command records its finding once and announces it', () => {
    const first = run('kubectl get pods')
    expect(first.state.findings).toEqual(['replaced'])
    expect(first.display).toContainEqual({ kind: 'notice', text: expect.stringContaining('The pods were replaced') })
    const again = run('kubectl get pods', 'kubectl get po')
    expect(again.state.findings).toEqual(['replaced'])
    expect(again.display.some((l) => l.kind === 'notice')).toBe(false)
  })

  test('commands that reveal nothing leave findings unchanged', () => {
    expect(run('ps aux', 'kubectl get secrets').state.findings).toEqual([])
  })
})

describe('pipes', () => {
  test('grep keeps matching lines', () => {
    expect(run('kubectl logs deploy/api --tail 3 | grep ERROR').text).toContain('ERROR checkout failed')
    expect(run('kubectl logs deploy/api --tail 3 | grep ERROR').text).not.toContain('INFO started')
  })

  test('grep -i ignores case, -v inverts, -c counts', () => {
    expect(run('kubectl logs deploy/api --tail 3 | grep -i error').display.at(-2)).toEqual({
      kind: 'output',
      text: 'ERROR checkout failed\nerror: retry failed',
    })
    expect(run('kubectl logs deploy/api --tail 3 | grep -v ERROR').text).toContain('INFO started')
    expect(run('kubectl logs deploy/api --tail 3 | grep -ic "error"').display).toContainEqual({ kind: 'output', text: '2' })
  })

  test('head and tail take the first or last lines', () => {
    expect(run('kubectl logs deploy/api --tail 3 | head -n 1').display).toContainEqual({ kind: 'output', text: 'INFO started' })
    expect(run('kubectl logs deploy/api --tail 3 | tail -1').display).toContainEqual({
      kind: 'output',
      text: 'error: retry failed',
    })
  })

  test('a pipe still reaches the finding of the command it filters', () => {
    expect(run('kubectl logs deploy/api --tail 3 | grep ERROR').state.findings).toEqual(['throws'])
  })

  test('a filter the lab does not simulate says so', () => {
    expect(run('kubectl get pods | awk "{print $1}"').text).toContain('not simulated here')
  })
})

describe('built-in commands', () => {
  test('clear asks the terminal to clear', () => {
    expect(run('kubectl get pods', 'clear').clear).toBe(true)
  })

  test('help explains how the terminal works', () => {
    expect(run('help').text).toMatch(/Tab/)
  })
})

describe('tab completion', () => {
  const tab = (text: string) => complete(incident, start(incident), text)

  test('completes a program name', () => {
    expect(tab('kub')).toEqual({ text: 'kubectl ', options: [] })
  })

  test('completes a subcommand that follows what was typed', () => {
    expect(tab('kubectl lo')).toEqual({ text: 'kubectl logs ', options: [] })
  })

  test('completes a resource name', () => {
    expect(tab('kubectl describe pod api-')).toEqual({ text: 'kubectl describe pod api-7f9c-2xk ', options: [] })
  })

  test('lists the options when more than one fits', () => {
    expect(tab('kubectl ')).toEqual({ text: 'kubectl ', options: ['get', 'logs'] })
  })

  test('leaves the input alone when nothing fits', () => {
    expect(tab('kubectl get zzz')).toEqual({ text: 'kubectl get zzz', options: [] })
  })
})

describe('kubectl logs --tail', () => {
  test('shows only the last N lines for any N', () => {
    expect(run('kubectl logs deploy/api --tail=1').display).toContainEqual({ kind: 'output', text: 'error: retry failed' })
    expect(run('kubectl logs deploy/api --tail 2').display).toContainEqual({
      kind: 'output',
      text: 'ERROR checkout failed\nerror: retry failed',
    })
  })

  test('without --tail shows everything', () => {
    expect(run('kubectl logs deploy/api').text).toContain('INFO started')
  })
})

describe('findings that need their evidence on screen', () => {
  test('are reached only when the evidence survives --tail and pipes', () => {
    expect(run('kubectl logs deploy/api --tail=1').state.findings).toEqual([])
    expect(run('kubectl logs deploy/api | grep INFO').state.findings).toEqual([])
    expect(run('kubectl logs deploy/api --tail=2').state.findings).toEqual(['throws'])
  })
})

describe('review fixes', () => {
  test('a mistyped kube resource type gets the real kubectl error', () => {
    expect(run('kubectl get pdos').display).toContainEqual({
      kind: 'error',
      text: 'error: the server doesn\'t have a resource type "pdos"',
    })
  })

  test('a pod that does not exist gets NotFound', () => {
    expect(run('kubectl describe pod api-nope').display).toContainEqual({
      kind: 'error',
      text: 'Error from server (NotFound): pods "api-nope" not found',
    })
  })

  test('other real commands are not simulated, not typos', () => {
    for (const text of ['kubectl create deployment x --image=y', 'kubectl uncordon node-a', 'jq .', 'awk 1', 'echo hi']) {
      expect(run(text).text, text).toContain('not simulated here')
    }
  })

  test('grep -E treats the pattern as a regular expression', () => {
    expect(run('kubectl logs deploy/api | grep -E "INFO|retry"').display).toContainEqual({
      kind: 'output',
      text: 'INFO started\nerror: retry failed',
    })
  })

  test('a grep flag the lab does not simulate says so instead of guessing', () => {
    expect(run('kubectl logs deploy/api | grep -A 3 ERROR').text).toContain('not simulated here')
  })

  test('counting lines does not count as seeing them', () => {
    expect(run('kubectl get pods | wc -l').state.findings).toEqual([])
  })

  test('tab completion does not offer flags unless one is being typed', () => {
    const tab = (text: string) => complete(incident, start(incident), text)
    expect(tab('kubectl logs deployment/api ').options).not.toContain('--tail')
  })
})

test('kubectl logs with a bare name means the pod of that name', () => {
  const pods = defineIncident({ ...incident, commands: [{ match: ['kubectl logs pod/api-7f9c-2xk'], output: 'pod log line' }] })
  const result = step(pods, start(pods), { kind: 'command', text: 'kubectl logs api-7f9c-2xk --tail=5' })
  expect(result.display).toContainEqual({ kind: 'output', text: 'pod log line' })
})
