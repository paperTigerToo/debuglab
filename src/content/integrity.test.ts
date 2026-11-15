// Every cross-reference between Concepts, Playbook Entries, Resources, Incidents and terms must resolve, so content
// cannot rot silently. CI runs this before the site is built and published.
import { describe, expect, test } from 'vitest'
import { incidents, incidentsUsing } from '../incidents'
import { concepts } from './concepts'
import { playbook } from './playbook'
import { linksIn, malformedLinks, type ContentLink } from './prose'
import { resources } from './resources'
import { terms } from './terms'

function resolves(ref: ContentLink): boolean {
  switch (ref.kind) {
    case 'concept':
      return concepts.some((c) => c.id === ref.id)
    case 'playbook':
      return playbook.some((e) => e.id === ref.id)
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
  for (const e of playbook) {
    for (const f of e.followOn) for (const ref of linksIn(f.then)) refs.push({ from: `playbook ${e.id}`, ref })
    for (const id of e.links.concepts) refs.push({ from: `playbook ${e.id}`, ref: { kind: 'concept', id } })
    for (const id of e.links.resources) refs.push({ from: `playbook ${e.id}`, ref: { kind: 'resource', id } })
  }
  for (const t of terms) {
    if (t.concept) refs.push({ from: `term ${t.id}`, ref: { kind: 'concept', id: t.concept } })
    if (t.playbook) refs.push({ from: `term ${t.id}`, ref: { kind: 'playbook', id: t.playbook } })
  }
  for (const i of incidents) {
    for (const id of i.links.concepts) refs.push({ from: `incident ${i.id}`, ref: { kind: 'concept', id } })
    for (const id of i.links.resources) refs.push({ from: `incident ${i.id}`, ref: { kind: 'resource', id } })
    for (const h of i.hints) refs.push({ from: `incident ${i.id} hint`, ref: { kind: 'playbook', id: h.playbook } })
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
    for (const e of playbook) {
      bad.push(...e.followOn.flatMap((f) => malformedLinks(f.then)).map((m) => `${e.id}: ${m}`))
      if (e.summary.includes('](')) bad.push(`${e.id}: summary has a link`)
    }
    expect(bad).toEqual([])
  })

  test('identifiers are unique within each kind', () => {
    for (const list of [concepts, playbook, resources]) {
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

  test('every Concept links to a Playbook Entry that puts it into practice', () => {
    for (const c of concepts) {
      expect(c.body.some((text) => linksIn(text).some((l) => l.kind === 'playbook')), c.id).toBe(true)
    }
  })

  test('every Playbook Entry is used by an Incident, and its notes point at text in its output', () => {
    for (const e of playbook) {
      expect(incidentsUsing(e.id), `${e.id} is used by no Incident`).not.toEqual([])
      for (const sample of [e.healthy, e.unhealthy]) {
        for (const { mark } of sample.notes) expect(sample.output, `${e.id}: ${mark}`).toContain(mark)
      }
    }
  })

  test('a term links to at most one deeper page', () => {
    expect(terms.filter((t) => t.concept && t.playbook).map((t) => t.id)).toEqual([])
  })

  test('a broken reference is caught', () => {
    expect(resolves({ kind: 'concept', id: 'no-such-concept' })).toBe(false)
    expect(resolves({ kind: 'resource', id: 'no-such-resource' })).toBe(false)
    expect(resolves({ kind: 'incident', id: 'no-such-incident' })).toBe(false)
    expect(resolves({ kind: 'playbook', id: 'no-such-entry' })).toBe(false)
  })
})
