import { useId, useState } from 'react'
import { Annotated } from '../site/Term'
import { ExampleFrame } from './ExampleFrame'

// Minutes of checkout failure in Bad Deploy after the alert at 14:09. The run that saves the logs and
// then rolls back matches the Incident (harm stops at 14:15); the other two are illustrative.
const MAX_MINUTES = 40
/** Checkout had already been failing since the release at 14:02 when the alert fired. */
const BEFORE_ALERT_MINUTES = 7

const plans = [
  {
    id: 'investigate-first',
    label: 'Investigate first, then roll back',
    steps: ['read the logs', 'form hypotheses', 'find the Root Cause', 'roll back'],
    minutes: 30,
    evidenceKept: true,
    verdict: 'You found the Root Cause, but checkout failed for every minute you spent finding it.',
  },
  {
    id: 'rollback-now',
    label: 'Roll back straight away',
    steps: ['roll back'],
    minutes: 5,
    evidenceKept: false,
    verdict:
      'The harm stopped fast, but the logs went with the replaced pods. The revision history still names the release, but the error that explains why it failed is gone.',
  },
  {
    id: 'save-then-rollback',
    label: 'Save the logs, then roll back',
    steps: ['save the logs to a file', 'roll back', 'investigate from the saved file'],
    minutes: 6,
    evidenceKept: true,
    verdict: 'The right order. One extra command costs about a minute and keeps the Evidence for the investigation.',
  },
] as const

export function MitigateFirstExample() {
  const [chosen, setChosen] = useState<string>('investigate-first')
  const name = useId()
  const plan = plans.find((p) => p.id === chosen) ?? plans[0]
  return (
    <ExampleFrame title="Choose the order" instruction="Bad Deploy has just paged you. Pick a plan and see what it costs users and what it leaves you to work with.">
      <fieldset>
        <legend className="sr-only">Plan</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {plans.map((p) => (
            <label
              key={p.id}
              className={`cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
                p.id === chosen ? 'border-accent bg-accent/10' : 'border-line text-muted hover:border-muted hover:text-text'
              }`}
            >
              <input type="radio" name={name} value={p.id} checked={p.id === chosen} onChange={() => setChosen(p.id)} className="sr-only" />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div aria-live="polite" className="mt-4 space-y-3 text-sm">
        <ol className="flex flex-wrap items-center gap-1 font-mono text-xs text-muted">
          {plan.steps.map((s, i) => (
            <li key={s}>
              {i > 0 && <span aria-hidden>→ </span>}
              <span className="rounded bg-panel-2 px-1.5 py-0.5 text-text">{s}</span>
            </li>
          ))}
        </ol>
        <div>
          <p>
            Checkout failing for <strong className="font-mono">{plan.minutes} minutes</strong> after the alert
          </p>
          <p className="text-xs text-muted">On top of the {BEFORE_ALERT_MINUTES} minutes it had already failed before the alert fired.</p>
          <div className="mt-1 h-2 rounded-full bg-panel-2" aria-hidden>
            <div
              className="h-2 rounded-full bg-danger transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${(plan.minutes / MAX_MINUTES) * 100}%` }}
            />
          </div>
        </div>
        <p>
          Evidence:{' '}
          <strong className={plan.evidenceKept ? 'text-accent' : 'text-danger'}>{plan.evidenceKept ? 'kept' : 'lost'}</strong>
        </p>
        <p className="text-muted">
          <Annotated text={plan.verdict} />
        </p>
      </div>
    </ExampleFrame>
  )
}
