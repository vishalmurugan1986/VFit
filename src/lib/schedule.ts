import type { Routine, Session, Settings } from '../db/types'
import { parseDateStr, type DateStr } from './dates'

/** Weekday letters, Sunday first (Date.getDay order). */
export const WEEKDAYS = [
  { day: 0, short: 'S', name: 'Sunday' },
  { day: 1, short: 'M', name: 'Monday' },
  { day: 2, short: 'T', name: 'Tuesday' },
  { day: 3, short: 'W', name: 'Wednesday' },
  { day: 4, short: 'T', name: 'Thursday' },
  { day: 5, short: 'F', name: 'Friday' },
  { day: 6, short: 'S', name: 'Saturday' },
] as const

export const DEFAULT_SESSIONS: Settings['sessions'] = { morning: '06:00', evening: '19:00' }

export const sessionLabel = (s: Session) => (s === 'morning' ? 'Morning' : 'Evening')

/** Weekdays in the order your week starts. */
export function orderedWeekdays(weekStartsOn: 0 | 1) {
  return weekStartsOn === 1 ? [...WEEKDAYS.slice(1), WEEKDAYS[0]] : [...WEEKDAYS]
}

/** Routines planned for a date, morning ones first. */
export function routinesOn(routines: Routine[], date: DateStr): Routine[] {
  const day = parseDateStr(date).getDay()
  return routines
    .filter((r) => r.days?.includes(day))
    .sort((a, b) => (a.session === 'evening' ? 1 : 0) - (b.session === 'evening' ? 1 : 0))
}

/** "Mon, Thu" (in week order), "Every day" or "" when not scheduled. */
export function daysLabel(days: number[] | undefined, weekStartsOn: 0 | 1): string {
  if (!days?.length) return ''
  if (days.length === 7) return 'Every day'
  return orderedWeekdays(weekStartsOn)
    .filter((d) => days.includes(d.day))
    .map((d) => d.name.slice(0, 3))
    .join(', ')
}

const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Which of your two sessions a workout started at belongs to: whichever time it's closer to. */
export function sessionOf(ts: number, sessions: Settings['sessions']): Session {
  const d = new Date(ts)
  const now = d.getHours() * 60 + d.getMinutes()
  const mid = (minutes(sessions.morning) + minutes(sessions.evening)) / 2
  return now < mid ? 'morning' : 'evening'
}
