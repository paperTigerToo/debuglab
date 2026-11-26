// Helpers for writing Incident data files: column padding, graphs that look measured rather than
// drawn with a ruler, clock labels for dashboard samples and load balancer log lines.
import type { AccessLogLine } from '../engine/types'

export const pad = (text: string, width: number) => text.padEnd(width)

/** Gentle, repeatable wobble so graphs look measured rather than drawn with a ruler. */
export const wobble = (i: number, size: number) => size * (Math.sin(i * 1.7) * 0.6 + Math.sin(i * 0.53 + 1) * 0.4)

export const round = (n: number, places = 1) => Math.round(n * 10 ** places) / 10 ** places

/** Labels for dashboard samples taken every `step` minutes from a clock time such as "06:00". */
export function clock(start: string, step = 1): (i: number) => string {
  const [h = 0, m = 0] = start.split(':').map(Number)
  return (i) => {
    const total = h * 60 + m + i * step
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }
}

export const access = (time: string, method: string, path: string, status: number, ms: number, upstream: string): AccessLogLine => ({
  time,
  method,
  path,
  status,
  ms,
  upstream,
})

/** What nginx answers when no pod can take a request. */
export const unavailable503 = `<html>
<head><title>503 Service Temporarily Unavailable</title></head>
<body>
<center><h1>503 Service Temporarily Unavailable</h1></center>
<hr><center>nginx</center>
</body>
</html>`
