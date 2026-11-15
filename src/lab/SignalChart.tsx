import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react'

type Props = {
  title: string
  unit: string
  minutes: readonly string[]
  values: readonly number[]
  markers: readonly { at: number; label: string }[]
  /** The y axis never ends below this, so a calm series does not look dramatic. */
  floor: number
  format: (n: number) => string
}

const W = 320
const H = 132
const PAD = { top: 18, right: 8, bottom: 20, left: 34 }

/** One golden signal over time: a single line with deploy markers and a crosshair readout. */
export function SignalChart({ title, unit, minutes, values, markers, floor, format }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const id = useId()
  const max = Math.max(floor, ...values) * 1.15
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (values.length <= 1 ? 0 : (i / (values.length - 1)) * plotW)
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const ticks = [0, max / 2, max]
  const latest = values.at(-1) ?? 0
  const shown = hover ?? values.length - 1

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - box.left) / box.width) * W
    const i = Math.round(((px - PAD.left) / plotW) * (values.length - 1))
    setHover(Math.min(values.length - 1, Math.max(0, i)))
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const from = hover ?? values.length - 1
    setHover(Math.min(values.length - 1, Math.max(0, from + (event.key === 'ArrowLeft' ? -1 : 1))))
  }

  return (
    <figure className="rounded-lg border border-line bg-panel p-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted">{title}</span>
        <span className="font-mono text-sm tabular-nums">
          {format(values[shown] ?? latest)}
          <span className="ml-1 text-xs text-muted">{unit}</span>
          {hover !== null && <span className="ml-2 text-xs text-muted">at {minutes[hover]}</span>}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 block w-full touch-none select-none overflow-visible"
        role="img"
        aria-labelledby={`${id}-desc`}
        tabIndex={0}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={onKeyDown}
      >
        <desc id={`${id}-desc`}>
          {`${title}: ${format(values[0] ?? 0)} ${unit} at ${minutes[0]}, now ${format(latest)} ${unit} at ${minutes.at(-1)}.`}
          {markers.map((m) => ` ${m.label} at ${minutes[m.at]}.`).join('')}
          {' Use the left and right arrow keys to read values.'}
        </desc>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" className="fill-muted font-mono text-[9px]">
              {format(t)}
            </text>
          </g>
        ))}
        {[0, Math.floor((values.length - 1) / 2), values.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted font-mono text-[9px]">
            {minutes[i]}
          </text>
        ))}
        {markers.map((m) => (
          <g key={`${m.at}-${m.label}`}>
            <line
              x1={x(m.at)}
              x2={x(m.at)}
              y1={PAD.top - 4}
              y2={PAD.top + plotH}
              className="stroke-muted"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text x={x(m.at) + 3} y={PAD.top - 6} className="fill-muted font-mono text-[9px]">
              {m.label}
            </text>
          </g>
        ))}
        <path d={path} fill="none" className="stroke-series" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-text/50" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(values[hover] ?? 0)} r={4} className="fill-series stroke-panel" strokeWidth={2} />
          </g>
        )}
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="transparent" />
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Time</th>
            <th scope="col">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {values.map((v, i) => (
            <tr key={i}>
              <th scope="row">{minutes[i]}</th>
              <td>{format(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
