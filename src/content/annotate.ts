// Finding terms in text, so every term, command and flag can carry its tooltip.
import type { Term } from './terms'

export type Segment = string | { text: string; term: Term }

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Compiled once per term list: one alternation, longest spellings first so the longest match wins.
const compiledByTerms = new WeakMap<readonly Term[], { pattern: RegExp; bySpelling: Map<string, Term> }>()

function compile(terms: readonly Term[]) {
  const cached = compiledByTerms.get(terms)
  if (cached) return cached
  const bySpelling = new Map<string, Term>()
  for (const term of terms) for (const spelling of term.matches) bySpelling.set(spelling, term)
  const spellings = [...bySpelling.keys()].sort((a, b) => b.length - a.length).map(escape)
  // A term is a whole word, not part of a name, path or address such as pod/redis-7c9d:
  // not preceded by a word character, hyphen or slash, and not followed by a word character or hyphen.
  const pattern = new RegExp(`(?<![\\w/-])(?:${spellings.join('|')})(?![\\w-])`, 'g')
  const compiled = { pattern, bySpelling }
  compiledByTerms.set(terms, compiled)
  return compiled
}

/**
 * Split text into plain runs and terms. Each term is marked only the first time it appears, so a
 * block of output is not covered in underlines. Pass the same `seen` set to several texts, such as
 * the lines of a terminal, to mark each term once across all of them.
 */
export function annotate(text: string, terms: readonly Term[], seen = new Set<string>()): Segment[] {
  const { pattern, bySpelling } = compile(terms)
  const segments: Segment[] = []
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const term = bySpelling.get(match[0])!
    if (seen.has(term.id)) continue
    seen.add(term.id)
    if (match.index > last) segments.push(text.slice(last, match.index))
    segments.push({ text: match[0], term })
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push(text.slice(last))
  return segments.length > 0 ? segments : [text]
}
