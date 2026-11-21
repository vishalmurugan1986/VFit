import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardList, Ellipsis, Pencil, RotateCcw, Trash, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useConfirm } from '../../components/confirm'
import { useToast } from '../../components/toast'
import { ActionSheet, Button, Card, IconButton, PageHeader, Stat } from '../../components/ui'
import { db } from '../../db/db'
import { useExercises, workoutsWithExercise } from '../../db/queries'
import { useSettings } from '../../db/settings'
import type { Workout } from '../../db/types'
import { dateStrFromTs, dayLabel, formatDuration, formatTime } from '../../lib/dates'
import { e1rm, findPRs, formatSet, PR_LABELS, workoutStats } from '../../lib/strength'
import { fmtNum, kgTo } from '../../lib/units'
import { saveWorkoutAsRoutine, templateFromWorkout, useStartWorkout } from './actions'

/** A finished workout: stats, every set, and any personal records it set. */
export function WorkoutSummary({ workout, onEdit }: { workout: Workout; onEdit: () => void }) {
  const unit = useSettings().weightUnit
  const { map, kindOf, loaded } = useExercises()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const startWorkout = useStartWorkout()
  const [menu, setMenu] = useState(false)

  const prs = useLiveQuery(async () => {
    if (!loaded) return undefined
    const lists = await Promise.all(workout.exerciseIds.map((id) => workoutsWithExercise(id)))
    return findPRs(workout, lists.flat(), kindOf)
  }, [workout, kindOf, loaded])

  const stats = workoutStats(workout)

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete workout?',
      message: 'It will be removed from your history.',
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    navigate('/workouts', { replace: true })
    await db.workouts.delete(workout.id)
    toast('Workout deleted', { action: { label: 'Undo', onClick: () => void db.workouts.put(workout) } })
  }

  const saveRoutine = async () => {
    await saveWorkoutAsRoutine(workout)
    toast('Saved as a routine')
  }

  const repeat = () => void startWorkout(templateFromWorkout(workout))

  return (
    <>
      <PageHeader
        back="/workouts"
        title={workout.name}
        subtitle={`${dayLabel(dateStrFromTs(workout.startedAt))} · ${formatTime(workout.startedAt)}`}
        actions={
          <>
            <Button size="sm" onClick={onEdit}>
              <Pencil />
              Edit
            </Button>
            <IconButton label="More actions" onClick={() => setMenu(true)}>
              <Ellipsis />
            </IconButton>
          </>
        }
      />

      <Card className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Duration" value={formatDuration(stats.durationSec)} />
        <Stat label="Volume" value={fmtNum(kgTo(stats.volumeKg, unit))} unit={unit} />
        <Stat label="Working sets" value={stats.sets} />
        <Stat label="Personal records" value={prs ? prs.size : '–'} />
      </Card>

      {workout.note?.trim() && <Card className="mt-3 text-footnote whitespace-pre-wrap text-ink-2">{workout.note}</Card>}

      <div className="mt-3 flex flex-col gap-3">
        {workout.exercises.map((we) => {
          const ex = map.get(we.exerciseId)
          const kind = ex?.kind ?? 'weight'
          let n = 0
          return (
            <Card key={we.id}>
              <Link to={`/exercises/${we.exerciseId}`} className="font-semibold hover:underline">
                {ex?.name ?? 'Unknown exercise'}
              </Link>
              {we.note && <p className="mt-0.5 text-footnote text-ink-2">{we.note}</p>}
              <ol className="mt-2 flex flex-col">
                {we.sets.map((s) => {
                  if (!s.warmup) n++
                  const pr = prs?.get(s.id)
                  const est = kind === 'weight' && s.weight && s.reps && s.reps > 1 ? e1rm(s.weight, s.reps) : null
                  return (
                    <li
                      key={s.id}
                      className="flex min-h-10 items-center gap-3 border-t-[0.5px] border-bar-line py-1.5 text-subhead tabular-nums first:border-t-0"
                    >
                      <span className="w-6 shrink-0 text-center text-footnote font-semibold text-ink-2">
                        {s.warmup ? 'W' : n}
                      </span>
                      <span className="min-w-0 flex-1">{formatSet(s, kind, unit)}</span>
                      {pr ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/25 px-2 py-0.5 text-footnote font-semibold text-ink">
                          <Trophy className="size-3.5" aria-hidden />
                          {pr.map((k) => PR_LABELS[k]).join(' · ')}
                        </span>
                      ) : (
                        est && <span className="text-footnote text-ink-2">e1RM {fmtNum(kgTo(est, unit))}</span>
                      )}
                    </li>
                  )
                })}
              </ol>
            </Card>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button onClick={repeat}>
          <RotateCcw />
          Repeat
        </Button>
        <Button onClick={() => void saveRoutine()}>
          <ClipboardList />
          Save as routine
        </Button>
      </div>

      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={workout.name}
        actions={[
          { label: 'Edit workout', icon: <Pencil />, onSelect: onEdit },
          { label: 'Repeat this workout', icon: <RotateCcw />, onSelect: repeat },
          { label: 'Save as routine', icon: <ClipboardList />, onSelect: () => void saveRoutine() },
          { label: 'Delete workout', icon: <Trash />, danger: true, onSelect: () => void remove() },
        ]}
      />
    </>
  )
}
