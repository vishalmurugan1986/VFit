/** A local calendar date, 'YYYY-MM-DD'. Day-based records use these to avoid time-zone drift. */
export type DateStr = string

export const DAY_MS = 86_400_000

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayStr(): DateStr {
  return toDateStr(new Date())
}

export function dateStrFromTs(ts: number): DateStr {
  return toDateStr(new Date(ts))
}

export function parseDateStr(s: DateStr): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function isDateStr(s: unknown): s is DateStr {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  return toDateStr(parseDateStr(s)) === s
}

export function addDays(s: DateStr, n: number): DateStr {
  const d = parseDateStr(s)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

/** Whole calendar days from `b` to `a` (a − b). */
export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((parseDateStr(a).getTime() - parseDateStr(b).getTime()) / DAY_MS)
}

export function startOfWeek(s: DateStr, weekStartsOn: 0 | 1): DateStr {
  const dow = parseDateStr(s).getDay()
  return addDays(s, -((dow - weekStartsOn + 7) % 7))
}

/** Timestamp of local midnight at the start of the day. */
export function dayStartTs(s: DateStr): number {
  return parseDateStr(s).getTime()
}

/** Combine a date and an 'HH:MM' time into a timestamp. */
export function combineDateTime(date: DateStr, time: string): number {
  const d = parseDateStr(date)
  const [h, m] = time.split(':').map(Number)
  d.setHours(h || 0, m || 0, 0, 0)
  return d.getTime()
}

export function timeStrFromTs(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const dtfCache = new Map<string, Intl.DateTimeFormat>()
function dtf(opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(opts)
  let f = dtfCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(undefined, opts)
    dtfCache.set(key, f)
  }
  return f
}

export function formatDate(
  s: DateStr,
  opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' },
): string {
  return dtf(opts).format(parseDateStr(s))
}

export function formatTs(ts: number, opts: Intl.DateTimeFormatOptions): string {
  return dtf(opts).format(new Date(ts))
}

export function formatTime(ts: number): string {
  // Always 12-hour ("6:30 AM"), whatever the device's clock setting.
  return dtf({ hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ts))
}

/** "Today", "Yesterday", "Mon, 17 Nov", or "17 Nov 2025" outside the current year. */
export function dayLabel(s: DateStr, today: DateStr = todayStr()): string {
  const diff = diffDays(today, s)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff === -1) return 'Tomorrow'
  if (s.slice(0, 4) === today.slice(0, 4)) return formatDate(s)
  return formatDate(s, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function monthLabel(s: DateStr): string {
  return formatDate(s, { month: 'long', year: 'numeric' })
}

/** 3725 → "1h 2m", 2700 → "45m", 40 → "40s". */
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m`
  return `${sec}s`
}

/** 3725 → "1:02:05", 312 → "5:12". */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Parse "1:02:05", "5:12" or plain seconds ("90") into seconds. */
export function parseClock(text: string): number | null {
  const t = text.trim()
  if (!t) return null
  const parts = t.split(':')
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null
  return Math.round(parts.reduce((acc, p) => acc * 60 + Number(p), 0))
}
