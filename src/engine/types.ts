// The shape of an Incident definition and of a Learner's session.
// Definitions are plain typed data; the engine reads them and never the other way round.

export type CommandEntry<S extends string, F extends string> = {
  /** Every spelling that should run this entry. Variations in spacing, flag order and flag form are normalised away. */
  match: readonly string[]
  /** One output for every named state, or one per named state. */
  output: string | Partial<Record<S, string>>
  /**
   * Key findings the Learner reaches by running this command. A finding with `seenIn` is reached only
   * when that text is still in the output after --tail and pipes, so it must actually be on screen.
   */
  reveals?: readonly (F | { finding: F; seenIn: string })[]
}

export type Alert = {
  name: string
  severity: 'page' | 'ticket'
  condition: string
  startedAt: string
  summary: string
}

export type ExpertStep<F extends string> = {
  command: string
  why: string
  reaches?: readonly F[]
}

export type IncidentDefinition<S extends string = string, F extends string = string> = {
  id: string
  title: string
  difficulty: 1 | 2 | 3 | 4 | 5
  /** The kube namespace the Learner's context points at; `-n <namespace>` is optional. */
  namespace: string
  alert: Alert
  briefing: string
  states: readonly S[]
  initialState: NoInfer<S>
  findings: Record<F, { summary: string }>
  commands: readonly CommandEntry<NoInfer<S>, NoInfer<F>>[]
  /** Resource names offered by tab completion in addition to words in the scripted commands. */
  completions: readonly string[]
  expertPath: readonly ExpertStep<NoInfer<F>>[]
}

export type Location = { kind: 'local' }

export type TimelineEntry = {
  text: string
  result: 'ran' | 'not-simulated' | 'unknown' | 'builtin'
}

export type SessionState = {
  namedState: string
  location: Location
  timeline: readonly TimelineEntry[]
  findings: readonly string[]
}

export type Input = { kind: 'command'; text: string }

export type Line =
  | { kind: 'input'; prompt: string; text: string }
  | { kind: 'output'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'notice'; text: string }

export type StepResult = {
  state: SessionState
  display: readonly Line[]
  /** The terminal should clear its scrollback before showing `display`. */
  clear?: boolean
}

export type Completion = {
  /** The input with the current word completed as far as it is unambiguous. */
  text: string
  /** Every candidate when more than one remains, for listing. */
  options: readonly string[]
}

export function defineIncident<const S extends string, const F extends string>(
  definition: IncidentDefinition<S, F>,
): IncidentDefinition<S, F> {
  return definition
}
