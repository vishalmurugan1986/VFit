import type { CardioMeasure, CardioSession } from '../db/types'
import { formatClock } from './dates'
import { fmtNum } from './units'

export const CARDIO_MEASURES: { key: CardioMeasure; label: string; hint: string }[] = [
  { key: 'pace', label: 'Distance + pace', hint: 'min/km, like walking or running' },
  { key: 'speed', label: 'Distance + speed', hint: 'km/h, like cycling' },
  { key: 'time', label: 'Time only', hint: 'no distance, like skipping or a class' },
]

/** Whether the log form asks for a distance. */
export const usesDistance = (m: CardioMeasure) => m !== 'time'

/** Pace or speed as each sport reads it: "5:12 /km", "24.3 km/h", "2:05 /100 m". */
export function paceLabel(measure: CardioMeasure, distanceKm: number | null, durationSec: number): string | null {
  if (!distanceKm || distanceKm <= 0 || !(durationSec > 0)) return null
  switch (measure) {
    case 'pace':
      return `${formatClock(durationSec / distanceKm)} /km`
    case 'speed':
      return `${fmtNum(distanceKm / (durationSec / 3600), 1)} km/h`
    case 'swim':
      return `${formatClock(durationSec / (distanceKm * 10))} /100 m`
    default:
      return null
  }
}

export interface CardioTotals {
  distanceKm: number
  durationSec: number
  sessions: number
}

export function cardioTotals(sessions: CardioSession[]): CardioTotals {
  return sessions.reduce<CardioTotals>(
    (t, s) => ({
      distanceKm: t.distanceKm + (s.distanceKm ?? 0),
      durationSec: t.durationSec + s.durationSec,
      sessions: t.sessions + 1,
    }),
    { distanceKm: 0, durationSec: 0, sessions: 0 },
  )
}
