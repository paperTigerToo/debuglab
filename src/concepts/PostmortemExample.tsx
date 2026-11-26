import { ChoiceQuiz, type QuizItem } from './ChoiceQuiz'

/** How a postmortem sentence frames what went wrong: around a person, or around the system they worked in. */
type Framing = 'blame' | 'system'

const items: QuizItem<Framing>[] = [
  {
    id: 'deployed',
    prompt: 'Sam deployed v2.14.0 without checking the manifest.',
    answer: 'blame',
    why: 'Rewrite it about the system: "The pipeline let a release ship that reads a configuration key the manifest does not set."',
  },
  {
    id: 'health-check',
    prompt: 'The health check did not touch payments, so the rollout looked healthy while every checkout failed.',
    answer: 'system',
    why: 'It names a gap anyone could have hit, and points at an action item: make the rollout check what customers do.',
  },
  {
    id: 'debug-logging',
    prompt: 'A teammate forgot to turn debug logging off.',
    answer: 'blame',
    why: 'Rewrite it: "Temporary debug settings had no owner or end time, so nothing prompted anyone to revert them." That leads to a fix; blame leads to silence.',
  },
  {
    id: 'too-slow',
    prompt: 'The on-call engineer was too slow to roll back.',
    answer: 'blame',
    why: 'Rewrite it with facts: "Rollback came 6 minutes after the page; saving the logs first took one of them, by design."',
  },
  {
    id: 'same-volume',
    prompt: 'PostgreSQL wrote its logs onto the same volume as its data.',
    answer: 'system',
    why: 'A fact about the design, with an obvious action item: keep logs off the data volume.',
  },
]

export function PostmortemExample() {
  return (
    <ChoiceQuiz
      title="Blame or system?"
      instruction="Sentences from draft postmortems. Mark each one, and see how a blaming sentence becomes one that leads to a fix."
      options={[
        { id: 'blame', label: 'Blames a person' },
        { id: 'system', label: 'Describes the system' },
      ]}
      items={items}
      nudge="Ask whether the sentence names someone to blame, or a condition anyone in that seat could have met."
    />
  )
}
