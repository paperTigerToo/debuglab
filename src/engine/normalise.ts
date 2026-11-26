import { kubeResourceTypes, programs, type FlagSpec, type ProgramSpec } from './programs'

/** Visit each character with whether it sits inside quotes. Quote characters themselves are reported as quoted. */
function eachChar(text: string, visit: (ch: string, quoted: boolean) => void): void {
  let quote: string | null = null
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null
      visit(ch, true)
    } else if (ch === '"' || ch === "'") {
      quote = ch
      visit(ch, true)
    } else {
      visit(ch, false)
    }
  }
}

/** Split a command line into words, honouring single and double quotes. */
export function tokenize(text: string): string[] {
  const words: string[] = []
  let current = ''
  let inWord = false
  let quote: string | null = null
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null
      else current += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      inWord = true
    } else if (/\s/.test(ch)) {
      if (inWord) words.push(current)
      current = ''
      inWord = false
    } else {
      current += ch
      inWord = true
    }
  }
  if (inWord) words.push(current)
  return words
}

/** Split a command line on pipes that are not inside quotes. */
export function splitPipes(text: string): string[] {
  const parts: string[] = ['']
  eachChar(text, (ch, quoted) => {
    if (ch === '|' && !quoted) parts.push('')
    else parts[parts.length - 1] += ch
  })
  return parts.map((p) => p.trim())
}

export type Redirect = { command: string; file?: string; append: boolean }

/** Separate a trailing `> file` or `>> file` (outside quotes) from the command. `2>&1` is ignored. */
export function splitRedirect(text: string): Redirect {
  const marks: number[] = []
  let i = 0
  eachChar(text, (ch, quoted) => {
    if (ch === '>' && !quoted) marks.push(i)
    i++
  })
  const chars = [...text]
  const real = marks.filter((at) => chars[at - 1] !== '2' && chars[at + 1] !== '&' && chars[at - 1] !== '>')
  const at = real.at(-1)
  if (at === undefined) return { command: text.replace(/\s2>&1\b/, '').trim(), append: false }
  const append = chars[at + 1] === '>'
  const file = tokenize(chars.slice(at + (append ? 2 : 1)).join(''))[0]
  const command = chars.slice(0, at).join('').replace(/\s2>&1\b/, '').trim()
  return { command, file, append }
}

type Parsed = { positionals: string[]; inner: string[]; flags: Map<string, string | true> }

function findFlag(spec: ProgramSpec, spelling: string, subcommand: string | undefined): FlagSpec | undefined {
  return spec.flags?.find(
    (f) => f.spellings.includes(spelling) && (!f.only || (subcommand !== undefined && f.only.includes(subcommand))),
  )
}

function parse(program: string, args: string[]): Parsed {
  const spec: ProgramSpec = programs[program] ?? { clustersFreely: true }
  const positionals: string[] = []
  const flags = new Map<string, string | true>()
  const sub = () => (spec.subcommands ? positionals[0] : undefined)

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--') return { positionals, inner: args.slice(i + 1), flags }
    if (i === 0 && spec.bareCluster && /^[a-z]+$/i.test(arg)) {
      for (const ch of arg) flags.set(`-${ch}`, true)
      continue
    }
    if (arg.startsWith('--') && arg.length > 2) {
      const eq = arg.indexOf('=')
      const spelling = eq === -1 ? arg : arg.slice(0, eq)
      const flag = findFlag(spec, spelling, sub())
      const name = flag?.name ?? spelling
      if (eq !== -1) flags.set(name, arg.slice(eq + 1))
      else if (flag?.takesValue && i + 1 < args.length) flags.set(name, args[++i]!)
      else flags.set(name, true)
      continue
    }
    if (arg.startsWith('-') && arg.length > 1 && !/^-\d/.test(arg)) {
      const exact = findFlag(spec, arg, sub())
      if (exact) {
        if (exact.takesValue && i + 1 < args.length) flags.set(exact.name, args[++i]!)
        else flags.set(exact.name, true)
        continue
      }
      const first = findFlag(spec, arg.slice(0, 2), sub())
      if (first?.takesValue) {
        flags.set(first.name, arg.slice(2))
        continue
      }
      const letters = [...arg.slice(1)]
      if (spec.clustersFreely || letters.every((ch) => findFlag(spec, `-${ch}`, sub()))) {
        for (const ch of letters) flags.set(findFlag(spec, `-${ch}`, sub())?.name ?? `-${ch}`, true)
        continue
      }
      flags.set(arg, true)
      continue
    }
    positionals.push(arg)
  }
  return { positionals, inner: [], flags }
}

