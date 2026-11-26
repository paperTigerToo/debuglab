// The Incident engine: a pure function from (Incident definition, session state, input) to
// (new session state, what to display). It knows nothing about the interface.
import { analyse, canonical, splitPipes, splitRedirect, tokenize, type Analysis } from './normalise'
import { kubeResourceTypes, programs } from './programs'
import { revealHint } from './hints'
import { evidenceStatus } from './session'
import { closest } from './suggest'
import { applyTextTool, fileOperand, fileReadingCommands, isTextTool } from './text-tools'
import type {
  CommandEntry,
  Completion,
  IncidentDefinition,
  Input,
  Line,
  Location,
  PerState,
  SavedFile,
  SessionState,
  StepResult,
  TimelineEntry,
} from './types'

type AnyCommandEntry = CommandEntry<string, string, string>

export { debrief, type Debrief } from './debrief'
export { currentHint, hintsUsed, type HintView } from './hints'
export { dashboard, evidenceStatus, harmStopped } from './session'

export function start(definition: IncidentDefinition): SessionState {
  return {
    namedState: definition.initialState,
    location: { kind: 'local' },
    timeline: [],
    findings: [],
    files: [],
    destroyed: [],
    hintTiers: {},
  }
}

export function prompt(state: SessionState): string {
  if (state.pending) return 'Proceed? [y/N]'
  return state.location.kind === 'container' ? `root@${state.location.pod}:/app#` : 'you@laptop:~$'
}

export function step(definition: IncidentDefinition, state: SessionState, input: Input): StepResult {
  if (input.kind === 'hint') return { state: state.outcome ? state : revealHint(definition, state), display: [] }
  if (input.kind === 'finish') return { state: finish(definition, state, input.rootCause, input.mitigation), display: [] }
  return runCommand(definition, state, input.text)
}

function finish(definition: IncidentDefinition, state: SessionState, rootCause: string, mitigation: string): SessionState {
  const known = definition.rootCauses.some((c) => c.id === rootCause) && definition.mitigations.some((m) => m.id === mitigation)
  if (!known || state.outcome) return state
  const { pending: _, ...rest } = state
  return { ...rest, outcome: { rootCause, mitigation } }
}

function runCommand(definition: IncidentDefinition, state: SessionState, typed: string): StepResult {
  const text = typed.trim()
  const echo: Line = { kind: 'input', prompt: prompt(state), text: typed }
  if (state.outcome) {
    return {
      state,
      display: [echo, { kind: 'notice', text: 'This Incident is over. Read the Debrief, or restart the Incident to try again.' }],
    }
  }
  if (state.pending) return answerConfirmation(definition, state, echo, text)
  if (!text) return { state, display: [echo] }

  const record = (result: TimelineEntry['result'], next: SessionState = state): SessionState => ({
    ...next,
    timeline: [...next.timeline, { text, result }],
  })
  const reply = (result: TimelineEntry['result'], ...lines: Line[]): StepResult => ({
    state: record(result),
    display: [echo, ...lines],
  })

  if (text === 'clear') return { state: record('builtin'), display: [], clear: true }
  if (text === 'help') return reply('builtin', { kind: 'output', text: HELP })
  if (text === 'exit') {
    if (state.location.kind === 'local') {
      return reply('builtin', { kind: 'notice', text: 'You are on your own machine already; there is no shell to leave.' })
    }
    return { state: record('builtin', { ...state, location: { kind: 'local' } }), display: [echo, { kind: 'output', text: 'exit' }] }
  }

  const redirect = splitRedirect(text)
  const [first = '', ...stages] = splitPipes(redirect.command)
  const savesFile = redirect.file !== undefined || stages.some((stage) => tokenize(stage)[0] === 'tee')
  if (savesFile && state.location.kind === 'container') {
    return reply('not-simulated', {
      kind: 'notice',
      text: 'A file written inside the container would vanish with it, so the lab does not keep one. Leave the shell (exit) and save from your own machine: kubectl exec POD -- COMMAND > FILE.',
    })
  }
  const source = resolveSource(definition, state, first, state.location)

  switch (source.kind) {
    case 'reply':
      return reply(source.result, source.line)
    case 'enter-shell':
      return { state: record('ran', { ...state, location: source.location }), display: [echo] }
    case 'confirm':
      return {
        state: { ...state, pending: { text, entry: definition.commands.indexOf(source.entry) } },
        display: [
          echo,
          { kind: 'warning', text: `${source.entry.mutating!.warning}\nThis changes the Target System.` },
        ],
      }
  }

  let output = source.output
  let linesShown = true
  // Whether the output is still everything the command printed, so saving it captures the evidence whole.
  let whole = source.whole
  const saved: SavedFile[] = []
  for (const stage of stages) {
    const [program = '', file] = tokenize(stage)
    if (program === 'tee' && file) {
      saved.push(savedFile(state, file, output, source, whole))
      continue
    }
    const filtered = applyTextTool(stage, output)
    if (filtered === undefined) return reply('not-simulated', notSimulated(program || stage))
    output = filtered.output
    linesShown &&= filtered.linesShown
    whole = false
  }

  if (redirect.file) {
    const existing = state.files.find((f) => f.name === redirect.file)
    const content = redirect.append && existing ? `${existing.content}\n${output}` : output
    saved.push(savedFile(state, redirect.file, content, source, whole))
    return { state: record('ran', withFiles(state, saved)), display: [echo] }
  }

  const fresh = source.entry ? reachedFindings(source.entry, output, linesShown, state.findings) : []
  const next = record('ran', { ...withFiles(state, saved), findings: [...state.findings, ...fresh] })
  const notices: Line[] = fresh.map((f) => ({ kind: 'notice', text: `Finding: ${definition.findings[f]?.summary ?? f}` }))
  return { state: next, display: [echo, { kind: 'output', text: output }, ...notices] }
}

