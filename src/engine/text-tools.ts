// The text tools the terminal simulates for real: grep, head, tail and wc, used in pipes
// and on saved files. Anything they do not support is reported as not simulated.
import { tokenize } from './normalise'

export type Filtered = {
  output: string
  /** False when the Learner sees a count rather than the lines themselves. */
  linesShown: boolean
}

type ToolArgs = { flags: Set<string>; positionals: string[]; count?: number }

function parseToolArgs(args: readonly string[]): ToolArgs {
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
  return { flags, positionals, count }
}

/** How many positional words each tool takes before an optional file name. */
const operands: Record<string, number> = { grep: 1, head: 0, tail: 0, wc: 0, cat: 0, less: 0 }

export function isTextTool(program: string): boolean {
  return program in operands
}

/** Every command that reads the Learner's saved files, for tab completion. */
export const fileReadingCommands: readonly string[] = [...Object.keys(operands), 'ls']

/** Split `grep -i warn api.log` into the filter stage `grep -i warn` and the file `api.log`, if any. */
export function fileOperand(stage: string): { stage: string; file?: string } {
  const [program = '', ...args] = tokenize(stage)
  const { positionals } = parseToolArgs(args)
  const needed = operands[program]
  if (needed === undefined || positionals.length <= needed) return { stage }
  const file = positionals.at(-1)!
  const words = tokenize(stage)
  const at = words.lastIndexOf(file)
  return { stage: words.filter((_, i) => i !== at).map(quoteIfNeeded).join(' '), file }
}

function quoteIfNeeded(word: string): string {
  return /[\s|"']/.test(word) ? `'${word.replace(/'/g, '')}'` : word
}

/** Run text through one tool, or return undefined if the tool or one of its flags is not simulated. */
export function applyTextTool(stage: string, text: string): Filtered | undefined {
  const [program, ...args] = tokenize(stage)
  const { flags, positionals, count } = parseToolArgs(args)
  const lines = text.split('\n')
  const onlyFlags = (allowed: string) => [...flags].every((f) => allowed.includes(f))
  const shown = (output: string): Filtered => ({ output, linesShown: true })
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
    case 'cat':
    case 'less':
      return onlyFlags('') && positionals.length === 0 ? shown(text) : undefined
    case 'wc':
      return flags.has('l') && onlyFlags('l') ? { output: String(lines.length), linesShown: false } : undefined
    default:
      return undefined
  }
}
