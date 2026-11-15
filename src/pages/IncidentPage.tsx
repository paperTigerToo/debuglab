import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { currentHint, dashboard, debrief, evidenceStatus, start, step } from '../engine/engine'
import type { IncidentDefinition, SessionState } from '../engine/types'
import { findIncident } from '../incidents'
import { AlertPanel, Dashboard } from '../lab/Dashboard'
import { DebriefView } from '../lab/DebriefView'
import { FinishForm } from '../lab/FinishForm'
import { HintPanel } from '../lab/HintPanel'
import { Terminal } from '../lab/Terminal'
import { useProgress } from '../site/progress'
import { NotFoundPage } from './NotFoundPage'

export function IncidentPage() {
  const { incidentId = '' } = useParams()
  const incident = findIncident(incidentId)
  if (!incident) return <NotFoundPage />
  return <IncidentWorkspace key={incident.id} incident={incident} />
}

function IncidentWorkspace({ incident }: { incident: IncidentDefinition }) {
  const [state, setState] = useState(() => start(incident))
  // Changing the run remounts the terminal, clearing its scrollback and history.
  const [run, setRun] = useState(0)
  const { record } = useProgress()
  const data = dashboard(incident, state)

  function restart() {
    setState(start(incident))
    setRun((r) => r + 1)
  }

  function finish(rootCause: string, mitigation: string) {
    const next = step(incident, state, { kind: 'finish', rootCause, mitigation }).state
    setState(next)
    record(incident.id, debrief(incident, next))
    window.scrollTo({ top: 0 })
  }

  const heading = (
    <div className="flex flex-wrap items-end gap-4">
      <div>
        <Link to="/lab" className="text-sm text-muted hover:text-text">
          ← All Incidents
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {incident.title}
          {state.outcome && <span className="text-muted">: Debrief</span>}
        </h1>
      </div>
      <RestartButton onRestart={restart} />
    </div>
  )

  if (state.outcome) {
    return (
      <div className="space-y-6">
        {heading}
        <DebriefView debrief={debrief(incident, state)} />
        <Link to="/lab" className="inline-block rounded border border-line px-3 py-1.5 text-sm text-muted hover:text-text">
          Back to all Incidents
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {heading}
      <AlertPanel alert={incident.alert} status={data.alert} />
      <p className="max-w-3xl text-sm text-muted">{incident.briefing}</p>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Dashboard data={data} />
        <div className="space-y-4">
          <Terminal key={run} incident={incident} state={state} onState={setState} />
          <HintPanel
            hint={currentHint(incident, state)}
            onReveal={() => setState((s) => step(incident, s, { kind: 'hint' }).state)}
          />
          <Progress incident={incident} state={state} />
          <FinishForm incident={incident} onFinish={finish} />
        </div>
      </div>
    </div>
  )
}

function RestartButton({ onRestart }: { onRestart: () => void }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="ml-auto rounded border border-line px-3 py-1.5 text-sm text-muted hover:text-text"
      >
        Restart Incident
      </button>
    )
  }
  return (
    <div role="group" aria-label="Confirm restart" className="ml-auto flex items-center gap-2 text-sm">
      <span className="text-muted">Start over from the alert?</span>
      <button
        type="button"
        onClick={() => {
          setAsking(false)
          onRestart()
        }}
        className="rounded bg-danger px-3 py-1.5 font-medium text-bg"
      >
        Restart
      </button>
      <button type="button" onClick={() => setAsking(false)} className="rounded border border-line px-3 py-1.5 text-muted">
        Keep going
      </button>
    </div>
  )
}

function Progress({ incident, state }: { incident: IncidentDefinition; state: SessionState }) {
  const findingIds = Object.keys(incident.findings)
  const { captured, lost } = evidenceStatus(state)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
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
      <aside aria-label="Evidence" className="rounded-lg border border-line bg-panel p-4">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted">Evidence</h2>
        {state.files.length === 0 && lost.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nothing saved. Output redirected to a file (<code className="font-mono">&gt; name.log</code>) survives
            whatever you change next.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {state.files.map((f) => (
              <li key={f.name} className="font-mono text-xs">
                <span className="text-accent">saved</span> {f.name}
                {f.evidence && captured.includes(f.evidence) && (
                  <span className="block font-sans text-muted">{incident.evidence[f.evidence]?.summary}</span>
                )}
              </li>
            ))}
            {lost.map((e) => (
              <li key={e} className="border-l-2 border-danger pl-3">
                <span className="font-mono text-xs text-danger">lost</span> {incident.evidence[e]?.summary}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}
