import { ChevronRight, Timer } from 'lucide-react'
import { Link } from 'react-router'
import type { Workout } from '../../db/types'
import { formatClock } from '../../lib/dates'
import { useNow } from '../../lib/hooks'

export function ActiveWorkoutBanner({ workout }: { workout: Workout }) {
  const now = useNow(1000)
  return (
    <Link
      to={`/workouts/${workout.id}`}
      className="flex items-center gap-3 rounded-xl border border-accent-line bg-accent-soft p-3 pr-4 transition-[transform,opacity] active:scale-[0.99] active:opacity-80"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-on-accent">
        <Timer className="size-5 animate-pulse motion-reduce:animate-none" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-headline">Workout in progress</span>
        <span className="block truncate text-footnote text-ink-2 tabular-nums">
          {workout.name} · {formatClock((now - workout.startedAt) / 1000)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-body font-semibold text-accent-ink">
        Resume
        <ChevronRight className="size-5" aria-hidden />
      </span>
    </Link>
  )
}
