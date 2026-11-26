import { Link, useParams } from 'react-router'
import { AlertingExample } from '../concepts/AlertingExample'
import { HypothesisExample } from '../concepts/HypothesisExample'
import { LifecycleExample } from '../concepts/LifecycleExample'
import { MitigateFirstExample } from '../concepts/MitigateFirstExample'
import { ObservabilityExample } from '../concepts/ObservabilityExample'
import { PostmortemExample } from '../concepts/PostmortemExample'
import { PreventionExample } from '../concepts/PreventionExample'
import { WorkingSafelyExample } from '../concepts/WorkingSafelyExample'
import { citedResourceIds, concepts, type Concept } from '../content/concepts'
import { resourceById } from '../content/resources'
import { incidents } from '../incidents'
import { conceptPath, incidentPath } from '../site/paths'
import { Cite, Prose } from '../site/Prose'
import { Annotated } from '../site/Term'
import { NotFoundPage } from './NotFoundPage'

const examples: Record<Concept['example'], () => React.JSX.Element> = {
  lifecycle: LifecycleExample,
  'mitigate-first': MitigateFirstExample,
  hypothesis: HypothesisExample,
  observability: ObservabilityExample,
  alerting: AlertingExample,
  'working-safely': WorkingSafelyExample,
  prevention: PreventionExample,
  postmortem: PostmortemExample,
}

export function ConceptPage() {
  const { conceptId } = useParams()
  const index = concepts.findIndex((c) => c.id === conceptId)
  const concept = concepts[index]
  if (!concept) return <NotFoundPage />
  const Example = examples[concept.example]
  const practisedIn = incidents.filter((i) => i.links.concepts.includes(concept.id))
  const next = concepts[index + 1]

  return (
    <article className="max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          <Link to="/concepts" className="hover:text-text">
            Concepts
          </Link>{' '}
          / {String(index + 1).padStart(2, '0')}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{concept.title}</h1>
        <p className="text-lg text-muted">
          <Annotated text={concept.summary} />
        </p>
      </header>

      <Example />

      <div className="space-y-4 leading-relaxed">
        {concept.body.map((paragraph) => (
          <p key={paragraph}>
            <Prose text={paragraph} />
          </p>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section aria-labelledby="practise-heading" className="rounded-lg border border-line bg-panel p-4">
          <h2 id="practise-heading" className="font-mono text-xs uppercase tracking-widest text-muted">
            Practise it
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {practisedIn.map((i) => (
              <li key={i.id}>
                <Link to={incidentPath(i.id)} className="font-medium text-accent hover:underline">
                  {i.title}
                </Link>
                <span className="text-muted">, an Incident in the Incident Lab</span>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="sources-heading" className="rounded-lg border border-line bg-panel p-4">
          <h2 id="sources-heading" className="font-mono text-xs uppercase tracking-widest text-muted">
            Resources
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {citedResourceIds(concept).flatMap((id) => resourceById(id) ?? []).map((r) => (
              <li key={r.id}>
                <Cite id={r.id}>{r.title}</Cite>
                <span className="block text-xs text-muted">{r.publisher}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <nav aria-label="Next" className="border-t border-line pt-6 text-sm">
        {next ? (
          <Link to={conceptPath(next.id)} className="group block">
            <span className="text-muted">Next Concept</span>
            <span className="block text-lg font-medium group-hover:text-accent">{next.title} →</span>
          </Link>
        ) : (
          <Link to="/lab" className="group block">
            <span className="text-muted">You have read every Concept</span>
            <span className="block text-lg font-medium group-hover:text-accent">Work an Incident →</span>
          </Link>
        )}
      </nav>
    </article>
  )
}