// ---------------------------------------------------------------------------------------------
// Where a command's output comes from

type Source =
  | { kind: 'output'; output: string; entry?: AnyCommandEntry; key: string; whole: boolean }
  | { kind: 'reply'; result: TimelineEntry['result']; line: Line }
  | { kind: 'enter-shell'; location: Location }
  | { kind: 'confirm'; entry: AnyCommandEntry }

const SHELLS: Record<string, 'sh' | 'bash'> = { sh: 'sh', '/bin/sh': 'sh', bash: 'bash', '/bin/bash': 'bash' }

function resolveSource(definition: IncidentDefinition, state: SessionState, command: string, at: Location): Source {
  const analysis = analyse(command, definition.namespace)
  const { program, words } = analysis

  if (at.kind === 'local') {
    const file = readSavedFile(definition, state, command, program)
    if (file) return file
    if (program === 'kubectl' && words[0] === 'exec') return kubectlExec(definition, state, analysis)
  }

  const entry = findEntry(definition, state, analysis, at)
  if (entry) {
    if (entry.mutating) return { kind: 'confirm', entry }
    const full = outputFor(entry, state)!
    const tail = analysis.tail
    const output = tail === undefined ? full : tail === 0 ? '' : full.split('\n').slice(-tail).join('\n')
    return { kind: 'output', output, entry, key: analysis.key, whole: output === full }
  }

  if (at.kind === 'container' && (program === 'kubectl' || !programs[program])) {
    const message = at.shell === 'bash' ? `bash: ${program}: command not found` : `sh: 1: ${program}: not found`
    return error(message)
  }
  return unscripted(definition, state, analysis)
}

function findEntry(definition: IncidentDefinition, state: SessionState, analysis: Analysis, at: Location) {
  return definition.commands.find(
    (c) => (c.where ?? 'local') === at.kind && outputFor(c, state) !== undefined && matchesKey(definition, c, analysis.key),
  )
}

function matchesKey(definition: IncidentDefinition, entry: AnyCommandEntry, key: string): boolean {
  return entry.match.some((m) => canonical(m, definition.namespace) === key)
}

function outputFor(entry: AnyCommandEntry, state: SessionState): string | undefined {
  return perState(entry.output, state.namedState)
}

function perState<T>(value: PerState<string, T>, named: string): T | undefined {
  if (typeof value === 'string' || Array.isArray(value)) return value as T
  return (value as Partial<Record<string, T>>)[named]
}

