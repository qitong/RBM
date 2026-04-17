export function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function stddev(xs: number[]): number {
  if (xs.length === 0) return 0
  const m = mean(xs)
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length
  return Math.sqrt(variance)
}

export function zScore(value: number, population: number[]): number {
  const sd = stddev(population)
  if (sd === 0) return 0
  return (value - mean(population)) / sd
}

export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0
  const sorted = [...xs].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))
  return sorted[idx]
}
