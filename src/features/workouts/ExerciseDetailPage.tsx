import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, ArchiveRestore, Ellipsis, Pencil, Trash } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ChartTable } from '../../components/chartParts'
import { TimeChart } from '../../components/charts'
import { useConfirm } from '../../components/confirm'
import { useToast } from '../../components/toast'
import {
  ActionSheet,
  Card,
  EmptyState,
  IconButton,
  NotFound,
  PageHeader,
  PageLoading,
  SectionHeader,
  Segmented,
  Sheet,
  Stat,
} from '../../components/ui'
import { db } from '../../db/db'
import { workoutsWithExercise } from '../../db/queries'
import { useSettings } from '../../db/settings'
import { exerciseMeta, type WorkoutSet } from '../../db/types'
import { addDays, dateStrFromTs, dayLabel, dayStartTs, formatClock, formatDate, todayStr } from '../../lib/dates'
import { e1rm, formatSet, formatSetShort, isWorking, sessionBest } from '../../lib/strength'
import { fmtNum, kgTo } from '../../lib/units'
import { ExerciseForm } from './ExercisePicker'

type RangeKey = '3M' | '6M' | '1Y' | 'All'
const RANGES: { value: RangeKey; days: number | null }[] = [
  { value: '3M', days: 91 },
  { value: '6M', days: 182 },
  { value: '1Y', days: 365 },
  { value: 'All', days: null },
]