/** kubectl resource words: "po" → "pod", "deploy/api" → "deployment/api", "get pods api-1" → "get pod/api-1". */
function normaliseKubePositionals(head: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < head.length; i++) {
    const word = head[i]!
    const slash = word.indexOf('/')
    if (i > 0 && slash > 0) {
      const type = kubeResourceTypes[word.slice(0, slash)]
      out.push(type ? `${type}/${word.slice(slash + 1)}` : word)
      continue
    }
    const type = i > 0 ? kubeResourceTypes[word] : undefined
    if (!type) {
      // `kubectl logs NAME` and `kubectl exec NAME` name a pod.
      const bareName = i === 1 && (head[0] === 'logs' || head[0] === 'exec')
      out.push(bareName ? `pod/${word}` : word)
      continue
    }
    const next = head[i + 1]
    if (next !== undefined && !kubeResourceTypes[next] && !next.includes('/')) {
      out.push(`${type}/${next}`)
      i++
    } else {
      out.push(type)
    }
  }
  return out
}

/** A command reduced to the parts that decide what it means. */
export type Analysis = {
  /** Equal for every spelling that means the same thing. */
  key: string
  program: string
  /** Positional words before any `--`, normalised (for kubectl: subcommand, then "type/name"). */
  words: readonly string[]
  /** The command after `--`, as for `kubectl exec POD -- env`. */
  inner: readonly string[]
  flags: ReadonlyMap<string, string | true>
  /** `kubectl logs --tail N`: applied by the engine rather than matched, so every N works. */
  tail?: number
}

/**
 * Analyse one command (no pipes or redirects).
 * `defaultNamespace` is the namespace of the Learner's kube context, so naming it is optional.
 */
export function analyse(text: string, defaultNamespace: string): Analysis {
  const [program = '', ...args] = tokenize(text)
  const { positionals, inner, flags } = parse(program, args)
  let words = positionals
  let tail: number | undefined
  if (program === 'kubectl') {
    words = normaliseKubePositionals(positionals)
    if (flags.get('namespace') === defaultNamespace) flags.delete('namespace')
    const tailFlag = flags.get('tail')
    if (words[0] === 'logs' && typeof tailFlag === 'string' && /^\d+$/.test(tailFlag)) {
      tail = Number(tailFlag)
      flags.delete('tail')
    }
  }
  if (program === 'psql') normalisePsql(flags)
  const flagWords = [...flags.entries()]
    .map(([name, value]) => {
      const bare = name.replace(/^-+/, '')
      return value === true ? `--${bare}` : `--${bare}=${value}`
    })
    .sort()
  const innerWords = inner.length > 0 ? ['--', ...inner] : []
  const key = program ? [program, ...words, ...flagWords, ...innerWords].join(' ') : ''
  return { key, program, words, inner, flags, tail }
}

/**
 * psql: the database defaults to the role's own, and a statement means the same whatever the case of its keywords,
 * its spacing or a closing semicolon. String literals keep their case, because PostgreSQL compares them exactly.
 */
function normalisePsql(flags: Map<string, string | true>): void {
  if (flags.get('dbname') !== undefined && flags.get('dbname') === flags.get('username')) flags.delete('dbname')
  const sql = flags.get('command')
  if (typeof sql === 'string') flags.set('command', normaliseSql(sql))
}

export function normaliseSql(sql: string): string {
  let out = ''
  eachChar(sql, (ch, quoted) => {
    if (quoted) out += ch
    else if (!/\s/.test(ch)) out += ch.toLowerCase()
    else if (!out.endsWith(' ')) out += ' '
  })
  return out.trim().replace(/\s*;+$/, '')
}

export function canonical(text: string, defaultNamespace: string): string {
  return analyse(text, defaultNamespace).key
}
