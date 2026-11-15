import { Link } from 'react-router'
import { parseProse } from '../content/prose'
import { resourceById } from '../content/resources'
import { conceptPath, incidentPath } from './paths'
import { Annotated } from './Term'

const linkStyle = 'text-accent underline decoration-accent/40 underline-offset-[3px] hover:decoration-accent'

/** A Resource cited inline: opens the source in a new tab and says so. */
export function Cite({ id, children }: { id: string; children: string }) {
  const resource = resourceById(id)
  if (!resource) return <>{children}</>
  return (
    <a href={resource.url} target="_blank" rel="noreferrer" title={`${resource.title}, ${resource.publisher}`} className={linkStyle}>
      {children}
      <span aria-hidden className="ml-0.5 text-[0.8em]">↗</span>
      <span className="sr-only"> (opens {resource.publisher} in a new tab)</span>
    </a>
  )
}

/** Content prose: terms get tooltips, and [text](kind:id) links become real links. */
export function Prose({ text }: { text: string }) {
  const seen = new Set<string>()
  return (
    <>
      {parseProse(text).map((part, i) =>
        typeof part === 'string' ? (
          <Annotated key={i} text={part} seen={seen} />
        ) : part.to.kind === 'resource' ? (
          <Cite key={i} id={part.to.id}>
            {part.text}
          </Cite>
        ) : (
          <Link key={i} to={(part.to.kind === 'concept' ? conceptPath : incidentPath)(part.to.id)} className={linkStyle}>
            {part.text}
          </Link>
        ),
      )}
    </>
  )
}
