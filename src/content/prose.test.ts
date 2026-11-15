import { expect, test } from 'vitest'
import { malformedLinks, parseProse } from './prose'

test('plain text is one part', () => {
  expect(parseProse('Stop the harm first.')).toEqual(['Stop the harm first.'])
})

test('links name what they point at by kind and identifier', () => {
  expect(parseProse('Read [the SRE book](resource:sre-troubleshooting), then try [Bad Deploy](incident:bad-deploy).')).toEqual([
    'Read ',
    { text: 'the SRE book', to: { kind: 'resource', id: 'sre-troubleshooting' } },
    ', then try ',
    { text: 'Bad Deploy', to: { kind: 'incident', id: 'bad-deploy' } },
    '.',
  ])
})

test('brackets that are not a link stay as text', () => {
  expect(parseProse('[y/N] and [x](https://example.com)')).toEqual(['[y/N] and [x](https://example.com)'])
})

test('link markup that does not parse is reported, so a typo cannot pass as text', () => {
  expect(malformedLinks('See [Logging](resourse:k8s-logging) and [Bad Deploy](incident:bad-deploy).')).toEqual([
    '[Logging](resourse:k8s-logging)',
  ])
  expect(malformedLinks('A [y/N] prompt is fine.')).toEqual([])
})
