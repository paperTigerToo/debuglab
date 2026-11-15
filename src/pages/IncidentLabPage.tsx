import { useState } from 'react'
import { Link } from 'react-router'
import { incidents } from '../incidents'
import { isComplete, useProgress, type IncidentRecord } from '../site/progress'
import { PageHeading } from './Placeholder'

export function IncidentLabPage() {
  const { records, reset } = useProgress()
  const anyDone = Object.keys(records).length > 0
  return (
    <>
      <PageHeading title="Incident Lab">
        Work a simulated Incident from the alert that pages you to its Root Cause. Incidents are ordered easy to hard.
      </PageHeading>
      <ol className="grid gap-4 sm:grid-cols-2">
        {incidents.map((incident) => (
          <li key={incident.id}>
            <Link
              to={`/lab/${incident.id}`}
              className="group block h-full rounded-lg border border-line bg-panel p-5 transition-colors hover:border-accent"
            >
              <span className="flex items-baseline justify-between gap-2 font-mono text-xs text-muted">
                difficulty {incident.difficulty} of 5
                <Completion record={records[incident.id]} />
              </span>
              <span className="mt-1 block text-lg font-medium group-hover:text-accent">{incident.title}</span>
              <span className="mt-2 block font-mono text-xs text-danger">{incident.alert.name}</span>
              <span className="mt-1 block text-sm text-muted">{incident.alert.summary}</span>
            </Link>
          </li>
        ))}
      </ol>
      {anyDone && <ResetProgress onReset={reset} />}
    </>
  )
}

function Completion({ record }: { record: IncidentRecord | undefined }) {
  if (!record) return <span>not attempted</span>
  const completed = isComplete(record)
  return (
    <span className={completed ? 'text-accent' : 'text-warn'} aria-label={completed ? 'completed' : 'attempted'}>
      {completed ? '✓ completed' : '◐ attempted'}
      <span className="sr-only">
        {`: Root Cause ${record.rootCauseFound ? 'found' : 'not found'}, harm ${record.harmStopped ? 'stopped' : 'not stopped'}, ${record.hintsUsed} Hints used`}
      </span>
    </span>
  )
}

function ResetProgress({ onReset }: { onReset: () => void }) {
  const [asking, setAsking] = useState(false)
  return (
    <div className="mt-8 flex items-center gap-2 text-sm text-muted">
      {asking ? (
        <>
          <span>Forget every completed Incident in this browser?</span>
          <button
            type="button"
            onClick={() => {
              onReset()
              setAsking(false)
            }}
            className="rounded bg-danger px-3 py-1.5 font-medium text-bg"
          >
            Reset progress
          </button>
          <button type="button" onClick={() => setAsking(false)} className="rounded border border-line px-3 py-1.5">
            Keep it
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="rounded border border-line px-3 py-1.5 hover:text-text">
          Reset progress
        </button>
      )}
    </div>
  )
}
