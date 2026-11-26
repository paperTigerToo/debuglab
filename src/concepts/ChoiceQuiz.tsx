import { useState } from 'react'
import { Annotated } from '../site/Term'
import { ExampleFrame } from './ExampleFrame'

export type QuizItem<O extends string> = {
  id: string
  /** What the Learner judges: a question, a command or a sentence. Also the name of its group. */
  prompt: string
  /** Shown in monospace when the prompt is a command. */
  code?: boolean
  /** The right choice, or every choice that is right when more than one is. */
  answer: O | readonly O[]
  /** Why the answer is right, shown once the Learner chooses it. */
  why: string
  /** What to say about a particular wrong choice; otherwise the quiz's general nudge. */
  wrong?: Partial<Record<O, string>>
}

type Props<O extends string> = {
  title: string
  instruction: string
  options: readonly { id: O; label: string }[]
  items: readonly QuizItem<O>[]
  /** Said after a wrong choice that has no explanation of its own. */
  nudge: string
}

const isRight = <O extends string>(item: QuizItem<O>, choice: O | undefined) =>
  choice !== undefined && (typeof item.answer === 'string' ? item.answer === choice : item.answer.includes(choice))

/** A Concept example where the Learner makes one choice per item and learns from each answer at once. */
export function ChoiceQuiz<O extends string>({ title, instruction, options, items, nudge }: Props<O>) {
  const [chosen, setChosen] = useState<Partial<Record<string, O>>>({})
  const right = items.filter((item) => isRight(item, chosen[item.id])).length
  return (
    <ExampleFrame title={title} instruction={instruction}>
      <ul className="space-y-3">
        {items.map((item) => {
          const choice = chosen[item.id]
          const correct = isRight(item, choice)
          return (
            <li key={item.id} className="rounded-md border border-line p-3 text-sm">
              <div role="group" aria-label={item.prompt}>
                <p className={item.code ? 'break-words font-mono text-xs' : 'font-medium'}>
                  {item.code ? item.prompt : <Annotated text={item.prompt} />}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {options.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={choice === o.id}
                      onClick={() => setChosen((c) => ({ ...c, [item.id]: o.id }))}
                      className={`rounded border px-2 py-0.5 text-xs transition-colors ${
                        choice === o.id
                          ? correct
                            ? 'border-accent bg-accent/10 text-text'
                            : 'border-danger bg-danger/10 text-text'
                          : 'border-line text-muted hover:border-muted hover:text-text'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {choice !== undefined && (
                  <p className="mt-2 border-l-2 pl-3" style={{ borderColor: correct ? 'var(--accent)' : 'var(--danger)' }}>
                    <span className={`font-medium ${correct ? 'text-accent' : 'text-danger'}`}>{correct ? 'Right. ' : 'Not quite. '}</span>
                    <Annotated text={correct ? item.why : (item.wrong?.[choice] ?? nudge)} />
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      <p aria-live="polite" className="mt-3 text-sm text-muted">
        {right} of {items.length} right
      </p>
    </ExampleFrame>
  )
}
