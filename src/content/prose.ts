// Content prose with links written inline as [text](kind:id), so a Concept can cite a Resource,
// another Concept or an Incident in the middle of a sentence. The integrity test resolves every one.

export type ContentLink = { kind: 'concept' | 'resource' | 'incident'; id: string }
export type ProsePart = string | { text: string; to: ContentLink }

const link = /\[([^\]]+)\]\((concept|resource|incident):([a-z0-9-]+)\)/g

export function parseProse(text: string): ProsePart[] {
  const parts: ProsePart[] = []
  let last = 0
  for (const match of text.matchAll(link)) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push({ text: match[1]!, to: { kind: match[2] as ContentLink['kind'], id: match[3]! } })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** The links in a piece of prose. */
export const linksIn = (text: string): ContentLink[] =>
  parseProse(text).flatMap((part) => (typeof part === 'string' ? [] : [part.to]))

/**
 * Link markup that did not parse, such as a misspelt kind, which would otherwise show as raw text.
 * Returns each offending fragment.
 */
export function malformedLinks(text: string): string[] {
  return parseProse(text).flatMap((part) => (typeof part === 'string' ? (part.match(/\[[^\]]*\]\([^)]*\)?|\]\(/g) ?? []) : []))
}
