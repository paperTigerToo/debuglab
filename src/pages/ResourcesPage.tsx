import { resources, subjects } from '../content/resources'
import { Cite } from '../site/Prose'
import { PageHeading } from './Placeholder'

const headingId = (subject: string) => `subject-${subject.toLowerCase().replaceAll(' ', '-')}`

export function ResourcesPage() {
  return (
    <>
      <PageHeading title="Resources">
        Primary sources worth reading in depth, grouped by subject, each with a line on why. Every one is cited from a
        Concept or an Incident.
      </PageHeading>
      <div className="max-w-3xl space-y-8">
        {subjects.map((subject) => (
          <section key={subject} aria-labelledby={headingId(subject)}>
            <h2 id={headingId(subject)} className="font-mono text-xs uppercase tracking-widest text-muted">
              {subject}
            </h2>
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-panel">
              {resources
                .filter((r) => r.subject === subject)
                .map((r) => (
                  <li key={r.id} className="p-4">
                    <p className="font-medium">
                      <Cite id={r.id}>{r.title}</Cite>
                    </p>
                    <p className="text-xs text-muted">{r.publisher}</p>
                    <p className="mt-2 text-sm">{r.why}</p>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  )
}
