import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { annotate } from '../content/annotate'
import { terms, type Term } from '../content/terms'

const WIDTH = 288
const GAP = 6

type Position = { left: number; top?: number; bottom?: number }

function positionBeside(trigger: HTMLElement): Position {
  const rect = trigger.getBoundingClientRect()
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - WIDTH - 8)
  // Open upwards when there is little room below, so the tooltip is not cut off.
  return rect.bottom + 140 > window.innerHeight
    ? { left, bottom: window.innerHeight - rect.top + GAP }
    : { left, top: rect.bottom + GAP }
}

/**
 * A term with its explanation. Hovering or focusing shows it; clicking or tapping keeps it open
 * until clicked again, Escape, or a click elsewhere. Screen readers hear it as the term's description.
 */
export function TermTip({ term, children }: { term: Term; children: string }) {
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [position, setPosition] = useState<Position>()
  const trigger = useRef<HTMLButtonElement>(null)
  const open = hovered || pinned

  useLayoutEffect(() => {
    if (!open || !trigger.current) return
    const reposition = () => trigger.current && setPosition(positionBeside(trigger.current))
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  function close() {
    setHovered(false)
    setPinned(false)
  }

  useEffect(() => {
    if (!open) return
    // Escape closes it however it was opened, by hover, focus or tap.
    const onEscape = (event: KeyboardEvent) => event.key === 'Escape' && close()
    const onPointerElsewhere = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node)) setPinned(false)
    }
    document.addEventListener('keydown', onEscape)
    document.addEventListener('pointerdown', onPointerElsewhere)
    return () => {
      document.removeEventListener('keydown', onEscape)
      document.removeEventListener('pointerdown', onPointerElsewhere)
    }
  }, [open])

  function toggle(event: MouseEvent) {
    // Inside the terminal a click would otherwise move focus to the command line.
    event.stopPropagation()
    // A second tap closes it, even though the pointer is still over the term.
    if (pinned) close()
    else setPinned(true)
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-describedby={descriptionId(term)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onClick={toggle}
        className="inline cursor-help rounded-sm p-0 text-inherit underline decoration-current/40 decoration-dotted underline-offset-[3px] hover:decoration-current focus-visible:decoration-current"
      >
        {children}
      </button>
      {open &&
        position &&
        createPortal(
          <div
            role="tooltip"
            aria-hidden="true"
            style={{ position: 'fixed', width: WIDTH, ...position }}
            className="z-50 rounded-md border border-line bg-panel-2 px-3 py-2 font-sans text-[13px] leading-snug text-text shadow-lg"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <span className="mb-1 block font-mono text-xs text-muted">{children}</span>
            {term.explanation}
          </div>,
          document.body,
        )}
    </>
  )
}

const descriptionId = (term: Term) => `term-${term.id}`

/**
 * Every explanation, rendered once and hidden. Each term points at its own with aria-describedby, so
 * screen readers hear it when the term is focused, without the page reading every explanation inline.
 */
export function TermDescriptions() {
  return (
    <div hidden>
      {terms.map((term) => (
        <span key={term.id} id={descriptionId(term)}>
          {term.explanation}
        </span>
      ))}
    </div>
  )
}

/**
 * Text with every known term made explainable, each the first time it appears. Texts given the same
 * `seen` set, such as the lines of the terminal, mark each term once between them.
 */
export function Annotated({ text, seen }: { text: string; seen?: Set<string> }) {
  return (
    <>
      {annotate(text, terms, seen).map((segment, i) =>
        typeof segment === 'string' ? (
          segment
        ) : (
          <TermTip key={i} term={segment.term}>
            {segment.text}
          </TermTip>
        ),
      )}
    </>
  )
}
