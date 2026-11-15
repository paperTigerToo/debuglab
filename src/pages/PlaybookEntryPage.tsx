import { useRef, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { conceptById } from '../content/concepts'
import { entryById, type PlaybookCommand, type SampleOutput } from '../content/playbook'
import { resourceById } from '../content/resources'
import { incidentsUsing } from '../incidents'
import { CopyButton } from '../site/CopyButton'
import { conceptPath, incidentPath } from '../site/paths'
import { Cite, Prose } from '../site/Prose'
import { Annotated } from '../site/Term'
import { NotFoundPage } from './NotFoundPage'

const panel = 'rounded-lg border border-line bg-panel p-4'
const label = 'font-mono text-xs uppercase tracking-widest text-muted'

function Command({ command }: { command: PlaybookCommand }) {
  const code = useRef<HTMLElement>(null)
  const mutating = command.effect === 'mutating'
  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-2">
        <code ref={code} className="min-w-0 flex-1 overflow-x-auto whitespace-pre rounded bg-bg px-2 py-1.5 font-mono text-xs">
          <Annotated text={command.text} />
        </code>
        <CopyButton text={command.text} target={code} />
      </div>
      <p className="flex flex-wrap items-baseline gap-2 text-sm">
        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${mutating ? 'bg-danger/15 text-danger' : 'bg-accent/10 text-accent'}`}
        >
          {mutating ? 'Changes the system' : 'Read-only'}
        </span>
        <span className="text-muted">
          <Annotated text={command.what} />
        </span>
      </p>
    </li>
  )
}

/** The output with each noted part marked and numbered, so a note can be found in the output. */
function markedOutput(sample: SampleOutput): ReactNode[] {
  const found = sample.notes
    .map((n, i) => {
      const start = sample.output.indexOf(n.mark)
      return { number: i + 1, start, end: start + n.mark.length }
    })
    .filter((m) => m.start >= 0)
    .sort((a, b) => a.start - b.start)
  const parts: ReactNode[] = []
  let at = 0
  for (const m of found) {
    if (m.start < at) continue // overlaps an earlier mark
    parts.push(sample.output.slice(at, m.start))
    parts.push(
      <mark key={m.number} className="rounded-sm bg-accent/20 text-text">
        {sample.output.slice(m.start, m.end)}
        <sup aria-hidden className="ml-0.5 font-sans text-[10px] text-accent">
          {m.number}
        </sup>
      </mark>,
    )
    at = m.end
  }
  parts.push(sample.output.slice(at))
  return parts
}

/** Long lines, such as JSON logs, wrap so their marked parts stay in view. Tables keep their columns. */
const wraps = (sample: SampleOutput) => sample.output.split('\n').some((line) => line.length > 100)

function Sample({ sample, healthy }: { sample: SampleOutput; healthy: boolean }) {
  const id = `sample-${healthy ? 'healthy' : 'unhealthy'}`
  return (
    <section aria-labelledby={id} className={`${panel} min-w-0`}>
      <h3 id={id} className="flex items-center gap-2 text-sm font-medium">
        <span aria-hidden className={`size-2 rounded-full ${healthy ? 'bg-accent' : 'bg-danger'}`} />
        {sample.label}
      </h3>
      <pre
        className={`mt-3 overflow-x-auto rounded bg-bg p-3 font-mono text-[11px] leading-relaxed ${wraps(sample) ? 'whitespace-pre-wrap break-all' : ''}`}
      >
        {markedOutput(sample)}
      </pre>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm marker:text-accent">
        {sample.notes.map((n) => (
          <li key={n.mark}>
            <code className="font-mono text-xs">{n.mark}</code>: <Annotated text={n.note} />
          </li>
        ))}
      </ol>
    </section>
  )
}

export function PlaybookEntryPage() {
  const { entryId } = useParams()
  const entry = entryId ? entryById(entryId) : undefined
  if (!entry) return <NotFoundPage />
  const usedIn = incidentsUsing(entry.id)
  const entryConcepts = entry.links.concepts.flatMap((id) => conceptById(id) ?? [])

  return (
    <article className="max-w-4xl space-y-8">
      <header className="max-w-3xl space-y-3">
        <p className={label}>
          <Link to="/playbook" className="hover:text-text">
            Playbook
          </Link>{' '}
          / {entry.layer}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{entry.question}</h1>
        <p className="text-lg text-muted">
          <Annotated text={entry.summary} />
        </p>
      </header>

      <section aria-labelledby="commands-heading" className={panel}>
        <h2 id="commands-heading" className={label}>
          Commands
        </h2>
        <ul className="mt-3 divide-y divide-line">
          {entry.commands.map((c) => (
            <Command key={c.text} command={c} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="output-heading">
        <h2 id="output-heading" className={label}>
          Reading the output
        </h2>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <Sample sample={entry.healthy} healthy />
          <Sample sample={entry.unhealthy} healthy={false} />
        </div>
      </section>

      <section aria-labelledby="next-heading" className={`${panel} max-w-3xl`}>
        <h2 id="next-heading" className={label}>
          What to ask next
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          {entry.followOn.map((f) => (
            <div key={f.if}>
              <dt className="font-medium">
                If <Annotated text={f.if.charAt(0).toLowerCase() + f.if.slice(1)} />
              </dt>
              <dd className="mt-0.5 text-muted">
                <Prose text={f.then} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid max-w-3xl gap-4 sm:grid-cols-3">
        <section aria-labelledby="used-heading" className={panel}>
          <h2 id="used-heading" className={label}>
            Used in
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {usedIn.map((i) => (
              <li key={i.id}>
                <Link to={incidentPath(i.id)} className="font-medium text-accent hover:underline">
                  {i.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="concepts-heading" className={panel}>
          <h2 id="concepts-heading" className={label}>
            Concepts
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {entryConcepts.map((c) => (
              <li key={c.id}>
                <Link to={conceptPath(c.id)} className="font-medium text-accent hover:underline">
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="resources-heading" className={panel}>
          <h2 id="resources-heading" className={label}>
            Resources
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {entry.links.resources.flatMap((id) => resourceById(id) ?? []).map((r) => (
              <li key={r.id}>
                <Cite id={r.id}>{r.title}</Cite>
                <span className="block text-xs text-muted">{r.publisher}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  )
}
