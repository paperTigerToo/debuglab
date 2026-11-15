import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { start } from '../engine/engine'
import type { IncidentDefinition } from '../engine/types'
import { findIncident } from '../incidents'
import { Terminal } from '../lab/Terminal'
import { NotFoundPage } from './NotFoundPage'

export function IncidentPage() {
  const { incidentId = '' } = useParams()
  const incident = findIncident(incidentId)
  if (!incident) return <NotFoundPage />
  return <IncidentWorkspace key={incident.id} incident={incident} />
}

function IncidentWorkspace({ incident }: { incident: IncidentDefinition }) {
  const [state, setState] = useState(() => start(incident))
  const findingIds = Object.keys(incident.findings)

  return (
    <div className="space-y-6">
      <div>
        <Link to="/lab" className="text-sm text-muted hover:text-text">
          ← All Incidents
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{incident.title}</h1>
      </div>

      <section
        aria-label="Alert"
        className="rounded-lg border border-danger/50 bg-danger/10 p-4"
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="rounded bg-danger px-2 py-0.5 font-mono text-xs font-semibold uppercase text-bg">
            firing
          </span>
          <span className="font-mono text-sm font-semibold">{incident.alert.name}</span>
          <span className="font-mono text-xs text-muted">since {incident.alert.startedAt}</span>
        </div>
        <p className="mt-2 text-sm">{incident.alert.summary}</p>
        <p className="mt-1 font-mono text-xs text-muted">condition: {incident.alert.condition}</p>
      </section>

      <p className="max-w-3xl text-sm text-muted">{incident.briefing}</p>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <Terminal incident={incident} state={state} onState={setState} />
        <aside aria-label="Findings" className="rounded-lg border border-line bg-panel p-4">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted">
            Findings {state.findings.length} of {findingIds.length}
          </h2>
          {state.findings.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nothing established yet. Each key fact you uncover is noted here.</p>
          ) : (
            <ol className="mt-3 space-y-3 text-sm">
              {state.findings.map((id) => (
                <li key={id} className="border-l-2 border-accent pl-3">
                  {incident.findings[id]?.summary}
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  )
}
