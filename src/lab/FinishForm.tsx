import { useState, type FormEvent } from 'react'
import type { IncidentDefinition } from '../engine/types'

/** Commit to a conclusion: the Root Cause, and the Mitigation the Learner would apply. */
export function FinishForm({
  incident,
  onFinish,
}: {
  incident: IncidentDefinition
  onFinish: (rootCause: string, mitigation: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [rootCause, setRootCause] = useState<string>()
  const [mitigation, setMitigation] = useState<string>()

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-accent/60 bg-accent/10 px-4 py-3 text-sm font-medium text-text hover:bg-accent/20"
      >
        I know the Root Cause: finish the Incident
      </button>
    )
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (rootCause && mitigation) onFinish(rootCause, mitigation)
  }

  return (
    <form onSubmit={submit} aria-label="Finish the Incident" className="space-y-4 rounded-lg border border-line bg-panel p-4">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">What is the Root Cause?</legend>
        {incident.rootCauses.map((c) => (
          <label key={c.id} className="flex gap-2 text-sm">
            <input type="radio" name="root-cause" value={c.id} onChange={() => setRootCause(c.id)} className="mt-1 accent-[var(--accent)]" />
            <span>{c.label}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Which Mitigation would you apply first?</legend>
        {incident.mitigations.map((m) => (
          <label key={m.id} className="flex gap-2 text-sm">
            <input type="radio" name="mitigation" value={m.id} onChange={() => setMitigation(m.id)} className="mt-1 accent-[var(--accent)]" />
            <span>{m.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!rootCause || !mitigation}
          className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-bg disabled:opacity-40"
        >
          Finish and see the Debrief
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border border-line px-3 py-1.5 text-sm text-muted">
          Keep investigating
        </button>
      </div>
    </form>
  )
}
