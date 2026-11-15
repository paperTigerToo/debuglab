/** The closest word within a small edit distance, or undefined. */
export function closest(word: string, candidates: readonly string[]): string | undefined {
  let best: string | undefined
  let bestDistance = Math.max(1, Math.min(2, Math.floor(word.length / 3)))
  for (const candidate of candidates) {
    const d = editDistance(word, candidate)
    if (d <= bestDistance && (best === undefined || d < bestDistance)) {
      best = candidate
      bestDistance = d
    }
  }
  return best
}

/** Damerau–Levenshtein (optimal string alignment): a swapped pair of letters counts as one edit. */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1)
      d[i]![j] = v
    }
  }
  return d[a.length]![b.length]!
}
