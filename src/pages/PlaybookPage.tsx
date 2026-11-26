import { Link, useSearchParams } from 'react-router'
import { layers } from '../content/playbook'
import { searchPlaybook } from '../content/playbookSearch'
import { playbookPath } from '../site/paths'
import { Annotated } from '../site/Term'
import { PageHeading } from './Placeholder'

export function PlaybookPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const matches = searchPlaybook(query)

  function search(value: string) {
    // Replace rather than push, so Back leaves the Playbook instead of undoing each keystroke.
    setParams(value ? { q: value } : {}, { replace: true })
  }

  return (
    <>
      <PageHeading title="Playbook">
        Granular questions an investigator asks, the commands that answer them, and how to read the output. Search by
        question, command or term.
      </PageHeading>
      <div className="max-w-3xl space-y-8">
        <div>
          <input
            type="search"
            aria-label="Search the Playbook"
            placeholder="Search, for example: rollout undo, CrashLoopBackOff, logs"
            value={query}
            onChange={(e) => search(e.target.value)}
            className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <p aria-live="polite" className="mt-2 text-xs text-muted">
            {query && (matches.length === 1 ? '1 Entry matches.' : `${matches.length} Entries match.`)}
          </p>
        </div>

        {matches.length === 0 && (
          <p className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">
            No Playbook Entry matches “{query}”. Try a command such as kubectl logs, or a word from a question.
          </p>
        )}

        {layers.map((layer) => {
          const entries = matches.filter((e) => e.layer === layer)
          if (entries.length === 0) return null
          const headingId = `layer-${layer.toLowerCase()}`
          return (
            <section key={layer} aria-labelledby={headingId}>
              <h2 id={headingId} className="font-mono text-xs uppercase tracking-widest text-muted">
                {layer}
              </h2>
              <ul className="mt-3 grid gap-3">
                {entries.map((e) => (
                  <li key={e.id} className="relative min-w-0 rounded-lg border border-line bg-panel p-4 transition-colors hover:border-accent">
                    <h3 className="font-medium">
                      {/* The link covers the whole card, while terms in the summary stay usable above it. */}
                      <Link to={playbookPath(e.id)} className="after:absolute after:inset-0 hover:text-accent">
                        {e.question}
                      </Link>
                    </h3>
                    <p className="relative z-[1] mt-1 text-sm text-muted">
                      <Annotated text={e.summary} />
                    </p>
                    <p className="mt-2 truncate font-mono text-xs text-muted">{e.commands[0]?.text}</p>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </>
  )
}
