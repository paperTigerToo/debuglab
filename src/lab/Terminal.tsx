import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { complete, prompt, step } from '../engine/engine'
import type { IncidentDefinition, Line, SessionState } from '../engine/types'
import { STREAM_MAX_MS, STREAM_STEP_MS } from '../site/motion'
import { Annotated } from '../site/Term'

type Props = {
  incident: IncidentDefinition
  state: SessionState
  onState: (state: SessionState) => void
}

// The terminal stays dark in both site themes, like a real one, so its colours are fixed.
const lineStyle: Record<Line['kind'], string> = {
  input: 'text-[#d8e1eb]',
  output: 'text-[#c3cdd8]',
  error: 'text-[#ff5d6c]',
  notice: 'text-[#5cc8ff]',
  warning: 'text-[#f5b84a]',
}

export function Terminal({ incident, state, onState }: Props) {
  const [lines, setLines] = useState<readonly Line[]>([
    { kind: 'notice', text: 'Type help to see how this terminal works.' },
  ])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<readonly string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [lines])

  function run() {
    const result = step(incident, state, { kind: 'command', text: input })
    onState(result.state)
    setLines((previous) => (result.clear ? result.display : [...previous, ...result.display]))
    if (input.trim()) setHistory((h) => [...h, input])
    setHistoryIndex(null)
    setInput('')
  }

  function recall(direction: -1 | 1) {
    if (history.length === 0) return
    const current = historyIndex ?? history.length
    const next = Math.min(history.length, Math.max(0, current + direction))
    setHistoryIndex(next === history.length ? null : next)
    setInput(next === history.length ? '' : (history[next] ?? ''))
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      run()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      recall(-1)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      recall(1)
    } else if (event.key === 'Tab') {
      event.preventDefault()
      const completion = complete(incident, state, input)
      setInput(completion.text)
      if (completion.options.length > 0) {
        setLines((previous) => [
          ...previous,
          { kind: 'input', prompt: prompt(state), text: input },
          { kind: 'output', text: completion.options.join('    ') },
        ])
      }
    } else if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault()
      setLines([])
    }
  }

  // Each term is marked once across the whole log, not on every line it appears in.
  const seen = new Set<string>()

  return (
    <section
      aria-label="Terminal"
      className="flex h-[32rem] flex-col overflow-hidden rounded-lg border border-line bg-[#06090d] font-mono text-[13px] leading-relaxed text-[#d8e1eb]"
      onClick={() => {
        if (!window.getSelection()?.toString()) inputRef.current?.focus()
      }}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-xs text-white/50">
        <span className="size-2.5 rounded-full bg-danger/80" />
        <span className="size-2.5 rounded-full bg-warn/80" />
        <span className="size-2.5 rounded-full bg-accent/80" />
        <span className="ml-2">terminal: namespace {incident.namespace}</span>
      </div>
      <div role="log" aria-live="polite" aria-label="Terminal output" className="flex-1 overflow-y-auto px-3 py-2">
        {lines.map((line, i) => (
          <div key={i} className={`whitespace-pre-wrap break-words ${lineStyle[line.kind]}`}>
            {line.kind === 'input' ? (
              <>
                <span className="text-[#3ddc97]">{line.prompt}</span> <Annotated text={line.text} seen={seen} />
              </>
            ) : (
              // Output streams in a line at a time, fast enough not to keep you waiting.
              line.text.split('\n').map((text, j) => (
                <span key={j} className="block animate-stream" style={{ animationDelay: `${Math.min(j * STREAM_STEP_MS, STREAM_MAX_MS)}ms` }}>
                  {text ? <Annotated text={text} seen={seen} /> : ' '}
                </span>
              ))
            )}
          </div>
        ))}
        <div className="flex items-center gap-2" ref={endRef}>
          <label htmlFor="terminal-input" className="shrink-0 text-[#3ddc97]">
            {prompt(state)}
          </label>
          <input
            id="terminal-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Command"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-[#d8e1eb] caret-[#3ddc97] outline-none focus-visible:outline-none"
          />
        </div>
      </div>
    </section>
  )
}
