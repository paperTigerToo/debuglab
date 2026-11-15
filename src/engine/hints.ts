// Hints: graduated help towards the first goal of the investigation not yet reached.
import { evidenceStatus } from './session'
import type { Hint, HintGoal, IncidentDefinition, SessionState } from './types'

type AnyHint = Hint<string, string, string>

/** The Hint to show now, with as many tiers as the Learner has revealed; undefined when every goal is met. */
export type HintView = {
  index: number
  /** 0 to 3: nothing yet, the question, the Playbook Entry, the exact command. */
  tier: number
  question?: string
  playbook?: string
  command?: string
}

export const MAX_TIER = 3

/** Whether the session has reached a goal: a Finding, captured evidence, or a named state. */
export function goalReached(goal: HintGoal<string, string, string>, state: SessionState): boolean {
  if ('finding' in goal) return state.findings.includes(goal.finding)
  if ('captured' in goal) return evidenceStatus(state).captured.includes(goal.captured)
  return state.namedState === goal.state
}

/** A Hint whose goal can no longer be reached because the evidence it needs was destroyed first. */
function unreachable(hint: AnyHint, state: SessionState): boolean {
  const { lost } = evidenceStatus(state)
  if (hint.needs && lost.includes(hint.needs.evidence)) return true
  return 'captured' in hint.goal && lost.includes(hint.goal.captured)
}

export function currentHintIndex(definition: IncidentDefinition, state: SessionState): number | undefined {
  const index = definition.hints.findIndex((h) => !goalReached(h.goal, state) && !unreachable(h, state))
  return index === -1 ? undefined : index
}

export function currentHint(definition: IncidentDefinition, state: SessionState): HintView | undefined {
  const index = currentHintIndex(definition, state)
  if (index === undefined) return undefined
  const hint = definition.hints[index]!
  const tier = state.hintTiers[index] ?? 0
  return {
    index,
    tier,
    ...(tier >= 1 && { question: hint.question }),
    ...(tier >= 2 && { playbook: hint.playbook }),
    ...(tier >= 3 && { command: hint.command }),
  }
}

/** Reveal the next tier of the current Hint. */
export function revealHint(definition: IncidentDefinition, state: SessionState): SessionState {
  const index = currentHintIndex(definition, state)
  if (index === undefined) return state
  const tier = Math.min(MAX_TIER, (state.hintTiers[index] ?? 0) + 1)
  return { ...state, hintTiers: { ...state.hintTiers, [index]: tier } }
}

export function hintsUsed(state: SessionState): number {
  return Object.values(state.hintTiers).reduce((sum, tier) => sum + tier, 0)
}
