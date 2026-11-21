import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus, Dumbbell } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, EmptyState, PageHeader, PageLoading, SectionHeader } from '../../components/ui'
import { db } from '../../db/db'
import { useExercises } from '../../db/queries'
import { useSettings } from '../../db/settings'
import type { Exercise, Workout } from '../../db/types'
import { dateStrFromTs, dayLabel, formatDuration, monthLabel } from '../../lib/dates'
import { sessionLabel, sessionOf } from '../../lib/schedule'
import { bestSet, formatSet, isWorking, workoutStats } from '../../lib/strength'
import { fmtVolume, type WeightUnit } from '../../lib/units'
import { createPastWorkout } from './actions'
import { TrainingChart } from './TrainingChart'

const PAGE = 20

/** /workouts/history: every finished workout, plus workouts per week, month or year. */
export default function WorkoutHistoryPage() {
  const navigate = useNavigate()
  const { weightUnit: unit, sessions } = useSettings()
  const { map } = useExercises()
  const [limit, setLimit] = useState(PAGE)
  const history = useLiveQuery(
    () =>
      db.workouts
        .orderBy('startedAt')
        .reverse()
        .filter((w) => w.finishedAt != null)
        .limit(limit + 1)
        .toArray(),
    [limit],
  )

  const logPast = async () => {
    const id = await createPastWorkout()
    navigate(`/workouts/${id}?edit=1`)
  }

  const shown = history?.slice(0, limit) ?? []
  const groups: { label: string; items: Workout[] }[] = []
  for (const w of shown) {
    const label = monthLabel(dateStrFromTs(w.startedAt))
    const last = groups[groups.length - 1]
    if (last?.label === label) last.items.push(w)
    else groups.push({ label, items: [w] })
  }

  return (
    <>
      <PageHeader
        back="/workouts"
        title="History"
        actions={
          <Button size="sm" variant="ghost" onClick={() => void logPast()}>
            <CalendarPlus />
            Log past
          </Button>
        }
      />

      <TrainingChart />

      <SectionHeader title="Workouts" />
      {history === undefined ? (
        <PageLoading />
      ) : history.length === 0 ? (
        <EmptyState icon={<Dumbbell />} title="No workouts yet">
          Start one of your routines and tick off sets as you go. It shows up here when you finish.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.label}>
              <h3 className="mb-2 text-footnote font-medium text-ink-2">{g.label}</h3>
              <div className="flex flex-col gap-2">
                {g.items.map((w) => (
                  <WorkoutCard
                    key={w.id}
                    workout={w}
                    exercises={map}
                    unit={unit}
                    session={sessionLabel(sessionOf(w.startedAt, sessions))}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {history && history.length > limit && (
        <Button full className="mt-4" onClick={() => setLimit((l) => l + PAGE)}>
          Show more
        </Button>
      )}
    </>
  )
}

function WorkoutCard({
  workout,
  exercises,
  unit,
  session,
}: {
  workout: Workout
  exercises: Map<string, Exercise>
  unit: WeightUnit
  session: string
}) {
  const stats = workoutStats(workout)
  const lines = workout.exercises.slice(0, 4).map((we) => {
    const ex = exercises.get(we.exerciseId)
    const kind = ex?.kind ?? 'weight'
    const best = bestSet(we.sets, kind)
    const count = we.sets.filter(isWorking).length
    return { id: we.id, text: `${count} × ${ex?.name ?? 'Unknown'}`, best: best ? formatSet(best, kind, unit) : null }
  })
  const more = workout.exercises.length - lines.length
  return (
    <Link
      to={`/workouts/${workout.id}`}
      className="block rounded-xl bg-surface p-4 transition-colors hover:bg-fill/60 active:bg-fill"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate font-semibold">{workout.name}</p>
        <p className="shrink-0 text-footnote text-ink-2">
          {dayLabel(dateStrFromTs(workout.startedAt))} · {session}
        </p>
      </div>
      <p className="mt-0.5 text-footnote text-ink-2 tabular-nums">
        {formatDuration(stats.durationSec)} · {stats.sets} sets · {fmtVolume(stats.volumeKg, unit)}
      </p>
      {lines.length > 0 && (
        <ul className="mt-2.5 flex flex-col gap-0.5 text-subhead">
          {lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{l.text}</span>
              {l.best && <span className="shrink-0 text-ink-2 tabular-nums">{l.best}</span>}
            </li>
          ))}
          {more > 0 && <li className="text-ink-2">+{more} more</li>}
        </ul>
      )}
    </Link>
  )
}
