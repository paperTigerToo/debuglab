import { useCallback, useState } from 'react'
import { readStored, writeStored } from './storage'

export type Theme = 'dark' | 'light'
const KEY = 'debuglab.theme'

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

export function initialTheme(): Theme {
  const stored = readStored(KEY)
  return stored === 'light' || stored === 'dark' ? stored : currentTheme()
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const setTheme = useCallback((next: Theme) => {
    document.documentElement.dataset.theme = next
    writeStored(KEY, next)
    setThemeState(next)
  }, [])
  const toggle = useCallback(() => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'), [setTheme])
  return { theme, toggle }
}
