import { addDays, formatDate, startOfWeek, todayStr, type DateStr } from './dates'

/** Calendar buckets for long-range charts: days, weeks, months or years. */
export type PeriodKind = 'day' | 'week' | 'month' | 'year'

export interface Period {
  kind: PeriodKind
  /** first day */
  start: DateStr
  /** last day (inclusive) */
  end: DateStr
}

export function periodStart(kind: PeriodKind, d: DateStr, weekStartsOn: 0 | 1): DateStr {
  switch (kind) {
    case 'day':
      return d
    case 'week':
      return startOfWeek(d, weekStartsOn)
    case 'month':
      return `${d.slice(0, 7)}-01`
    case 'year':
      return `${d.slice(0, 4)}-01-01`
  }
}

function nextStart(kind: PeriodKind, start: DateStr): DateStr {
  const y = Number(start.slice(0, 4))
  const m = Number(start.slice(5, 7))
  switch (kind) {
    case 'day':
      return addDays(start, 1)
    case 'week':
      return addDays(start, 7)
    case 'month':
      return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    case 'year':
      return `${y + 1}-01-01`
  }
}

function prevStart(kind: PeriodKind, start: DateStr): DateStr {
  const y = Number(start.slice(0, 4))
  const m = Number(start.slice(5, 7))
  switch (kind) {
    case 'day':
      return addDays(start, -1)
    case 'week':
      return addDays(start, -7)
    case 'month':
      return m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`
    case 'year':
      return `${y - 1}-01-01`
  }
}

const periodAt = (kind: PeriodKind, start: DateStr): Period => ({ kind, start, end: addDays(nextStart(kind, start), -1) })

/** The `count` periods ending with the one that contains `last`, oldest first. */
export function lastPeriods(kind: PeriodKind, last: DateStr, count: number, weekStartsOn: 0 | 1): Period[] {
  const out: Period[] = []
  let start = periodStart(kind, last, weekStartsOn)
  for (let i = 0; i < count; i++) {
    out.unshift(periodAt(kind, start))
    start = prevStart(kind, start)
  }
  return out
}

/** Every period from the one containing `first` to the one containing `last`, oldest first. */
export function periodsBetween(kind: PeriodKind, first: DateStr, last: DateStr, weekStartsOn: 0 | 1): Period[] {
  const out: Period[] = []
  for (let s = periodStart(kind, first, weekStartsOn); s <= last; s = nextStart(kind, s)) out.push(periodAt(kind, s))
  return out
}

export const inPeriod = (p: Period, d: DateStr) => d >= p.start && d <= p.end

/** Short axis label: "Mon", "17 Nov", "Nov", "2026". */
export function periodAxisLabel(p: Period): string {
  switch (p.kind) {
    case 'day':
      return formatDate(p.start, { weekday: 'short' })
    case 'week':
      return formatDate(p.start, { day: 'numeric', month: 'short' })
    case 'month':
      return formatDate(p.start, { month: 'short' })
    case 'year':
      return p.start.slice(0, 4)
  }
}

/** Full label: "This week", "Week of 17 Nov", "November 2026", "2026". */
export function periodTitle(p: Period, today: DateStr = todayStr()): string {
  const current = inPeriod(p, today)
  switch (p.kind) {
    case 'day':
      return formatDate(p.start, { weekday: 'long', day: 'numeric', month: 'short' })
    case 'week':
      return current ? 'This week' : `Week of ${formatDate(p.start, { day: 'numeric', month: 'short', year: 'numeric' })}`
    case 'month':
      return current ? 'This month' : formatDate(p.start, { month: 'long', year: 'numeric' })
    case 'year':
      return current ? 'This year' : p.start.slice(0, 4)
  }
}
