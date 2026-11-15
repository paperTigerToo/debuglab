import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { annotate } from '../content/annotate'
import { conceptById } from '../content/concepts'
import { terms, type Term } from '../content/terms'
import { conceptPath } from './paths'

const WIDTH = 288
const GAP = 6
/** How long the tooltip waits after the pointer leaves, so it can cross the gap into the tooltip. */
const LEAVE_DELAY_MS = 150

type Position = { left: number; top?: number; bottom?: number }

function positionBeside(trigger: HTMLElement): Position {
  const rect = trigger.getBoundingClientRect()
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - WIDTH - 8)
  // Open upwards when there is little room below, so the tooltip is not cut off.
  return rect.bottom + 160 > window.innerHeight
    ? { left, bottom: window.innerHeight - rect.top + GAP }
    : { left, top: rect.bottom + GAP }
}

const conceptOf = (term: Term) => (term.concept ? conceptById(term.concept) : undefined)

/**
 * A term with its explanation. Hovering or focusing shows it; clicking or tapping keeps it open
 * until clicked again, Escape, or a click elsewhere. Screen readers hear it as the term's description.
 * When the term has a Concept, the tooltip links to it: the pointer can move into the tooltip, and
 * pressing Enter on the term moves keyboard focus to the link.
 */
export function TermTip({ term, children }: { term: Term; children: string }) {
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [linkFocusPending, setLinkFocusPending] = useState(false)
  const [position, setPosition] = useState<Position>()
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const link = useRef<HTMLAnchorElement>(null)
  const leaveTimer = useRef<number>(undefined)
  const concept = conceptOf(term)
  const open = hovered || pinned

  function close() {
    setHovered(false)
    setPinned(false)
  }

  function enter() {
    window.clearTimeout(leaveTimer.current)
    setHovered(true)
  }

  function leave() {
    window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => setHovered(false), LEAVE_DELAY_MS)
  }

  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])

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

  useEffect(() => {
    if (linkFocusPending && position && link.current) {
      link.current.focus()
      setLinkFocusPending(false)
    }
  }, [linkFocusPending, position])

  useEffect(() => {
    if (!open) return
    // Escape closes it however it was opened, by hover, focus or tap.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (popup.current?.contains(document.activeElement)) trigger.current?.focus()
      close()
    }
    const onPointerElsewhere = (event: PointerEvent) => {
      const target = event.target as Node
      if (!trigger.current?.contains(target) && !popup.current?.contains(target)) setPinned(false)
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
    if (pinned) return close()
    setPinned(true)
    // Enter or Space (a click with no pointer) takes keyboard users into the tooltip's link.
    if (event.detail === 0 && concept) setLinkFocusPending(true)
  }

  // The tooltip sits at the end of the page, so Tab from its link returns to the term and moves on from there.
  function onLinkKeyDown(event: ReactKeyboardEvent) {
    if (event.key !== 'Tab') return
    if (event.shiftKey) event.preventDefault()
    else setPinned(false)
    trigger.current?.focus()
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-describedby={descriptionId(term)}
        onMouseEnter={enter}
        onMouseLeave={leave}
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
            ref={popup}
            style={{ position: 'fixed', width: WIDTH, ...position }}
            className="z-50 rounded-md border border-line bg-panel-2 px-3 py-2 font-sans text-[13px] leading-snug text-text shadow-lg"
            onMouseEnter={enter}
            onMouseLeave={leave}
          >
            {/* Screen readers already hear this as the term's description. */}
            <div role="tooltip" aria-hidden="true">
              <span className="mb-1 block font-mono text-xs text-muted">{children}</span>
              {term.explanation}
            </div>
            {concept && (
              <Link
                ref={link}
                to={conceptPath(concept.id)}
                onClick={close}
                onKeyDown={onLinkKeyDown}
                className="mt-2 block text-xs text-accent hover:underline"
              >
                Read the Concept: {concept.title} →
              </Link>
            )}
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
      {terms.map((term) => {
        const concept = conceptOf(term)
        return (
          <span key={term.id} id={descriptionId(term)}>
            {term.explanation}
            {concept && ` More in the Concept: ${concept.title}. Press Enter to reach the link.`}
          </span>
        )
      })}
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
