import { analyse, canonical, splitPipes, tokenize } from './normalise'
import { kubeResourceTypes, programs } from './programs'
import type { Completion, IncidentDefinition, Input, Line, SessionState, StepResult, TimelineEntry } from './types'

export function start(definition: IncidentDefinition): SessionState {
  return { namedState: definition.initialState, location: { kind: 'local' }, timeline: [], findings: [] }
}

export function prompt(_state: SessionState): string {
  return 'you@laptop:~$'
}

export function step(definition: IncidentDefinition, state: SessionState, input: Input): StepResult {
  const text = input.text.trim()
  const echo: Line = { kind: 'input', prompt: prompt(state), text: input.text }
  if (!text) return { state, display: [echo] }

  const record = (result: TimelineEntry['result'], next: SessionState = state): SessionState => ({
    ...next,
    timeline: [...next.timeline, { text, result }],
  })

  if (text === 'clear') return { state: record('builtin'), display: [], clear: true }
  if (text === 'help') return { state: record('builtin'), display: [echo, { kind: 'output', text: HELP }] }

  const [command = '', ...filters] = splitPipes(text)
  const { key, tail } = analyse(command, definition.namespace)
  const entry = definition.commands.find((c) => c.match.some((m) => canonical(m, definition.namespace) === key))
  if (entry) {
    let output = typeof entry.output === 'string' ? entry.output : (entry.output[state.namedState] ?? '')
    if (tail !== undefined) output = tail === 0 ? '' : output.split('\n').slice(-tail).join('\n')
    // Whether the Learner still sees the lines themselves, not just a count of them.
    let linesShown = true
    for (const filter of filters) {
      const filtered = applyFilter(filter, output)
      if (filtered === undefined) return notSimulated(echo, tokenize(filter)[0] ?? filter, record)
      output = filtered.output
      linesShown &&= filtered.linesShown
    }
    const fresh = (entry.reveals ?? [])
      .filter((r) =>
        typeof r === 'string' ? linesShown && output.trim() !== '' : linesShown && output.includes(r.seenIn),
      )
      .map((r) => (typeof r === 'string' ? r : r.finding))
      .filter((f, i, all) => !state.findings.includes(f) && all.indexOf(f) === i)
    const next = record('ran', { ...state, findings: [...state.findings, ...fresh] })
    const notices: Line[] = fresh.map((f) => ({
      kind: 'notice',
      text: `Finding: ${definition.findings[f]?.summary ?? f}`,
    }))
    return { state: next, display: [echo, { kind: 'output', text: output }, ...notices] }
  }

  const [program = '', subcommand, target] = key.split(' ').filter((w) => !w.startsWith('--'))
  const spec = programs[program]
  if (!spec) {
    const suggestion = closest(program, Object.keys(programs))
    const message = suggestion
      ? `${program}: command not found. Did you mean ${suggestion}?`
      : `${program}: command not found`
    return { state: record('unknown'), display: [echo, { kind: 'error', text: message }] }
  }
  if (spec.subcommands && subcommand && !subcommand.startsWith('-') && !spec.subcommands.includes(subcommand)) {
    const suggestion = closest(subcommand, spec.subcommands)
    const message = `error: unknown command "${subcommand}" for "${program}"` + (suggestion ? `\n\nDid you mean this?\n\t${suggestion}` : '')
    return { state: record('unknown'), display: [echo, { kind: 'error', text: message }] }
  }
  if (program === 'kubectl' && subcommand && target) {
    const error = kubeLookupError(definition, subcommand, target)
    if (error) return { state: record('unknown'), display: [echo, { kind: 'error', text: error }] }
  }
  return notSimulated(echo, program, record)
}

const knownKubeTypes = new Set(Object.values(kubeResourceTypes))

/**
 * What real kubectl says when the resource type or pod name does not exist, so a typo there
 * reads as a typo and not as "not simulated here". Pod names are the Incident's completions.
 */
function kubeLookupError(definition: IncidentDefinition, verb: string, target: string): string | undefined {
  if (['get', 'describe', 'delete', 'edit'].includes(verb)) {
    const type = target.split('/')[0]!
    if (!knownKubeTypes.has(type)) return `error: the server doesn't have a resource type "${type}"`
  }
  const pod = target.startsWith('pod/') ? target.slice(4) : verb === 'logs' && !target.includes('/') ? target : undefined
  if (pod !== undefined && !definition.completions.includes(pod)) {
    return `Error from server (NotFound): pods "${pod}" not found`
  }
  return undefined
}

