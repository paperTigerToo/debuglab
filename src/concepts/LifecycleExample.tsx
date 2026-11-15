import { useState } from 'react'
import { Annotated } from '../site/Term'
import { ExampleFrame } from './ExampleFrame'

const stages = [
  {
    name: 'Detect',
    what: 'Notice that something is wrong: an alert fires, a customer reports it, or a graph looks wrong.',
    badDeploy: 'The alert PantryApiHighErrorRate fires: pantry-api is returning server errors on about 9% of requests.',
    done: 'Someone has acknowledged it and owns the response.',
  },
  {
    name: 'Triage',
    what: 'Decide how bad it is: who is affected, since when, and whether it is getting worse.',
    badDeploy: 'Checkout fails, other pages work, and the errors began at 14:02, right after release v2.14.0.',
    done: 'You know the impact and whether to call for help.',
  },
  {
    name: 'Mitigate',
    what: 'Stop the harm, without needing to know why it happened. Save the Evidence the Mitigation would destroy first.',
    badDeploy: 'Save the pantry-api logs to a file, then roll back to v2.13.1.',
    done: 'The error rate is back to normal and the alert resolves.',
  },
  {
    name: 'Investigate',
    what: 'Find the Root Cause by testing hypotheses against the Evidence.',
    badDeploy: 'The saved logs show the payments address is "undefined"; revision 42 still sets the old name, PAYMENT_SERVICE_URL.',
    done: 'You can name the Root Cause and the Evidence supports it.',
  },
  {
    name: 'Resolve',
    what: 'Fix the Root Cause properly, through the normal review and release process.',
    badDeploy: 'Set PAYMENTS_URL in the Deployment and release a fixed version through the usual pipeline.',
    done: 'The fixed version is live and healthy.',
  },
  {
    name: 'Review',
    what: 'Write a blameless postmortem: what happened, why, and what will change.',
    badDeploy: 'Action items include validating configuration at startup, so a missing key stops the rollout.',
    done: 'Every action item has an owner and a date.',
  },
] as const

export function LifecycleExample() {
  const [current, setCurrent] = useState(0)
  const stage = stages[current]!
  return (
    <ExampleFrame title="Walk through the six stages" instruction="Choose a stage to see what you do in it and how it played out in Bad Deploy.">
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {stages.map((s, i) => (
          <li key={s.name}>
            <button
              type="button"
              aria-pressed={i === current}
              onClick={() => setCurrent(i)}
              className={`w-full rounded-md border px-2 py-2 text-left text-sm transition-colors ${
                i === current ? 'border-accent bg-accent/10 text-text' : 'border-line text-muted hover:border-muted hover:text-text'
              }`}
            >
              <span className="block font-mono text-[10px]">{i + 1}</span>
              {s.name}
            </button>
          </li>
        ))}
      </ol>
      <div aria-live="polite" className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted">{stage.name}: what you do</h3>
          <p className="mt-1">
            <Annotated text={stage.what} />
          </p>
        </div>
        <div>
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted">In Bad Deploy</h3>
          <p className="mt-1">
            <Annotated text={stage.badDeploy} />
          </p>
        </div>
        <div>
          <h3 className="font-mono text-xs uppercase tracking-widest text-muted">Done when</h3>
          <p className="mt-1">{stage.done}</p>
        </div>
      </div>
    </ExampleFrame>
  )
}
