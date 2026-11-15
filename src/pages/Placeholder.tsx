import type { ReactNode } from 'react'

export function PageHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-8 max-w-3xl space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <p className="text-muted">{children}</p>}
    </header>
  )
}

export function ComingSoon() {
  return (
    <p className="rounded-lg border border-dashed border-line p-6 text-sm text-muted">
      This area is being written. It arrives with the first Incident's slice.
    </p>
  )
}
