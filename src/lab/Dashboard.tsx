import { useState } from 'react'
import type { AccessLogLine, Alert, Dashboard as DashboardData } from '../engine/types'
import { SignalChart } from './SignalChart'

const whole = (n: number) => String(Math.round(n))
const oneDecimal = (n: number) => (n < 10 ? n.toFixed(1) : String(Math.round(n)))

export function AlertPanel({ alert, data }: { alert: Alert; data: DashboardData }) {
  const firing = data.alert.status === 'firing'
  return (
    <section
      aria-label="Alert"
      className={`rounded-lg border p-4 ${firing ? 'border-danger/50 bg-danger/10' : 'border-accent/50 bg-accent/10'}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={`rounded px-2 py-0.5 font-mono text-xs font-semibold uppercase text-bg ${firing ? 'bg-danger' : 'bg-accent'}`}
        >
          {firing ? '● firing' : '✓ resolved'}
        </span>
        <span className="font-mono text-sm font-semibold">{alert.name}</span>
        <span className="font-mono text-xs text-muted">since {alert.startedAt}</span>
      </div>
      <p className="mt-2 text-sm">{data.alert.summary}</p>
      <p className="mt-1 font-mono text-xs text-muted">condition: {alert.condition}</p>
    </section>
  )
}

export function Dashboard({ data }: { data: DashboardData }) {
  const { minutes, signals, markers } = data
  const chart = { minutes, markers }
  return (
    <div className="space-y-4">
      <section aria-label="Golden signals" className="grid gap-3 sm:grid-cols-2">
        <SignalChart {...chart} title="Request rate" unit="req/s" values={signals.requests} floor={50} format={whole} />
        <SignalChart {...chart} title="Error rate (5xx)" unit="%" values={signals.errors} floor={5} format={oneDecimal} />
        <SignalChart {...chart} title="Latency, 95th percentile" unit="ms" values={signals.latency} floor={50} format={whole} />
        <SignalChart {...chart} title="Saturation (API CPU of limit)" unit="%" values={signals.saturation} floor={50} format={whole} />
      </section>
      <DeployHistory deploys={data.deploys} />
      <LogView logs={data.logs} />
    </div>
  )
}

function DeployHistory({ deploys }: { deploys: DashboardData['deploys'] }) {
  return (
    <section aria-labelledby="deploys-heading" className="rounded-lg border border-line bg-panel p-3">
      <h2 id="deploys-heading" className="text-xs font-medium text-muted">
        Deploy history, pantry-api
      </h2>
      <ol className="mt-2 divide-y divide-line font-mono text-xs">
        {deploys.map((d, i) => (
          <li key={d.revision} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
            <span className="w-10 text-muted">r{d.revision}</span>
            <span className={i === 0 ? 'font-semibold text-text' : 'text-text'}>{d.version}</span>
            {i === 0 && <span className="rounded bg-panel-2 px-1.5 text-[10px] uppercase text-muted">live</span>}
            <span className="text-muted">{d.at}</span>
            <span className="ml-auto text-muted">{d.by}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

const statusFilters = ['all', '2xx', '4xx', '5xx'] as const
type StatusFilter = (typeof statusFilters)[number]

function LogView({ logs }: { logs: readonly AccessLogLine[] }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const needle = query.trim().toLowerCase()
  const shown = logs.filter(
    (l) =>
      (status === 'all' || String(l.status)[0] === status[0]) &&
      (!needle || `${l.method} ${l.path} ${l.status} ${l.upstream}`.toLowerCase().includes(needle)),
  )
  return (
    <section aria-labelledby="logs-heading" className="rounded-lg border border-line bg-panel p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="logs-heading" className="mr-auto text-xs font-medium text-muted">
          Load balancer access log (nginx)
        </h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search path, status, upstream"
          aria-label="Search the access log"
          className="w-48 rounded border border-line bg-bg px-2 py-1 font-mono text-xs"
        />
        <div role="group" aria-label="Filter by status" className="flex rounded border border-line">
          {statusFilters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={status === f}
              onClick={() => setStatus(f)}
              className={`px-2 py-1 font-mono text-xs ${status === f ? 'bg-panel-2 text-text' : 'text-muted hover:text-text'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 max-h-56 overflow-auto">
        <table className="w-full font-mono text-xs">
          <thead className="sticky top-0 bg-panel text-left text-muted">
            <tr>
              <th className="py-1 pr-3 font-normal">time</th>
              <th className="py-1 pr-3 font-normal">request</th>
              <th className="py-1 pr-3 font-normal">status</th>
              <th className="py-1 pr-3 text-right font-normal">ms</th>
              <th className="py-1 font-normal">upstream</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((l, i) => (
              <tr key={i} className="border-t border-line/60">
                <td className="py-1 pr-3 text-muted">{l.time}</td>
                <td className="py-1 pr-3">
                  {l.method} {l.path}
                </td>
                <td className={`py-1 pr-3 ${l.status >= 500 ? 'text-danger' : l.status >= 400 ? 'text-warn' : 'text-muted'}`}>
                  {l.status}
                </td>
                <td className="py-1 pr-3 text-right tabular-nums">{l.ms}</td>
                <td className="py-1 text-muted">{l.upstream}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="py-3 text-center text-xs text-muted">No requests match.</p>}
      </div>
    </section>
  )
}