const HELP = [
  'This terminal simulates a real one for this Incident.',
  '',
  '  Type commands as you would on a real system: kubectl, and Linux tools inside containers.',
  '  Flag order, spacing and short or long flag forms do not matter.',
  '  Tab completes commands and resource names; Up and Down recall earlier commands.',
  '  Pipe output into grep, head, tail or wc -l to narrow it.',
  '  clear empties the screen.',
  '',
  'A real command the lab has not scripted replies "not simulated here".',
].join('\n')

function notSimulated(
  echo: Line,
  program: string,
  record: (result: TimelineEntry['result']) => SessionState,
): StepResult {
  return {
    state: record('not-simulated'),
    display: [
      echo,
      {
        kind: 'notice',
        text: `${program} is a real command, but this exact command is not simulated here. Its output would not help with this Incident, or the lab has not scripted it. Try a different question.`,
      },
    ],
  }
}

type Filtered = { output: string; linesShown: boolean }

/** Run output through one pipe stage, or return undefined if the stage or one of its flags is not simulated. */
function applyFilter(stage: string, output: string): Filtered | undefined {
  const [program, ...args] = tokenize(stage)
  const lines = output.split('\n')
  const flags = new Set<string>()
  const positionals: string[] = []
  let count: number | undefined
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (/^-\d+$/.test(arg)) count = Number(arg.slice(1))
    else if (arg === '-n' && args[i + 1] !== undefined) count = Number(args[++i])
    else if (/^-n\d+$/.test(arg)) count = Number(arg.slice(2))
    else if (arg.startsWith('--lines=')) count = Number(arg.slice(8))
    else if (arg.startsWith('-') && arg.length > 1) for (const ch of arg.slice(1)) flags.add(ch)
    else positionals.push(arg)
  }
  const onlyFlags = (allowed: string) => [...flags].every((f) => allowed.includes(f))
  const shown = (text: string): Filtered => ({ output: text, linesShown: true })
  switch (program) {
    case 'grep': {
      const pattern = positionals[0]
      if (pattern === undefined || positionals.length > 1 || count !== undefined || !onlyFlags('ivcE')) return undefined
      let matches: (line: string) => boolean
      if (flags.has('E')) {
        let regex: RegExp
        try {
          regex = new RegExp(pattern, flags.has('i') ? 'i' : '')
        } catch {
          return undefined
        }
        matches = (line) => regex.test(line)
      } else {
        const needle = flags.has('i') ? pattern.toLowerCase() : pattern
        matches = (line) => (flags.has('i') ? line.toLowerCase() : line).includes(needle)
      }
      const kept = lines.filter((l) => matches(l) !== flags.has('v'))
      return flags.has('c') ? { output: String(kept.length), linesShown: false } : shown(kept.join('\n'))
    }
    case 'head':
      return onlyFlags('') && positionals.length === 0 ? shown(lines.slice(0, count ?? 10).join('\n')) : undefined
    case 'tail':
      return onlyFlags('') && positionals.length === 0 ? shown(lines.slice(-(count ?? 10)).join('\n')) : undefined
    case 'wc':
      return flags.has('l') && onlyFlags('l') ? { output: String(lines.length), linesShown: false } : undefined
    default:
      return undefined
  }
}

const BUILTINS = ['clear', 'help']

/**
 * Complete the last word of `text`. Candidates come from the scripted commands whose earlier words
 * match what was typed, falling back to any scripted word or resource name.
 */
export function complete(definition: IncidentDefinition, _state: SessionState, text: string): Completion {
  const endsWithSpace = /\s$/.test(text) || text === ''
  const typed = tokenize(text)
  const prefix = endsWithSpace ? '' : (typed.pop() ?? '')
  const position = typed.length
  const scripted = definition.commands.flatMap((c) => c.match.map((m) => tokenize(m)))

  let candidates: string[]
  if (position === 0) {
    candidates = [...scripted.map((words) => words[0]!), ...BUILTINS]
  } else {
    const following = scripted
      .filter((words) => typed.every((w, i) => words[i] === w))
      .map((words) => words[position])
      .filter((w): w is string => w !== undefined)
    const anywhere = [...scripted.flatMap((words) => words.slice(1)), ...definition.completions]
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

/** The closest word within a small edit distance, or undefined. */
function closest(word: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined
  let bestDistance = Math.max(1, Math.min(2, Math.floor(word.length / 3)))
  for (const candidate of candidates) {
    const d = editDistance(word, candidate)
    if (d <= bestDistance && (best === undefined || d < bestDistance)) {
      best = candidate
      bestDistance = d
    }
  }
  return best
}

/** Damerau–Levenshtein (optimal string alignment): a swapped pair of letters counts as one edit. */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1)
      d[i]![j] = v
    }
  }
  return d[a.length]![b.length]!
}
