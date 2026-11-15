import type { ReactNode } from 'react'

/** The box every Concept's interactive example sits in. */
export function ExampleFrame({ title, instruction, children }: { title: string; instruction: string; children: ReactNode }) {
  return (
    <section aria-label={`Try it: ${title}`} className="rounded-lg border border-line bg-panel p-4 sm:p-5">
      <p className="font-mono text-xs uppercase tracking-widest text-accent">Try it</p>
      <h2 className="mt-1 font-medium">{title}</h2>
      <p className="mt-1 text-sm text-muted">{instruction}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}
