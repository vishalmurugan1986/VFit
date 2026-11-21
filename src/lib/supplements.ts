import type { Supplement, SupplementLog, SupplementTime } from '../db/types'
import { addDays, dateStrFromTs, parseDateStr, type DateStr } from './dates'

/** Display order through the day. */
export const SUPPLEMENT_TIMES: { key: SupplementTime; label: string }[] = [
  { key: 'morning', label: 'Morning' },
  { key: 'with-meal', label: 'With a meal' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'pre-workout', label: 'Before workout' },
  { key: 'post-workout', label: 'After workout' },
  { key: 'evening', label: 'Evening' },
  { key: 'bedtime', label: 'Bedtime' },
  { key: 'anytime', label: 'Any time' },
]

export const timeLabel = (t: SupplementTime) => SUPPLEMENT_TIMES.find((x) => x.key === t)?.label ?? 'Any time'

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "Every day", "Weekdays", "Weekends", or "Mon, Wed, Fri". */
export function daysLabel(days: number[]): string {
  const set = [...new Set(days)].sort((a, b) => a - b)
  if (set.length === 0 || set.length === 7) return 'Every day'
  if (set.join() === '1,2,3,4,5') return 'Weekdays'
  if (set.join() === '0,6') return 'Weekends'
  return set.map((d) => DAY_SHORT[d]).join(', ')
}

/** Is it due on this date? Paused supplements never are. */
export function isScheduled(s: Pick<Supplement, 'days' | 'paused'>, date: DateStr): boolean {
  if (s.paused) return false
  return s.days.length === 0 || s.days.includes(parseDateStr(date).getDay())
}

export interface Adherence {
  /** one entry per day, oldest first */
  days: { date: DateStr; status: 'taken' | 'missed' | 'off' }[]
  taken: number
  scheduled: number
}

/** Taken vs due over the `count` days ending on `today` (today counts only once it's taken). */
export function adherence(s: Supplement, logs: SupplementLog[], today: DateStr, count = 7): Adherence {
  const takenDates = new Set(logs.filter((l) => l.supplementId === s.id).map((l) => l.date))
  const createdDate = dateStrFromTs(s.createdAt)
  const days: Adherence['days'] = []
  let taken = 0
  let scheduled = 0
  for (let i = count - 1; i >= 0; i--) {
    const date = addDays(today, -i)
    const due = date >= createdDate && (s.days.length === 0 || s.days.includes(parseDateStr(date).getDay()))
    const done = takenDates.has(date)
    if (done) {
      days.push({ date, status: 'taken' })
      taken++
      scheduled++
    } else if (due && date !== today) {
      days.push({ date, status: 'missed' })
      scheduled++
    } else {
      days.push({ date, status: 'off' })
    }
  }
  return { days, taken, scheduled }
}
