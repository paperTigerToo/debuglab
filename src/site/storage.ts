// Browser storage that never throws: private windows and blocked storage
// make localStorage unavailable, and the site must still work.
export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable: the choice lasts for this page view only.
  }
}
