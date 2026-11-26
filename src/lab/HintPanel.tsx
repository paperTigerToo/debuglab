import { Link } from 'react-router'
import { entryById } from '../content/playbook'
import type { HintView } from '../engine/engine'
import { playbookPath } from '../site/paths'
import { Annotated } from '../site/Term'

const tierNames = ['Ask for a Hint', 'Show the Playbook Entry', 'Show the exact command']

/** Three-tier help for the Learner's next step. */
export function HintPanel({ hint, onReveal }: { hint: HintView | undefined; onReveal: () => void }) {
  return (
    <aside aria-label="Hint" className="rounded-lg border border-line bg-panel p-4">
      <h2 className="font-mono text-xs uppercase tracking-widest text-muted">Hint</h2>
      {!hint ? (
        <p className="mt-3 text-sm text-muted">
          You have everything you need. Declare the Root Cause and the Mitigation you chose.
        </p>
      ) : (
        <>
          <dl className="mt-3 space-y-2 text-sm" aria-live="polite">
            {hint.question && (
              <div className="animate-rise">
                <dt className="sr-only">Question</dt>
                <dd>
                  <Annotated text={hint.question} />
                </dd>
              </div>
            )}
            {hint.playbook && (
              <div className="animate-rise">
                <dt className="font-mono text-xs text-muted">Playbook Entry</dt>
                <dd>
                  <Link to={playbookPath(hint.playbook)} target="_blank" className="text-accent underline decoration-accent/40 underline-offset-[3px] hover:decoration-accent">
                    {entryById(hint.playbook)?.question ?? hint.playbook}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </Link>
                </dd>
              </div>
            )}
            {hint.command && (
              <div className="animate-rise">
                <dt className="font-mono text-xs text-muted">Command</dt>
                <dd>
                  <code className="block whitespace-pre-wrap rounded bg-bg px-2 py-1 font-mono text-xs [overflow-wrap:anywhere]">
                    <Annotated text={hint.command} />
                  </code>
                </dd>
              </div>
            )}
          </dl>
          {hint.tier < tierNames.length && (
            <button
              type="button"
              onClick={onReveal}
              className="mt-3 rounded border border-line px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-text"
            >
              {tierNames[hint.tier]}
            </button>
          )}
        </>
      )}
    </aside>
  )
}
