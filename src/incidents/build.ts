// Helpers for writing Incident data files: column padding, graphs that look measured rather than
// drawn with a ruler, clock labels for dashboard samples and load balancer log lines.
import type { AccessLogLine, Dashboard } from '../engine/types'

export const pad = (text: string, width: number) => text.padEnd(width)

/** A table as kubectl prints it: each column as wide as its widest cell plus three spaces; the last is not padded. */
export function kubectlTable(rows: readonly (readonly string[])[]): string {
  const widths = rows[0]!.map((_, c) => Math.max(...rows.map((r) => (r[c] ?? '').length)) + 3)
  return rows.map((r) => r.map((cell, c) => (c === r.length - 1 ? cell : pad(cell, widths[c]!))).join('')).join('\n')
}

export type PodRow = { name: string; ready: string; status: string; restarts: string; age: string; ip: string; node: string }

/** `kubectl get pods`, or with `wide` the `-o wide` form that adds each pod's IP and node. */
export function podsTable(pods: readonly PodRow[], wide = false): string {
  const header = ['NAME', 'READY', 'STATUS', 'RESTARTS', 'AGE']
  const row = (p: PodRow) => [p.name, p.ready, p.status, p.restarts, p.age]
  if (!wide) return kubectlTable([header, ...pods.map(row)])
  return kubectlTable([
    [...header, 'IP', 'NODE', 'NOMINATED NODE', 'READINESS GATES'],
    ...pods.map((p) => [...row(p), p.ip, p.node, '<none>', '<none>']),
  ])
}

/** A healthy pod's row: ready, running, never restarted. */
export const runningPod = (p: { pod: string; ip: string; node: string }, age: string): PodRow => ({
  name: p.pod,
  ready: '1/1',
  status: 'Running',
  restarts: '0',
  age,
  ip: p.ip,
  node: p.node,
})

/** A query result as psql prints it: centred headings, a rule, cells (numbers right-aligned) and a row count. */
export function psqlTable(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = header.map((h, c) => Math.max(h.length, ...rows.map((r) => r[c]!.length)))
  const numeric = header.map((_, c) => rows.length > 0 && rows.every((r) => /^\d*$/.test(r[c]!)))
  const last = header.length - 1
  const cell = (text: string, c: number, align: 'left' | 'right' | 'centre') => {
    const room = widths[c]! - text.length
    const left = align === 'right' ? room : align === 'centre' ? Math.floor(room / 2) : 0
    const padded = ' '.repeat(left) + text + (c === last && align === 'left' ? '' : ' '.repeat(room - left))
    return ` ${padded}${c === last ? '' : ' '}`
  }
  const line = (r: readonly string[], align: (c: number) => 'left' | 'right' | 'centre') => r.map((t, c) => cell(t, c, align(c))).join('|')
  return [
    line(header, () => 'centre').trimEnd(),
    widths.map((w) => '-'.repeat(w + 2)).join('+'),
    ...rows.map((r) => line(r, (c) => (numeric[c] ? 'right' : 'left'))),
    `(${rows.length} ${rows.length === 1 ? 'row' : 'rows'})`,
  ].join('\n')
}

/** `kubectl top pods`. */
export const topTable = (pods: readonly { name: string; cpu: string; memory: string }[]) =>
  kubectlTable([['NAME', 'CPU(cores)', 'MEMORY(bytes)'], ...pods.map((p) => [p.name, p.cpu, p.memory])])

/** pantry-api's JSON log lines on one day, such as "2026-11-19". */
export function appLog(date: string) {
  const line = (time: string, level: 'info' | 'warn' | 'error', msg: string, fields: Record<string, unknown> = {}) =>
    JSON.stringify({ level, time: `${date}T${time}Z`, pid: 1, msg, ...fields })
  const request = (time: string, method: string, path: string, ms: number, status = 200) =>
    line(time, 'info', 'request completed', { method, path, status, ms })
  return { line, request }
}

/** Dashboard samples: a label for each, and the golden signals computed from what phase each sample is in. */
export function samples<P>(
  length: number,
  label: (i: number) => string,
  phaseAt: (i: number) => P,
  signals: (phases: P[]) => Dashboard['signals'],
): Pick<Dashboard, 'minutes' | 'signals'> {
  const phases = Array.from({ length }, (_, i) => phaseAt(i))
  return { minutes: phases.map((_, i) => label(i)), signals: signals(phases) }
}

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
