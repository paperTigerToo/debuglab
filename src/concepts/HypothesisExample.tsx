import { useState } from 'react'
import { Annotated } from '../site/Term'
import { ExampleFrame } from './ExampleFrame'

const hypotheses = [
  {
    id: 'payments',
    claim: 'The payments service is down.',
    prediction: 'Requests to payments would time out or be refused.',
    check: 'kubectl logs deployment/pantry-api --tail=20',
    result: 'TypeError: Invalid URL, input "undefined/v1/charges". The request was never sent.',
    supported: false,
  },
  {
    id: 'database',
    claim: 'PostgreSQL is overloaded.',
    prediction: 'Every database-backed request would be slow, and checkout would fail with timeouts.',
    check: 'The latency graph and the access log on the dashboard',
    result: 'Latency is flat. Checkout fails in 3 to 6 ms, while other database-backed requests succeed.',
    supported: false,
  },
  {
    id: 'release',
    claim: 'The v2.14.0 release broke checkout.',
    prediction: 'The errors would begin when the release rolled out, and the pods would be new.',
    check: 'kubectl rollout history deployment/pantry-api',
    result: 'Revision 42, change-cause release v2.14.0. The dashboard dates that deploy to 14:02, the minute the errors began.',
    supported: true,
  },
] as const

export function HypothesisExample() {
  const [checked, setChecked] = useState<readonly string[]>([])
  const ruledOut = hypotheses.filter((h) => checked.includes(h.id) && !h.supported).length
  return (
    <ExampleFrame
      title="Test three hypotheses"
      instruction="Checkout has failed with 500s since 14:02. For each guess, read what it predicts, then run the check and let the output decide."
    >
      <ul className="space-y-3">
        {hypotheses.map((h) => {
          const done = checked.includes(h.id)
          return (
            <li key={h.id} className="rounded-md border border-line p-3 text-sm">
              <p className="font-medium">
                <Annotated text={h.claim} />
              </p>
              <p className="mt-1 text-muted">
                If so: <Annotated text={h.prediction} />
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-xs">{h.check}</code>
                {!done && (
                  <button
                    type="button"
                    onClick={() => setChecked((c) => [...c, h.id])}
                    className="rounded border border-line px-2 py-0.5 text-xs text-muted hover:border-accent hover:text-text"
                    aria-label={`Run the check for: ${h.claim}`}
                  >
                    Run the check
                  </button>
                )}
              </div>
              {done && (
                <p className="mt-2 border-l-2 pl-3" style={{ borderColor: h.supported ? 'var(--accent)' : 'var(--danger)' }}>
                  <span className="font-mono text-xs">{h.result}</span>
                  <span className={`mt-1 block font-medium ${h.supported ? 'text-accent' : 'text-danger'}`}>
                    {h.supported ? 'Supported: narrow down from here.' : 'Ruled out.'}
                  </span>
                </p>
              )}
            </li>
          )
        })}
      </ul>
      <p aria-live="polite" className="mt-3 text-sm text-muted">
        {checked.length === 0
          ? 'No hypothesis tested yet.'
          : `${ruledOut} ruled out, ${checked.length - ruledOut} supported, ${hypotheses.length - checked.length} left to test.`}
      </p>
    </ExampleFrame>
  )
}
