import { ChoiceQuiz, type QuizItem } from './ChoiceQuiz'

type Safeguard = 'canary' | 'flag' | 'rollback' | 'load-test' | 'timeouts' | 'trend-alert'

// Fast rollback is never the answer on purpose: it shortens an Incident but prevents none.
const notRollback = 'A fast rollback shortens the harm once it has happened. Which safeguard would have stopped it reaching users at all?'
const nothingDeployed = 'Nothing was deployed, so there is nothing to roll back.'

const items: QuizItem<Safeguard>[] = [
  {
    id: 'bad-deploy',
    prompt: 'Bad Deploy',
    answer: 'canary',
    why: 'A canary that runs a synthetic checkout fails on the first v2.14.0 pod, and the rollout stops before most customers see it.',
    wrong: { rollback: notRollback },
  },
  {
    id: 'memory-leak',
    prompt: 'Memory Leak',
    answer: ['flag', 'load-test'],
    why: 'Either catches it. A soak test at real traffic shows memory climbing within hours, before release; behind a flag, the new cache reaches a few users first and is switched off in seconds when memory starts to climb.',
    wrong: {
      rollback: notRollback,
      canary: 'A canary of a few minutes looks healthy: the leak took hours to kill anything. It needs a long soak, or a flag that keeps it small for days.',
      'trend-alert': 'An alert on memory growth would page hours before the first kill, which is worth having, but the leak would already be on every pod.',
    },
  },
  {
    id: 'slow-query',
    prompt: 'Slow Query',
    answer: 'load-test',
    why: 'Run against a copy of production-sized data, the migration turns a 1 millisecond lookup into a 2 second scan before it ships.',
    wrong: { rollback: 'A rollback restores the code, not the dropped index. This one had to be caught before release.' },
  },
  {
    id: 'connection-pool',
    prompt: 'Connection Pool Exhaustion',
    answer: 'timeouts',
    why: 'A short timeout and a circuit breaker on payments mean a slow dependency fails checkout quickly instead of holding every database connection.',
    wrong: { rollback: nothingDeployed },
  },
  {
    id: 'full-disk',
    prompt: 'Full Disk',
    answer: 'trend-alert',
    why: 'At 6 GB a day the volume’s time to full was predictable on Wednesday. An alert on that trend pages two days before any write fails.',
    wrong: { rollback: nothingDeployed },
  },
]

export function PreventionExample() {
  return (
    <ChoiceQuiz
      title="What would have caught it?"
      instruction="For each Incident in the lab, choose the safeguard that would have stopped it before users noticed."
      options={[
        { id: 'canary', label: 'Canary release' },
        { id: 'flag', label: 'Feature flag' },
        { id: 'rollback', label: 'Fast rollback' },
        { id: 'load-test', label: 'Load test with real data' },
        { id: 'timeouts', label: 'Timeouts and a circuit breaker' },
        { id: 'trend-alert', label: 'Alert on a trend' },
      ]}
      items={items}
      nudge="That helps in general, but would it have stopped this one before users noticed?"
    />
  )
}
