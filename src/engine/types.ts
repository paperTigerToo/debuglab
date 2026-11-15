// The shape of an Incident definition and of a Learner's session.
// Definitions are plain typed data; the engine reads them and never the other way round.

/** One value for every named state, or one per named state. A state left out has no value. */
export type PerState<S extends string, T> = T | Partial<Record<S, T>>

/** A command that changes the Target System. It runs only after the Learner confirms. */
export type Mutation<S extends string, E extends string> = {
  /** Shown before asking for confirmation: what this will do. */
  warning: string
  /** The named state the Incident moves to. */
  to: S
  /** Evidence this destroys; whatever was not captured first is lost. */
  destroys?: readonly E[]
  /** Shown after it runs: what happened to the Target System. */
  consequence: string
}

export type CommandEntry<S extends string, F extends string, E extends string> = {
  /** Every spelling that should run this entry. Variations in spacing, flag order and flag form are normalised away. */
  match: readonly string[]
  /** Where the command runs: the Learner's machine (default) or a shell inside a container. */
  where?: 'local' | 'container'
  /** The output. In a named state with no output the command does not apply, and kubectl's own errors take over. */
  output: PerState<S, string>
  /**
   * Key findings the Learner reaches by running this command. A finding with `seenIn` is reached only
   * when that text is still in the output after --tail and pipes, so it must actually be on screen.
   */
  reveals?: readonly (F | { finding: F; seenIn: string })[]
  /** This output is perishable evidence; saving it to a file before it is destroyed captures it. */
  evidence?: E
  /** Present when the command changes the Target System. Absent means read-only. */
  mutating?: Mutation<S, E>
}

export type Alert = {
  name: string
  severity: 'page' | 'ticket'
  condition: string
  startedAt: string
  summary: string
}

/** One request seen by the load balancer, as it appears in the dashboard's log view. */
export type AccessLogLine = {
  time: string
  method: string
  path: string
  status: number
  ms: number
  upstream: string
}

export type Deploy = {
  revision: number
  version: string
  at: string
  by: string
}

/** What the dashboard shows in one named state. */
export type Dashboard = {
  alert: { status: 'firing' | 'resolved'; summary: string }
  /** One label per sample, e.g. "14:02". */
  minutes: readonly string[]
  signals: {
    /** Requests per second. */
    requests: readonly number[]
    /** Share of requests answered with a 5xx, in percent. */
    errors: readonly number[]
    /** 95th percentile latency in milliseconds. */
    latency: readonly number[]
    /** CPU use of the API pods against their limit, in percent. */
    saturation: readonly number[]
  }
  /** Changes marked on every graph, by sample index. */
  markers: readonly { at: number; label: string }[]
  /** Newest first. */
  deploys: readonly Deploy[]
  logs: readonly AccessLogLine[]
}

export type ExpertStep<F extends string> = {
  command: string
  why: string
  reaches?: readonly F[]
}

export type IncidentDefinition<S extends string = string, F extends string = string, E extends string = string> = {
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
  evidence: Record<E, { summary: string; lost: string }>
  /** Kube resources that exist, as "type/name"; anything else is NotFound. Names are offered by tab completion. */
  resources: PerState<NoInfer<S>, readonly string[]>
  /** Pods whose names start with this have a shell the Learner can open with kubectl exec. */
  shellPodPrefix: string
  commands: readonly CommandEntry<NoInfer<S>, NoInfer<F>, NoInfer<E>>[]
  dashboard: Record<NoInfer<S>, Dashboard>
  expertPath: readonly ExpertStep<NoInfer<F>>[]
}

export type Location = { kind: 'local' } | { kind: 'container'; pod: string; shell: 'sh' | 'bash' }

export type TimelineEntry = {
  text: string
  result: 'ran' | 'not-simulated' | 'unknown' | 'builtin' | 'cancelled'
}

/** A file the Learner saved by redirecting output, e.g. `kubectl logs ... > api.log`. */
export type SavedFile = {
  name: string
  content: string
  /** The canonical command that produced it, so reading it can reach that command's findings. */
  source: string
  /** The evidence it captured, if the command's output was evidence that still existed. */
  evidence?: string
}

export type SessionState = {
  namedState: string
  location: Location
  timeline: readonly TimelineEntry[]
  findings: readonly string[]
  files: readonly SavedFile[]
  /** Evidence destroyed by a mutating command, captured or not. */
  destroyed: readonly string[]
  /** A mutating command waiting for the Learner to confirm. */
  pending?: { text: string }
}

export type Input = { kind: 'command'; text: string }

export type Line =
  | { kind: 'input'; prompt: string; text: string }
  | { kind: 'output'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'notice'; text: string }
  | { kind: 'warning'; text: string }

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

export function defineIncident<const S extends string, const F extends string, const E extends string>(
  definition: IncidentDefinition<S, F, E>,
): IncidentDefinition<S, F, E> {
  return definition
}
