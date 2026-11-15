import { Link } from 'react-router'
import { incidents } from '../incidents'
import { PageHeading } from './Placeholder'

export function IncidentLabPage() {
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
              <span className="font-mono text-xs text-muted">
                difficulty {incident.difficulty} of 5
              </span>
              <span className="mt-1 block text-lg font-medium group-hover:text-accent">{incident.title}</span>
              <span className="mt-2 block font-mono text-xs text-danger">{incident.alert.name}</span>
              <span className="mt-1 block text-sm text-muted">{incident.alert.summary}</span>
            </Link>
          </li>
        ))}
      </ol>
    </>
  )
}
