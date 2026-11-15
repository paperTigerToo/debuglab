import { expect, test } from 'vitest'
import { badDeploy } from '../incidents/bad-deploy'
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

test('the Bad Deploy Expert Path explains every command it uses', () => {
  for (const step of badDeploy.expertPath) {
    const first = annotate(step.command, terms)[0]
    expect(typeof first === 'string' ? undefined : first?.term.id, step.command).toBeDefined()
  }
})
