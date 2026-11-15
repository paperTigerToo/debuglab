import { Link } from 'react-router'
import { concepts } from '../content/concepts'
import { Annotated } from '../site/Term'
import { PageHeading } from './Placeholder'

export function ConceptsPage() {
  return (
    <>
      <PageHeading title="Concepts">The broad ideas: how an Incident unfolds and how to reason about one. Read them in order.</PageHeading>
      <ol className="grid max-w-3xl gap-4">
        {concepts.map((c, i) => (
          <li key={c.id} className="relative rounded-lg border border-line bg-panel p-5 transition-colors hover:border-accent">
            <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
            <h2 className="mt-1 text-lg font-medium">
              {/* The link covers the whole card, while terms in the summary stay usable above it. */}
              <Link to={c.id} className="after:absolute after:inset-0 hover:text-accent">
                {c.title}
              </Link>
            </h2>
            <p className="relative z-[1] mt-2 text-sm text-muted">
              <Annotated text={c.summary} />
            </p>
          </li>
        ))}
      </ol>
    </>
  )
}
