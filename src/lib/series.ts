import { DAY_MS } from './dates'

export interface Point {
  /** timestamp (local midnight for day-based data) */
  t: number
  v: number
}

/**
 * Trailing moving average over calendar days: each point averages every value
 * from the previous `windowDays` days, inclusive of its own day.
 */
export function movingAverage(points: Point[], windowDays = 7): Array<Point & { avg: number }> {
  const sorted = [...points].sort((a, b) => a.t - b.t)
  const out: Array<Point & { avg: number }> = []
  let start = 0
  let sum = 0
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i].v
    while (Math.round((sorted[i].t - sorted[start].t) / DAY_MS) >= windowDays) {
      sum -= sorted[start].v
      start++
    }
    out.push({ ...sorted[i], avg: sum / (i - start + 1) })
  }
  return out
}

/**
 * A y-axis that reads cleanly: round tick steps (1, 2, 2.5 or 5 × 10ⁿ) covering the data
 * with a little breathing room. Ranges narrower than `minSpan` are widened around their middle.
 */
export function niceScale(values: number[], minSpan = 1, maxTicks = 5): { domain: [number, number]; ticks: number[] } {
  if (values.length === 0) return { domain: [0, 1], ticks: [0, 1] }
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  if (hi - lo < minSpan) {
    const mid = (lo + hi) / 2
    lo = mid - minSpan / 2
    hi = mid + minSpan / 2
  }
  const pad = (hi - lo) * 0.08
  lo -= pad
  hi += pad
  const rawStep = (hi - lo) / (maxTicks - 1)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? 10 * magnitude
  const start = Math.floor(lo / step) * step
  const end = Math.ceil(hi / step) * step
  const ticks: number[] = []
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks }
}

/** Latest value on or before `date` from records sorted ascending by date. */
export function valueOnOrBefore<T extends { date: string }>(
  sortedAsc: T[],
  date: string,
  get: (r: T) => number | null | undefined,
): number | null {
  for (let i = sortedAsc.length - 1; i >= 0; i--) {
    const r = sortedAsc[i]
    if (r.date > date) continue
    const v = get(r)
    if (v != null) return v
  }
  return null
}
