// Every cross-reference between Concepts, Resources, Incidents and terms must resolve, so content
// cannot rot silently. CI runs this before the site is built and published.
import { describe, expect, test } from 'vitest'
import { incidents } from '../incidents'
import { concepts } from './concepts'
import { linksIn, malformedLinks, type ContentLink } from './prose'
import { resources } from './resources'
import { terms } from './terms'

function resolves(ref: ContentLink): boolean {
  switch (ref.kind) {
    case 'concept':
      return concepts.some((c) => c.id === ref.id)
    case 'resource':
      return resources.some((r) => r.id === ref.id)
    case 'incident':
      return incidents.some((i) => i.id === ref.id)
  }
}

/** Every reference made anywhere in the content, with where it was made. */
function allRefs(): { from: string; ref: ContentLink }[] {
  const refs: { from: string; ref: ContentLink }[] = []
  for (const c of concepts) {
    for (const text of c.body) for (const ref of linksIn(text)) refs.push({ from: `concept ${c.id}`, ref })
  }
  for (const t of terms) if (t.concept) refs.push({ from: `term ${t.id}`, ref: { kind: 'concept', id: t.concept } })
  for (const i of incidents) {
    for (const id of i.links.concepts) refs.push({ from: `incident ${i.id}`, ref: { kind: 'concept', id } })
    for (const id of i.links.resources) refs.push({ from: `incident ${i.id}`, ref: { kind: 'resource', id } })
  }
  return refs
}

describe('content integrity', () => {
  test('every cross-reference resolves', () => {
    const broken = allRefs().filter(({ ref }) => !resolves(ref))
    expect(broken.map(({ from, ref }) => `${from} → ${ref.kind}:${ref.id}`)).toEqual([])
  })

  test('every piece of link markup parses, and summaries carry none', () => {
    const bad = concepts.flatMap((c) => [
      ...c.body.flatMap((text) => malformedLinks(text)).map((m) => `${c.id}: ${m}`),
      ...(c.summary.includes('](') ? [`${c.id}: summary has a link`] : []),
    ])
    expect(bad).toEqual([])
  })

  test('identifiers are unique within each kind', () => {
    for (const list of [concepts, resources]) {
      const ids = list.map((x) => x.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  test('every Resource is cited somewhere, and is a secure link with a reason to read it', () => {
    const cited = new Set(allRefs().flatMap(({ ref }) => (ref.kind === 'resource' ? [ref.id] : [])))
    for (const r of resources) {
      expect(cited.has(r.id), `${r.id} is never cited`).toBe(true)
      expect(r.url, r.id).toMatch(/^https:\/\//)
      expect(r.why.length, r.id).toBeGreaterThan(30)
    }
  })

  test('every Concept is practised by at least one Incident', () => {
    for (const c of concepts) {
      expect(incidents.some((i) => i.links.concepts.includes(c.id)), c.id).toBe(true)
    }
  })

  test('a broken reference is caught', () => {
    expect(resolves({ kind: 'concept', id: 'no-such-concept' })).toBe(false)
    expect(resolves({ kind: 'resource', id: 'no-such-resource' })).toBe(false)
    expect(resolves({ kind: 'incident', id: 'no-such-incident' })).toBe(false)
  })
})