export default function ExerciseDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const unit = useSettings().weightUnit
  const [editing, setEditing] = useState(false)
  const [menu, setMenu] = useState(false)
  const [range, setRange] = useState<RangeKey>('1Y')

  const exercise = useLiveQuery(async () => (await db.exercises.get(id)) ?? null, [id])
  const sessions = useLiveQuery(
    async () =>
      (await workoutsWithExercise(id))
        .filter((w) => w.finishedAt != null)
        .sort((a, b) => b.startedAt - a.startedAt),
    [id],
  )
  const inRoutines = useLiveQuery(
    () => db.routines.filter((r) => r.exercises.some((e) => e.exerciseId === id)).count(),
    [id],
  )

  if (exercise === undefined || sessions === undefined) return <PageLoading />
  if (exercise === null) return <NotFound title="Exercise not found" back="/exercises" />

  const kind = exercise.kind
  const rows = sessions.map((w) => {
    const sets = w.exercises.filter((e) => e.exerciseId === id).flatMap((e) => e.sets)
    return { w, date: dateStrFromTs(w.startedAt), sets, best: sessionBest(sets, kind) }
  })

  let bestE1rm = 0
  let bestSet: WorkoutSet | null = null
  let heaviest = 0
  let mostReps = 0
  let totalReps = 0
  let longest = 0
  for (const r of rows) {
    for (const s of r.sets.filter(isWorking)) {
      const est = e1rm(s.weight ?? 0, s.reps ?? 0)
      if (est > bestE1rm) {
        bestE1rm = est
        bestSet = s
      }
      if ((s.reps ?? 0) > 0 && (s.weight ?? 0) > heaviest) heaviest = s.weight ?? 0
      mostReps = Math.max(mostReps, s.reps ?? 0)
      totalReps += s.reps ?? 0
      longest = Math.max(longest, s.durationSec ?? 0)
    }
  }

  const toDisplay = (v: number) => (kind === 'weight' ? kgTo(v, unit) : v)
  const format = (v: number) =>
    kind === 'weight' ? `${fmtNum(v, 1)} ${unit}` : kind === 'bodyweight' ? `${fmtNum(v)} reps` : formatClock(v)
  const metricLabel = kind === 'weight' ? 'Estimated 1-rep max' : kind === 'bodyweight' ? 'Most reps in a set' : 'Longest set'
  // One point per day: the best set that day (two sessions on one day would draw a vertical line).
  const bestByDay = new Map<string, number>()
  for (const r of rows) if (r.best > 0) bestByDay.set(r.date, Math.max(bestByDay.get(r.date) ?? 0, r.best))
  const days = RANGES.find((r) => r.value === range)?.days ?? null
  const cutoff = days == null ? '' : addDays(todayStr(), -days)
  const chartData = [...bestByDay]
    .filter(([date]) => date >= cutoff)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, best]) => ({ t: dayStartTs(date), v: toDisplay(best) }))
  // How much the best set improved over the range shown.
  const firstBest = chartData[0]?.v
  const lastBest = chartData[chartData.length - 1]?.v
  const gain = chartData.length > 1 && firstBest ? lastBest - firstBest : null

  const used = rows.length > 0 || (inRoutines ?? 0) > 0

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${exercise.name}?`,
      message: 'It will be removed from your exercise library.',
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    navigate('/exercises', { replace: true })
    await db.exercises.delete(exercise.id)
    toast('Exercise deleted', { action: { label: 'Undo', onClick: () => void db.exercises.put(exercise) } })
  }

  const setArchived = async (archived: boolean) => {
    await db.exercises.update(exercise.id, { archived })
    toast(archived ? 'Archived: hidden from the exercise picker' : 'Restored to the exercise picker')
  }

  return (
    <>
      <PageHeader
        back="/exercises"
        title={exercise.name}
        subtitle={`${exerciseMeta(exercise)}${exercise.archived ? ' · Archived' : ''}`}
        actions={
          <IconButton label="Exercise options" onClick={() => setMenu(true)}>
            <Ellipsis />
          </IconButton>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No sessions yet">
          Log {exercise.name} in a workout and your records and progress chart will appear here.
        </EmptyState>
      ) : (
        <>
          <Card className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {kind === 'weight' && (
              <>
                <Stat label="Best e1RM" value={fmtNum(kgTo(bestE1rm, unit))} unit={unit} />
                <Stat label="Heaviest" value={fmtNum(kgTo(heaviest, unit), 1)} unit={unit} />
                <Stat label="Best set" value={bestSet ? formatSet(bestSet, kind, unit) : '–'} />
              </>
            )}
            {kind === 'bodyweight' && (
              <>
                <Stat label="Most reps" value={mostReps} />
                <Stat label="Total reps" value={fmtNum(totalReps)} />
              </>
            )}
            {kind === 'time' && <Stat label="Longest" value={formatClock(longest)} />}
            <Stat label="Sessions" value={rows.length} />
          </Card>

          <Card className="mt-3">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{metricLabel}</h2>
                <p className="text-footnote text-ink-2">
                  Best set each day
                  {gain != null &&
                    ` · ${gain >= 0 ? '+' : '−'}${format(Math.abs(gain))} (${gain >= 0 ? '+' : '−'}${fmtNum(Math.abs((gain / firstBest!) * 100))}%) over this time`}
                </p>
              </div>
              <Segmented
                size="sm"
                ariaLabel="Time range"
                value={range}
                onChange={setRange}
                options={RANGES.map((r) => ({ value: r.value, label: r.value }))}
              />
            </div>
            {chartData.length === 0 ? (
              <p className="py-12 text-center text-footnote text-ink-2">No sessions in this time range.</p>
            ) : (
              <TimeChart
                data={chartData}
                color="var(--strength)"
                format={format}
                seriesLabel={metricLabel}
                ariaLabel={`${metricLabel} for ${exercise.name} over time`}
              />
            )}
            <ChartTable
              columns={['Date', metricLabel]}
              rows={[...chartData].reverse().map((p) => [formatDate(dateStrFromTs(p.t), { day: 'numeric', month: 'short', year: 'numeric' }), format(p.v)])}
            />
          </Card>

          <SectionHeader title="History" />
          <Card padded={false}>
            <ul className="divide-y-[0.5px] divide-bar-line">
              {rows.map((r) => (
                <li key={r.w.id}>
                  <Link to={`/workouts/${r.w.id}`} className="block px-4 py-3 transition-colors hover:bg-fill/60 active:bg-fill">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-medium">{dayLabel(r.date)}</p>
                      <p className="truncate text-footnote text-ink-2">{r.w.name}</p>
                    </div>
                    <p className="mt-0.5 text-footnote text-ink-2 tabular-nums">
                      {r.sets
                        .filter((s) => s.done)
                        .map((s) => (s.warmup ? `(${formatSetShort(s, kind, unit)})` : formatSetShort(s, kind, unit)))
                        .join(' · ')}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <Sheet open={editing} onClose={() => setEditing(false)} title="Edit exercise">
        <ExerciseForm exercise={exercise} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
      </Sheet>

      <ActionSheet
        open={menu}
        onClose={() => setMenu(false)}
        title={exercise.name}
        actions={[
          { label: 'Edit', icon: <Pencil />, onSelect: () => setEditing(true) },
          exercise.archived
            ? { label: 'Restore to picker', icon: <ArchiveRestore />, onSelect: () => void setArchived(false) }
            : { label: 'Archive (hide from picker)', icon: <Archive />, onSelect: () => void setArchived(true) },
          ...(used
            ? []
            : [{ label: 'Delete exercise', icon: <Trash />, danger: true, onSelect: () => void remove() }]),
        ]}
      />
    </>
  )
}
