import { expect, test } from 'vitest'
import { incidents } from '../incidents'
import { annotate } from './annotate'
import { terms } from './terms'

test('every spelling belongs to exactly one term, and ids are unique', () => {
  const spellings = terms.flatMap((t) => t.matches)
  expect(new Set(spellings).size).toBe(spellings.length)
  expect(new Set(terms.map((t) => t.id)).size).toBe(terms.length)
})

test('every explanation is short enough for a tooltip', () => {
  for (const term of terms) {
    expect(term.explanation.length, term.id).toBeGreaterThan(20)
    expect(term.explanation.length, term.id).toBeLessThanOrEqual(240)
  }
})

test.each(incidents.map((i) => [i.title, i] as const))('the %s Expert Path explains every command it uses', (_title, incident) => {
  for (const step of incident.expertPath) {
    const first = annotate(step.command, terms)[0]
    expect(typeof first === 'string' ? undefined : first?.term.id, step.command).toBeDefined()
  }
})