function resources(definition: IncidentDefinition, state: SessionState): readonly string[] {
  return perState(definition.resources, state.namedState) ?? []
}

function error(text: string): Source {
  return { kind: 'reply', result: 'unknown', line: { kind: 'error', text } }
}

/** `kubectl exec POD -- sh` opens a shell; `kubectl exec POD -- CMD` runs CMD there once. */
function kubectlExec(definition: IncidentDefinition, state: SessionState, analysis: Analysis): Source {
  const target = analysis.words[1]
  if (!target) return error('error: expected \'exec POD_NAME COMMAND [ARG1] [ARG2] ... [ARGN]\'.')
  const lookup = kubeLookupError(definition, state, analysis.words)
  if (lookup) return error(lookup)
  const pod = target.replace(/^pod\//, '')
  if (!pod.startsWith(definition.shellPodPrefix)) return { kind: 'reply', result: 'not-simulated', line: notSimulated('kubectl') }
  if (analysis.inner.length === 0) return error('error: you must specify at least one command for the container')
  const shell = SHELLS[analysis.inner.join(' ')]
  if (shell) return { kind: 'enter-shell', location: { kind: 'container', pod, shell } }
  // `sh -c 'SCRIPT'` hands the script to the container's own shell.
  const [program = '', flag, script] = analysis.inner
  if (SHELLS[program] && flag === '-c' && script !== undefined && analysis.inner.length === 3) {
    return resolveSource(definition, state, script, { kind: 'container', pod, shell: SHELLS[program] })
  }
  // Without a shell nothing expands a glob, so the program receives the pattern itself as a file name.
  const glob = analysis.inner.slice(1).find((word) => !/\s/.test(word) && /[*?[]/.test(word))
  if (glob) return error(`${program}: ${program === 'rm' ? 'cannot remove' : 'cannot access'} '${glob}': No such file or directory`)
  return resolveSource(definition, state, analysis.inner.map(requote).join(' '), { kind: 'container', pod, shell: 'sh' })
}

/** Quote a word again for re-reading, so `psql -c "SELECT 1"` keeps its query as one argument. */
function requote(word: string): string {
  if (!/[\s"']/.test(word)) return word
  return word.includes('"') ? `'${word}'` : `"${word}"`
}

/** `cat FILE`, `grep PATTERN FILE`, `ls` and friends, run against the files the Learner saved. */
function readSavedFile(definition: IncidentDefinition, state: SessionState, command: string, program: string): Source | undefined {
  if (program === 'ls' && tokenize(command).length === 1) {
    return { kind: 'output', output: state.files.map((f) => f.name).join('  '), key: 'ls', whole: false }
  }
  if (!isTextTool(program)) return undefined
  const { stage, file: name } = fileOperand(command)
  if (!name) return undefined
  const file = state.files.find((f) => f.name === name)
  if (!file) return error(`${program}: ${name}: No such file or directory`)
  const result = applyTextTool(stage, file.content)
  if (!result) return { kind: 'reply', result: 'not-simulated', line: notSimulated(program) }
  const entry = definition.commands.find((c) => matchesKey(definition, c, file.source))
  // A count is not reading the lines, so it reaches no findings. A copy of a file is not new evidence.
  return { kind: 'output', output: result.output, entry: result.linesShown ? entry : undefined, key: file.source, whole: false }
}

function savedFile(
  state: SessionState,
  name: string,
  content: string,
  source: Extract<Source, { kind: 'output' }>,
  whole: boolean,
): SavedFile {
  const evidence = source.entry?.evidence
  const stillExists = whole && evidence !== undefined && !state.destroyed.includes(evidence)
  const previous = state.files.find((f) => f.name === name)
  return {
    name,
    content,
    source: source.key,
    evidence: stillExists ? evidence : previous?.evidence,
  }
}

function withFiles(state: SessionState, saved: readonly SavedFile[]): SessionState {
  if (saved.length === 0) return state
  const names = new Set(saved.map((f) => f.name))
  return { ...state, files: [...state.files.filter((f) => !names.has(f.name)), ...saved] }
}

function reachedFindings(entry: AnyCommandEntry, output: string, linesShown: boolean, known: readonly string[]): string[] {
  if (!linesShown) return []
  return (entry.reveals ?? [])
    .filter((r) => (typeof r === 'string' ? output.trim() !== '' : output.includes(r.seenIn)))
    .map((r) => (typeof r === 'string' ? r : r.finding))
    .filter((f, i, all) => !known.includes(f) && all.indexOf(f) === i)
}

// ---------------------------------------------------------------------------------------------
// Confirming a mutating command

function answerConfirmation(definition: IncidentDefinition, state: SessionState, echo: Line, answer: string): StepResult {
  const pendingText = state.pending!.text
  const { pending: _, ...rest } = state
  const timeline = (result: TimelineEntry['result']) => [...state.timeline, { text: pendingText, result }]
  if (!/^y(es)?$/i.test(answer)) {
    return {
      state: { ...rest, timeline: timeline('cancelled') },
      display: [echo, { kind: 'notice', text: 'Cancelled. Nothing was changed.' }],
    }
  }
  // The entry was found when the command was typed, wherever it runs (in a pod via kubectl exec, say).
  const entry = definition.commands[state.pending!.entry]!
  const mutation = entry.mutating!
  const destroyedNow = (mutation.destroys ?? []).filter((e) => !state.destroyed.includes(e))
  const captured = evidenceStatus(state).captured
  const lostNow = destroyedNow.filter((e) => !captured.includes(e))
  const lines: Line[] = [
    echo,
    { kind: 'output', text: outputFor(entry, state) ?? '' },
    { kind: 'notice', text: mutation.consequence },
    ...lostNow.map((e): Line => ({ kind: 'warning', text: `Evidence lost: ${definition.evidence[e]?.lost ?? e}` })),
  ]
  return {
    state: {
      ...rest,
      namedState: mutation.to,
      destroyed: [...state.destroyed, ...destroyedNow],
      timeline: timeline('ran'),
    },
    display: lines,
  }
}

// ---------------------------------------------------------------------------------------------
// Commands outside the script

function unscripted(definition: IncidentDefinition, state: SessionState, analysis: Analysis): Source {
  const { program, words } = analysis
  const spec = programs[program]
  if (!spec) {
    const suggestion = closest(program, Object.keys(programs))
    return error(suggestion ? `${program}: command not found. Did you mean ${suggestion}?` : `${program}: command not found`)
  }
  const subcommand = words[0]
  if (spec.subcommands && subcommand && !spec.subcommands.includes(subcommand)) {
    const suggestion = closest(subcommand, spec.subcommands)
    return error(
      `error: unknown command "${subcommand}" for "${program}"` + (suggestion ? `\n\nDid you mean this?\n\t${suggestion}` : ''),
    )
  }
  if (program === 'kubectl') {
    const lookup = kubeLookupError(definition, state, words)
    if (lookup) return error(lookup)
  }
  return { kind: 'reply', result: 'not-simulated', line: notSimulated(program) }
}

const knownKubeTypes = new Set(Object.values(kubeResourceTypes))

const notFoundKind: Record<string, string> = {
  pod: 'pods',
  deployment: 'deployments.apps',
  replicaset: 'replicasets.apps',
  statefulset: 'statefulsets.apps',
  service: 'services',
  node: 'nodes',
  configmap: 'configmaps',
  secret: 'secrets',
  storageclass: 'storageclasses.storage.k8s.io',
}

/**
 * What real kubectl says when a resource type or a named resource does not exist, so a typo reads as a
 * typo and not as "not simulated here". Only types the Incident lists resources for are checked by name.
 */
function kubeLookupError(definition: IncidentDefinition, state: SessionState, words: readonly string[]): string | undefined {
  const [verb, target] = words
  if (verb && target && ['get', 'describe', 'delete', 'edit'].includes(verb)) {
    const type = target.split('/')[0]!
    if (!knownKubeTypes.has(type)) return `error: the server doesn't have a resource type "${type}"`
  }
  // These name a resource that need not exist yet.
  if (verb && ['create', 'run', 'apply', 'replace', 'diff', 'explain'].includes(verb)) return undefined
  const existing = resources(definition, state)
  const tracked = new Set(
    (Array.isArray(definition.resources) ? definition.resources : Object.values(definition.resources).flat()).map(
      (r) => (r as string).split('/')[0],
    ),
  )
  for (const word of words.slice(1)) {
    const slash = word.indexOf('/')
    if (slash <= 0) continue
    const type = word.slice(0, slash)
    if (tracked.has(type) && !existing.includes(word)) {
      return `Error from server (NotFound): ${notFoundKind[type] ?? `${type}s`} "${word.slice(slash + 1)}" not found`
    }
  }
  return undefined
}

function notSimulated(program: string): Line {
  return {
    kind: 'notice',
    text: `${program} is a real command, but this exact command is not simulated here. Its output would not help with this Incident, or the lab has not scripted it. Try a different question.`,
  }
}

const HELP = [
  'This terminal simulates a real one for this Incident.',
  '',
  '  Type commands as you would on a real system: kubectl here, Linux tools inside a container.',
  '  kubectl exec -it POD -- sh opens a shell in a container; exit leaves it.',
  '  Flag order, spacing and short or long flag forms do not matter.',
  '  Tab completes commands and names; Up and Down recall earlier commands.',
  '  Pipe output into grep, head, tail or wc -l to narrow it.',
  '  Save output with > FILE or | tee FILE, then read it with cat, grep, head or tail.',
  '  Commands that change the Target System ask before they run.',
  '  clear empties the screen.',
  '',
  'A real command the lab has not scripted replies "not simulated here".',
].join('\n')

// ---------------------------------------------------------------------------------------------
// Tab completion

const BUILTINS = ['clear', 'help', 'exit']

/**
 * Complete the last word of `text`. Candidates come from the scripted commands for the current location
 * whose earlier words match what was typed, falling back to any scripted word, current resource name or saved file.
 */
export function complete(definition: IncidentDefinition, state: SessionState, text: string): Completion {
  const endsWithSpace = /\s$/.test(text) || text === ''
  const typed = tokenize(text)
  const prefix = endsWithSpace ? '' : (typed.pop() ?? '')
  const position = typed.length
  const here = state.location.kind
  const scripted = definition.commands
    .filter((c) => (c.where ?? 'local') === here)
    .flatMap((c) => c.match.map((m) => tokenize(m)))
  const local = here === 'local'

  let candidates: string[]
  if (local && position > 0 && fileReadingCommands.includes(typed[0]!) && state.files.length > 0) {
    candidates = state.files.map((f) => f.name)
  } else if (position === 0) {
    candidates = [...scripted.map((words) => words[0]!), ...BUILTINS, ...(local && state.files.length ? fileReadingCommands : [])]
  } else {
    const following = scripted
      .filter((words) => typed.every((w, i) => words[i] === w))
      .map((words) => words[position])
      .filter((w): w is string => w !== undefined)
    const names = resources(definition, state).map((r) => r.slice(r.indexOf('/') + 1))
    const anywhere = [
      ...scripted.flatMap((words) => words.slice(1)),
      ...(local ? names : []),
      ...(local ? state.files.map((f) => f.name) : []),
    ]
    candidates = following.some((w) => w.startsWith(prefix)) ? following : anywhere
  }
  // Offer flags only once the Learner starts typing one, so completion does not list the script's flags.
  const fits = (c: string) => c.startsWith(prefix) && (prefix.startsWith('-') || !c.startsWith('-'))
  const options = [...new Set(candidates.filter(fits))].sort()
  const base = text.slice(0, text.length - prefix.length)
  if (options.length === 0) return { text, options: [] }
  if (options.length === 1) return { text: `${base}${options[0]} `, options: [] }
  const shared = commonPrefix(options)
  return { text: `${base}${shared}`, options: shared.length > prefix.length ? [] : options }
}

function commonPrefix(words: readonly string[]): string {
  let shared = words[0] ?? ''
  for (const w of words) while (!w.startsWith(shared)) shared = shared.slice(0, -1)
  return shared
}
