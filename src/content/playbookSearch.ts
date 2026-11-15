import { playbook, type PlaybookEntry } from './playbook'
import { terms } from './terms'

/** What a search looks through: the question, the commands and the sample output. */
const searchable = (e: PlaybookEntry) =>
  [e.question, ...e.commands.map((c) => c.text), e.healthy.output, e.unhealthy.output].join('\n').toLowerCase()

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const asWord = (spelling: string) => new RegExp(`(?<![\\w/-])${escape(spelling)}(?![\\w-])`)

/**
 * The Entries matching a search, in Playbook order. The query matches as typed, anywhere in the
 * question, a command or the sample output. When it names a term, every other spelling of that term
 * matches too, as a whole word, so "printenv" finds an Entry that runs env.
 */
export function searchPlaybook(query: string): readonly PlaybookEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return playbook
  const spellings = terms
    .filter((t) => t.id === q || t.matches.some((m) => m.toLowerCase() === q))
    .flatMap((t) => t.matches.map((m) => asWord(m.toLowerCase())))
  return playbook.filter((e) => {
    const text = searchable(e)
    return text.includes(q) || spellings.some((s) => s.test(text))
  })
}
