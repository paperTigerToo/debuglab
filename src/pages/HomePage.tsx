import { Link } from 'react-router'
import { areas } from '../site/areas'

export function HomePage() {
  return (
    <div className="space-y-10">
      <section className="max-w-3xl space-y-4">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">incident response, practised</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Learn to debug a live service before you are paged for one.
        </h1>
        <p className="text-muted">
          DebugLab teaches how to find out why a running web service is failing, not only how to undo the last
          change. Read the broad ideas, look up the exact commands, then work a simulated Incident from the alert that
          pages you to its Root Cause. The rule underneath everything: stop the harm first, and capture the
          evidence before your Mitigation destroys it.
        </p>
      </section>
      <section aria-labelledby="areas-heading">
        <h2 id="areas-heading" className="sr-only">
          Areas
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {areas.map((area) => (
            <li key={area.path}>
              <Link
                to={area.path}
                className="group block h-full rounded-lg border border-line bg-panel p-5 transition-colors hover:border-accent"
              >
                <span className="font-mono text-xs uppercase tracking-widest text-muted">{area.kind}</span>
                <span className="mt-1 block text-lg font-medium group-hover:text-accent">{area.name}</span>
                <span className="mt-2 block text-sm text-muted">{area.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
