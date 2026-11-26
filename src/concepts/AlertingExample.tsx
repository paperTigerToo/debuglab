import { useId, useState } from 'react'
import { ExampleFrame } from './ExampleFrame'

// Thirty minutes of pantry-api's error rate around Bad Deploy, one sample a minute from 13:45, in percent of
// requests. Normally under 0.1%, within a 99.9% objective. A two-minute blip at 13:51 (a Redis failover that
// recovered by itself) tests whether a rule pages for nothing; the release at 14:02 starts the real Incident,
// about 9% errors until someone acts.
const START_MINUTE = 13 * 60 + 45
const errorPercent = [
  0.04, 0.06, 0.03, 0.08, 0.05, 0.04, 6.8, 7.4, 0.07, 0.05, 0.03, 0.06, 0.04, 0.08, 0.05, 0.03, 0.06, 8.7, 9.3, 9.0, 9.4, 8.9, 9.1, 9.6, 9.2, 8.8, 9.3, 9.0, 9.5, 9.1,
]
/** The sample at which v2.14.0 went out: 14:02. */
const RELEASE_SAMPLE = 17
const LAST_SAMPLE = errorPercent.length - 1
const clock = (sample: number) => {
  const m = START_MINUTE + sample
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

const thresholds = [1, 5, 10] as const
const durations = [1, 5] as const

/** The samples at which a rule "errors above `threshold`% for `minutes` minutes" starts firing, each a page. */
function pageStarts(threshold: number, minutes: number): number[] {
  const firing = errorPercent.map((_, i) => i + 1 >= minutes && errorPercent.slice(i + 1 - minutes, i + 1).every((e) => e > threshold))
  return firing.flatMap((on, i) => (on && !firing[i - 1] ? [i] : []))
}

/** 0.1% of 30 days, in minutes: what a 99.9% objective lets fail in a month. */
const MONTHLY_BUDGET_MINUTES = 43.2
/** Budget spent beyond what the objective allows anyway: a minute at 9% errors spends 0.089 of a minute. */
const budgetSpent = errorPercent.reduce((sum, e) => sum + Math.max(0, e - 0.1) / 100, 0)

export function AlertingExample() {
  const [threshold, setThreshold] = useState<number>(5)
  const [minutes, setMinutes] = useState<number>(5)
  const name = useId()
  const pages = pageStarts(threshold, minutes)
  const realPage = pages.find((i) => i >= RELEASE_SAMPLE)
  const falsePages = pages.filter((i) => i < RELEASE_SAMPLE)
  const delay = realPage === undefined ? 0 : realPage - RELEASE_SAMPLE

  return (
    <ExampleFrame
      title="Tune the alert"
      instruction={`pantry-api’s error rate, a minute at a time. A short blip fixed itself at 13:51; the bad release went out at ${clock(RELEASE_SAMPLE)}. Choose a rule and see who gets paged.`}
    >
      <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <fieldset>
          <legend className="text-xs text-muted">Page when errors are</legend>
          <div className="mt-1 flex gap-2">
            {thresholds.map((t) => (
              <Choice key={t} name={`${name}-t`} label={`above ${t}%`} checked={threshold === t} onChange={() => setThreshold(t)} />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-xs text-muted">and stay there</legend>
          <div className="mt-1 flex gap-2">
            {durations.map((d) => (
              <Choice
                key={d}
                name={`${name}-d`}
                label={`for ${d} ${d === 1 ? 'minute' : 'minutes'}`}
                checked={minutes === d}
                onChange={() => setMinutes(d)}
              />
            ))}
          </div>
        </fieldset>
      </div>

      <ErrorChart threshold={threshold} pages={pages} />

      <div aria-live="polite" className="mt-3 space-y-1 text-sm">
        <p className="font-medium">
          {pages.length} {pages.length === 1 ? 'page' : 'pages'}
        </p>
        {falsePages.map((i) => (
          <p key={i} className="text-danger">
            {clock(i)}: a false page. Someone is woken for a blip that cleared by itself.
          </p>
        ))}
        {realPage !== undefined ? (
          <p className="text-accent">
            {clock(realPage)}: the real Incident,{' '}
            {delay === 0 ? 'the minute checkout began failing' : `${delay} ${delay === 1 ? 'minute' : 'minutes'} after checkout began failing`}.
          </p>
        ) : (
          <p className="text-danger">The real Incident never pages: about 9% of requests fail and the rule stays quiet.</p>
        )}
        <p className="text-muted">
          A 99.9% monthly objective allows {MONTHLY_BUDGET_MINUTES} minutes of complete outage. This half hour, blip and release together,
          spent {budgetSpent.toFixed(1)} minutes of it, {Math.round((budgetSpent / MONTHLY_BUDGET_MINUTES) * 100)}%. Every minute before
          someone acts spends more.
        </p>
      </div>
    </ExampleFrame>
  )
}

function Choice({ name, label, checked, onChange }: { name: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label
      className={`cursor-pointer rounded border px-2 py-1 text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${
        checked ? 'border-accent bg-accent/10 text-text' : 'border-line text-muted hover:text-text'
      }`}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      {label}
    </label>
  )
}

// The chart's own coordinate space; the SVG scales to its container.
const WIDTH = 600
const HEIGHT = 150
const TOP_MARGIN = 22
const BOTTOM_MARGIN = 22
/** The top of the scale, in percent: just above the highest sample. */
const SCALE_MAX = 12

/** One bar per minute, the threshold as a dashed line, and a mark wherever the rule starts paging. */
function ErrorChart({ threshold, pages }: { threshold: number; pages: number[] }) {
  const slot = WIDTH / errorPercent.length
  const y = (v: number) => TOP_MARGIN + (1 - v / SCALE_MAX) * (HEIGHT - TOP_MARGIN - BOTTOM_MARGIN)
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Error rate, minute by minute from ${clock(0)} to ${clock(LAST_SAMPLE)}, with the alert threshold at ${threshold}%. Pages at ${
        pages.map(clock).join(' and ') || 'no time'
      }.`}
      className="mt-4 w-full"
    >
      <line x1={0} x2={WIDTH} y1={y(0)} y2={y(0)} stroke="var(--line)" />
      {errorPercent.map((e, i) => {
        const over = e > threshold
        return (
          <g key={i}>
            <rect
              x={i * slot + 2}
              y={y(e)}
              width={slot - 4}
              height={Math.max(1, y(0) - y(e))}
              rx={2}
              fill={over ? 'var(--danger)' : 'var(--muted)'}
              opacity={over ? 0.9 : 0.45}
            />
            {/* A hit target taller than the bar, so small bars are easy to hover for their value. */}
            <rect x={i * slot} y={TOP_MARGIN} width={slot} height={HEIGHT - TOP_MARGIN - BOTTOM_MARGIN} fill="transparent">
              <title>{`${clock(i)}: ${e}% of requests failed`}</title>
            </rect>
          </g>
        )
      })}
      <line x1={0} x2={WIDTH} y1={y(threshold)} y2={y(threshold)} stroke="var(--text)" strokeDasharray="4 4" strokeWidth={1} />
      {/* At the left, where the bars stay low, so the label never sits on a bar. */}
      <text x={4} y={y(threshold) - 4} fontSize={11} fill="var(--muted)">
        threshold {threshold}%
      </text>
      {pages.map((i) => (
        <text key={i} x={i * slot + slot / 2} y={12} textAnchor="middle" fontSize={11} fill="var(--text)">
          ▼ page
        </text>
      ))}
      <text x={0} y={HEIGHT - 6} fontSize={11} fill="var(--muted)">
        {clock(0)}
      </text>
      <text x={RELEASE_SAMPLE * slot} y={HEIGHT - 6} fontSize={11} fill="var(--muted)">
        {clock(RELEASE_SAMPLE)} v2.14.0
      </text>
      <text x={WIDTH} y={HEIGHT - 6} textAnchor="end" fontSize={11} fill="var(--muted)">
        {clock(LAST_SAMPLE)}
      </text>
    </svg>
  )
}
