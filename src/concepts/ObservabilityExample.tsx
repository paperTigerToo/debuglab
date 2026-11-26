import { ChoiceQuiz, type QuizItem } from './ChoiceQuiz'

type Signal = 'logs' | 'metrics' | 'traces'

const items: QuizItem<Signal>[] = [
  {
    id: 'rate',
    prompt: 'Is checkout failing more often than it did yesterday?',
    answer: 'metrics',
    why: 'A rate over time is what a metric is for: the error-rate graph answers it in a glance, for any period you keep.',
    wrong: { logs: 'You could count error lines, but only for as far back as the logs go, and slowly. A metric is the count, already kept.' },
  },
  {
    id: 'why',
    prompt: 'Why did this checkout fail?',
    answer: 'logs',
    why: 'One event in detail is a log line: in Bad Deploy it says TypeError Invalid URL, with the URL it tried.',
    wrong: { metrics: 'A metric counts failures; it cannot say what went wrong in any one of them.' },
  },
  {
    id: 'where',
    prompt: 'Where did a slow checkout spend its 20 seconds?',
    answer: 'traces',
    why: 'A trace times each step of one request across services. In Connection Pool Exhaustion it would show 19.8 seconds inside the call to payments.',
    wrong: { logs: 'Logs can hint at it, as they do in Connection Pool Exhaustion, but only a trace times each hop of the same request.' },
  },
  {
    id: 'memory',
    prompt: 'How much memory does each pantry-api process hold right now?',
    answer: 'metrics',
    why: 'Memory in use is a number sampled over time: a metric. In Memory Leak the process publishes its own on /metrics.',
  },
]

export function ObservabilityExample() {
  return (
    <ChoiceQuiz
      title="Which signal answers it?"
      instruction="For each question an investigator might ask, choose the kind of signal that answers it best."
      options={[
        { id: 'logs', label: 'Logs' },
        { id: 'metrics', label: 'Metrics' },
        { id: 'traces', label: 'Traces' },
      ]}
      items={items}
      nudge="Ask what the question needs: a count over time, the detail of one event, or the path of one request."
    />
  )
}
