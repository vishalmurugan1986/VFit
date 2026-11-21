import {
  Activity,
  Bike,
  Dumbbell,
  Footprints,
  Gauge,
  HeartPulse,
  Mountain,
  PersonStanding,
  Ship,
  Timer,
  WavesLadder,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { CardioIcon } from '../../db/types'

export const CARDIO_ICONS: Record<CardioIcon, LucideIcon> = {
  walk: PersonStanding,
  run: Footprints,
  bike: Bike,
  swim: WavesLadder,
  elliptical: Gauge,
  hike: Mountain,
  row: Ship,
  activity: Activity,
  heart: HeartPulse,
  zap: Zap,
  dumbbell: Dumbbell,
  timer: Timer,
}

export const CARDIO_ICON_KEYS = Object.keys(CARDIO_ICONS) as CardioIcon[]
