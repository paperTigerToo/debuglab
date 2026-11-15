// The Debrief: everything shown when an Incident ends, derived from the session and the definition.
import { goalReached, hintsUsed } from './hints'
import { canonical, splitPipes, splitRedirect } from './normalise'
import { dashboard, evidenceStatus, harmStopped } from './session'
import type { IncidentDefinition, MitigationOption, Postmortem, SessionState, TimelineEntry } from './types'

export type Debrief = {
  rootCause: {
    correct: boolean
    chosen: string
    /** The correct Root Cause. */
    actual: string
    /** For a wrong answer: the Findings that rule it out, and whether the Learner had reached them. */
    contradictions: { why: string; finding: string; reached: boolean }[]
  }
  harm: {
    /** Whether the alert had resolved when the Learner finished: harm actually stopped, not just planned. */
    stopped: boolean
    summary: string
    /** The Mitigation the Learner chose, with how good a choice it is. */
    mitigation: MitigationOption
  }
  /** Every command the Learner gave, in order. */
  timeline: TimelineEntry[]
  expertPath: { command: string; why: string; covered: boolean }[]
  evidence: { captured: string[]; lost: string[] }
  findings: { reached: string[]; missed: string[] }
  hintsUsed: number
  postmortem: Postmortem
  prevention: readonly string[]
}

/** The Debrief for a finished session. Throws if the session has no outcome. */
export function debrief(definition: IncidentDefinition, state: SessionState): Debrief {
  if (!state.outcome) throw new Error('The Incident has not been finished.')
  const chosen = definition.rootCauses.find((c) => c.id === state.outcome!.rootCause)!
  const actual = definition.rootCauses.find((c) => c.correct)!
  const mitigation = definition.mitigations.find((m) => m.id === state.outcome!.mitigation)!
  const summary = (id: string) => definition.findings[id]?.summary ?? id
  const findingIds = Object.keys(definition.findings)
  const { captured, lost } = evidenceStatus(state)
  const evidenceSummary = (id: string) => definition.evidence[id]?.summary ?? id

  const ran = state.timeline.filter((t) => t.result === 'ran').map((t) => commandKey(definition, t.text))
  // A step is covered by what it achieves when that can be judged, so other spellings count and late ones do not.
  const expertPath = definition.expertPath.map((step) => {
    const covered =
      step.reaches && step.reaches.length > 0
        ? step.reaches.every((f) => state.findings.includes(f))
        : step.achieves
          ? goalReached(step.achieves, state)
          : ran.includes(commandKey(definition, step.command))
    return { command: step.command, why: step.why, covered }
  })

  return {
    rootCause: {
      correct: chosen.correct === true,
      chosen: chosen.label,
      actual: actual.label,
      contradictions: (chosen.contradictedBy ?? []).map((c) => ({
        why: c.why,
        finding: summary(c.finding),
        reached: state.findings.includes(c.finding),
      })),
    },
    harm: { stopped: harmStopped(definition, state), summary: dashboard(definition, state).alert.summary, mitigation },
    timeline: [...state.timeline],
    expertPath,
    evidence: { captured: captured.map(evidenceSummary), lost: lost.map(evidenceSummary) },
    findings: {
      reached: findingIds.filter((f) => state.findings.includes(f)).map(summary),
      missed: findingIds.filter((f) => !state.findings.includes(f)).map(summary),
    },
    hintsUsed: hintsUsed(state),
    postmortem: definition.postmortem,
    prevention: definition.prevention,
  }
}

/** Two commands match when every pipe stage means the same thing; a saved file's name does not matter. */
function commandKey(definition: IncidentDefinition, text: string): string {
  const { command, file } = splitRedirect(text)
  const stages = splitPipes(command).map((stage) => canonical(stage, definition.namespace))
  return stages.join(' | ') + (file ? ' > FILE' : '')
}
