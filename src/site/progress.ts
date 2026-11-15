// The Learner's progress, kept in this browser only. Everything works when storage is unavailable:
// progress then lasts for the page view.
import { useCallback, useSyncExternalStore } from 'react'
import type { Debrief } from '../engine/engine'
import { readStored, writeStored } from './storage'

export type IncidentRecord = {
  rootCauseFound: boolean
  harmStopped: boolean
  hintsUsed: number
}

/** Completed means both halves of the response: harm stopped and Root Cause found. */
export function isComplete(record: IncidentRecord): boolean {
  return record.rootCauseFound && record.harmStopped
}

type Progress = { incidents: Record<string, IncidentRecord> }

const KEY = 'debuglab.progress'
const empty: Progress = { incidents: {} }

function parse(raw: string | null): Progress {
  if (!raw) return empty
  try {
    const value = JSON.parse(raw) as Progress
    return value && typeof value.incidents === 'object' ? value : empty
  } catch {
    return empty
  }
}

// One copy shared by every component, so a change shows everywhere at once.
let current: Progress = parse(readStored(KEY))
const listeners = new Set<() => void>()

function save(next: Progress) {
  current = next
  writeStored(KEY, JSON.stringify(next))
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useProgress() {
  const progress = useSyncExternalStore(subscribe, () => current)
  const record = useCallback((incidentId: string, debrief: Debrief) => {
    const entry: IncidentRecord = {
      rootCauseFound: debrief.rootCause.correct,
      harmStopped: debrief.harm.stopped,
      hintsUsed: debrief.hintsUsed,
    }
    // A completed Incident stays completed: a later, weaker attempt does not undo it.
    const previous = current.incidents[incidentId]
    if (previous && isComplete(previous) && !isComplete(entry)) return
    save({ incidents: { ...current.incidents, [incidentId]: entry } })
  }, [])
  const reset = useCallback(() => save(empty), [])
  return { records: progress.incidents, record, reset }
}
