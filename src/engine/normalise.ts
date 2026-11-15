import { kubeResourceTypes, programs, type FlagSpec, type ProgramSpec } from './programs'

/** Split a command line into words, honouring single and double quotes. */
export function tokenize(text: string): string[] {
  const words: string[] = []
  let current = ''
  let quote: string | null = null
  let inWord = false
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
  const parts: string[] = []
  let current = ''
  let quote: string | null = null
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === '|') {
      parts.push(current)
      current = ''
      continue
    }
    current += ch
  }
  parts.push(current)
  return parts.map((p) => p.trim())
}

type Parsed = { positionals: string[]; flags: Map<string, string | true> }

function findFlag(spec: ProgramSpec, spelling: string): FlagSpec | undefined {
  return spec.flags?.find((f) => f.spellings.includes(spelling))
}

function parse(program: string, args: string[]): Parsed {
  const spec: ProgramSpec = programs[program] ?? { clustersFreely: true }
  const positionals: string[] = []
  const flags = new Map<string, string | true>()

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--') {
      positionals.push('--', ...args.slice(i + 1))
      break
    }
    if (i === 0 && spec.bareCluster && /^[a-z]+$/i.test(arg)) {
      for (const ch of arg) flags.set(`-${ch}`, true)
      continue
    }
    if (arg.startsWith('--') && arg.length > 2) {
      const eq = arg.indexOf('=')
      const spelling = eq === -1 ? arg : arg.slice(0, eq)
      const flag = findFlag(spec, spelling)
      const name = flag?.name ?? spelling
      if (eq !== -1) flags.set(name, arg.slice(eq + 1))
      else if (flag?.takesValue && i + 1 < args.length) flags.set(name, args[++i]!)
      else flags.set(name, true)
      continue
    }
    if (arg.startsWith('-') && arg.length > 1 && !/^-\d/.test(arg)) {
      const exact = findFlag(spec, arg)
      if (exact) {
        if (exact.takesValue && i + 1 < args.length) flags.set(exact.name, args[++i]!)
        else flags.set(exact.name, true)
        continue
      }
      const first = findFlag(spec, arg.slice(0, 2))
      if (first?.takesValue) {
        flags.set(first.name, arg.slice(2))
        continue
      }
      const letters = [...arg.slice(1)]
      if (spec.clustersFreely || letters.every((ch) => findFlag(spec, `-${ch}`))) {
        for (const ch of letters) flags.set(findFlag(spec, `-${ch}`)?.name ?? `-${ch}`, true)
        continue
      }
      flags.set(arg, true)
      continue
    }
    positionals.push(arg)
  }
  return { positionals, flags }
}

/** kubectl resource words: "po" → "pod", "deploy/api" → "deployment/api", "get pods api-1" → "get pod/api-1". */
function normaliseKubePositionals(positionals: string[]): string[] {
  const end = positionals.indexOf('--')
  const head = end === -1 ? positionals : positionals.slice(0, end)
  const tail = end === -1 ? [] : positionals.slice(end)
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
  return [...out, ...tail]
}

/**
 * The canonical form of one command (no pipes): equal for every spelling that means the same thing.
 * `defaultNamespace` is the namespace of the Learner's kube context, so naming it is optional.
 */
export function canonical(text: string, defaultNamespace: string): string {
  return analyse(text, defaultNamespace).key
}

/**
 * The canonical key plus any part of the command the engine applies itself rather than matching on:
 * `kubectl logs --tail N` works for every N, so N is returned separately.
 */
export function analyse(text: string, defaultNamespace: string): { key: string; tail?: number } {
  const [program, ...args] = tokenize(text)
  if (!program) return { key: '' }
  const { positionals, flags } = parse(program, args)
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
  const flagWords = [...flags.entries()]
    .map(([name, value]) => {
      const bare = name.replace(/^-+/, '')
      return value === true ? `--${bare}` : `--${bare}=${value}`
    })
    .sort()
  return { key: [program, ...words, ...flagWords].join(' '), tail }
}
