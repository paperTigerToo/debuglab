import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { concepts } from '../content/concepts'
import { entryById } from '../content/playbook'
import { resources } from '../content/resources'
import type { Debrief } from '../engine/engine'
import { conceptPath, playbookPath } from '../site/paths'
import { Cite } from '../site/Prose'
import { Annotated } from '../site/Term'

const verdictText = {
  best: 'The right first move',
  works: 'Stops the harm, at a cost',
  'no-effect': 'Changes nothing',
  harmful: 'Makes it worse',
} as const

function Verdict({ good, title, children }: { good: boolean; title: string; children: ReactNode }) {
  return (
    <section
      aria-label={title}
      className={`rounded-lg border p-4 ${good ? 'border-accent/50 bg-accent/10' : 'border-danger/50 bg-danger/10'}`}
    >
      <h2 className="text-sm font-semibold">
        <span aria-hidden className={good ? 'text-accent' : 'text-danger'}>
          {good ? '✓ ' : '✗ '}
        </span>
        {title}
      </h2>
      <div className="mt-2 space-y-2 text-sm">{children}</div>
    </section>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="rounded-lg border border-line bg-panel p-4">
      <h2 className="font-mono text-xs uppercase tracking-widest text-muted">{title}</h2>
      <div className="mt-3 text-sm">{children}</div>
    </section>
  )
}

/** The review shown when an Incident ends. */
export function DebriefView({ debrief }: { debrief: Debrief }) {
  const d = debrief
  const { rootCause, harm } = d
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Verdict good={harm.stopped} title={harm.stopped ? 'You stopped the harm' : 'Customers were still affected'}>
          <p>
            <span className="text-muted">What your commands did. </span>
            When you finished: <Annotated text={harm.summary} />
          </p>
          <div className="border-t border-line pt-2">
            <p>
              <span className="text-muted">The Mitigation you said you would apply. </span>
              <strong>{harm.mitigation.label}</strong>: {verdictText[harm.mitigation.verdict]}.
            </p>
            <p className="text-muted">
              <Annotated text={harm.mitigation.explanation} />
            </p>
          </div>
        </Verdict>
        <Verdict good={rootCause.correct} title={rootCause.correct ? 'You found the Root Cause' : 'That is not the Root Cause'}>
          <p>
            You chose: <strong>{rootCause.chosen}</strong>
          </p>
          {!rootCause.correct && (
            <>
              <p>
                The Root Cause: <strong>{rootCause.actual}</strong>
              </p>
              <ul className="space-y-2">
                {rootCause.contradictions.map((c) => (
                  <li key={c.why} className="border-l-2 border-line pl-3">
                    <Annotated text={c.why} />{' '}
                    <span className="text-muted">
                      {c.reached ? `You had reached this Finding: ${c.finding}` : `A Finding you never reached: ${c.finding}`}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Verdict>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Your commands">
          <ol className="space-y-1 font-mono text-xs">
            {d.timeline.map((t, i) => (
              <li key={i} className={t.result === 'ran' ? '' : 'text-muted'}>
                <span className="text-muted">{String(i + 1).padStart(2, ' ')}.</span> {t.text}
                {t.result !== 'ran' && <span className="ml-2 font-sans text-[11px]">({t.result.replace('-', ' ')})</span>}
              </li>
            ))}
          </ol>
          {d.timeline.length === 0 && <p className="text-muted">You ran no commands.</p>}
        </Section>
        <Section title="Expert Path">
          <ol className="space-y-2">
            {d.expertPath.map((s) => (
              <li key={s.command}>
                <span aria-label={s.covered ? 'covered' : 'missed'} className={s.covered ? 'text-accent' : 'text-danger'}>
                  {s.covered ? '✓' : '○'}
                </span>{' '}
                <code className="font-mono text-xs">
                  <Annotated text={s.command} />
                </code>
                <span className="block pl-4 text-xs text-muted">
                  <Annotated text={s.why} />
                </span>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Section title="Evidence">
          <ul className="space-y-2">
            {d.evidence.captured.map((e) => (
              <li key={e}>
                <span className="font-mono text-xs text-accent">kept</span> {e}
              </li>
            ))}
            {d.evidence.lost.map((e) => (
              <li key={e}>
                <span className="font-mono text-xs text-danger">lost</span> {e}
              </li>
            ))}
            {d.evidence.captured.length + d.evidence.lost.length === 0 && (
              <li className="text-muted">Nothing was saved, and nothing was destroyed.</li>
            )}
          </ul>
        </Section>
        <Section title="Findings">
          <ul className="space-y-2">
            {d.findings.reached.map((f) => (
              <li key={f}>
                <span className="text-accent">✓</span> {f}
              </li>
            ))}
            {d.findings.missed.map((f) => (
              <li key={f} className="text-muted">
                ○ {f}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Hints used">
          <p className="font-mono text-2xl">{d.hintsUsed}</p>
          <p className="mt-1 text-muted">Each tier revealed counts once.</p>
        </Section>
      </div>

      <Section title="Sample postmortem">
        <div className="space-y-3">
          <p className="font-medium">{d.postmortem.summary}</p>
          <p>
            <span className="text-muted">Impact. </span>
            {d.postmortem.impact}
          </p>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Timeline</caption>
            <tbody>
              {d.postmortem.timeline.map((t, i) => (
                <tr key={i} className="border-t border-line align-top">
                  <th scope="row" className="w-16 py-1 pr-3 font-mono text-xs font-normal text-muted">
                    {t.at}
                  </th>
                  <td className="py-1">{t.event}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            <span className="text-muted">Root Cause. </span>
            <Annotated text={d.postmortem.rootCause} />
          </p>
          <p>
            <span className="text-muted">Resolution. </span>
            {d.postmortem.resolution}
          </p>
          <div>
            <p className="text-muted">Action items</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {d.postmortem.actionItems.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="How this could have been prevented">
        <ul className="list-disc space-y-2 pl-5">
          {d.prevention.map((p) => (
            <li key={p}>
              <Annotated text={p} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Study next">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-muted">Concepts this Incident exercised</p>
            <ul className="mt-1 space-y-1">
              {concepts
                .filter((c) => d.links.concepts.includes(c.id))
                .map((c) => (
                  <li key={c.id}>
                    <Link to={conceptPath(c.id)} className="text-accent hover:underline">
                      {c.title}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <p className="text-muted">Playbook Entries it used</p>
            <ul className="mt-1 space-y-1">
              {d.playbookEntries.map(({ id, hinted }) => (
                <li key={id}>
                  <Link to={playbookPath(id)} className="text-accent hover:underline">
                    {entryById(id)?.question ?? id}
                  </Link>
                  {hinted && <span className="block text-xs text-muted">You asked for a Hint here</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-muted">Resources</p>
            <ul className="mt-1 space-y-1">
              {resources
                .filter((r) => d.links.resources.includes(r.id))
                .map((r) => (
                  <li key={r.id}>
                    <Cite id={r.id}>{r.title}</Cite> <span className="text-xs text-muted">{r.publisher}</span>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </Section>
    </div>
  )
}
