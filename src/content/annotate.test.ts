import { describe, expect, test } from 'vitest'
import { annotate, type Segment } from './annotate'
import type { Term } from './terms'

const terms: Term[] = [
  { id: 'kubectl', matches: ['kubectl'], explanation: 'The Kubernetes command-line tool.' },
  { id: 'pod', matches: ['pod', 'pods', 'Pod'], explanation: 'The smallest unit Kubernetes runs.' },
  { id: 'rollout-undo', matches: ['rollout undo'], explanation: 'Return a Deployment to its previous revision.' },
  { id: 'rollout', matches: ['rollout'], explanation: 'The process of replacing pods with a new version.' },
  { id: 'flag-tail', matches: ['--tail'], explanation: 'Show only the last N lines.' },
  { id: 'flag-n', matches: ['-n'], explanation: 'The namespace to look in.' },
  { id: 'status-500', matches: ['500'], explanation: 'Internal Server Error.' },
]

/** Show which words became terms, as "[text|id]". */
const marked = (segments: Segment[]) =>
  segments.map((s) => (typeof s === 'string' ? s : `[${s.text}|${s.term.id}]`)).join('')

describe('annotate', () => {
  test('marks terms in prose and leaves the rest as text', () => {
    expect(marked(annotate('Every pod is running.', terms))).toBe('Every [pod|pod] is running.')
  })

  test('marks commands and flags inside a command line', () => {
    expect(marked(annotate('kubectl logs deploy/api --tail=20 -n shop', terms))).toBe(
      '[kubectl|kubectl] logs deploy/api [--tail|flag-tail]=20 [-n|flag-n] shop',
    )
  })

  test('prefers the longest match', () => {
    expect(marked(annotate('kubectl rollout undo deployment/api', terms))).toBe(
      '[kubectl|kubectl] [rollout undo|rollout-undo] deployment/api',
    )
  })

  test('only matches whole words, so a term inside another word is left alone', () => {
    expect(marked(annotate('podcast re-n 5000 kubectlx', terms))).toBe('podcast re-n 5000 kubectlx')
  })

  test('marks a term once per block, so output is not covered in underlines', () => {
    expect(marked(annotate('pod a\npod b\n"status":500 and 500', terms))).toBe('[pod|pod] a\npod b\n"status":[500|status-500] and 500')
  })

  test('a term inside a name, path or address is left alone', () => {
    // The resource type before the slash is still a term; the name after it is not.
    expect(marked(annotate('pod/pod-7c9d kubectl-x x/kubectl', terms))).toBe('[pod|pod]/pod-7c9d kubectl-x x/kubectl')
  })

  test('texts can share what was already marked, so a terminal log marks each term once', () => {
    const seen = new Set<string>()
    expect(marked(annotate('pod a', terms, seen))).toBe('[pod|pod] a')
    expect(marked(annotate('pod b and kubectl', terms, seen))).toBe('pod b and [kubectl|kubectl]')
  })

  test('different spellings of one term count as the same term', () => {
    expect(marked(annotate('Pod and pods', terms))).toBe('[Pod|pod] and pods')
  })

  test('text with no terms is one plain segment', () => {
    expect(annotate('nothing here', terms)).toEqual(['nothing here'])
  })
})
