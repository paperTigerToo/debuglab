import { useEffect, useRef, useState } from 'react'

const RESET_MS = 2000

type Status = 'idle' | 'copied' | 'selected'

/**
 * Copies a command to the clipboard. Where the clipboard is unavailable, it selects the text instead
 * so the Learner can copy it themselves.
 */
export function CopyButton({ text, target }: { text: string; target: React.RefObject<HTMLElement | null> }) {
  const [status, setStatus] = useState<Status>('idle')
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  function show(next: Status) {
    setStatus(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setStatus('idle'), RESET_MS)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      show('copied')
    } catch {
      if (target.current) window.getSelection()?.selectAllChildren(target.current)
      show('selected')
    }
  }

  const label = { idle: 'Copy', copied: 'Copied', selected: 'Selected: press Ctrl+C' }[status]
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={status === 'idle' ? `Copy: ${text}` : label}
      className="shrink-0 rounded border border-line px-2 py-1 font-sans text-xs text-muted transition-colors hover:border-accent hover:text-text"
    >
      <span aria-live="polite">{label}</span>
    </button>
  )
}
