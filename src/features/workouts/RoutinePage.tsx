import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDown, ArrowUp, Ellipsis, Play, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useConfirm } from '../../components/confirm'
import { useToast } from '../../components/toast'
import {
  ActionSheet,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  NotFound,
  NumberField,
  PageHeader,
  PageLoading,
  Segmented,
  Stepper,
  TextInput,
} from '../../components/ui'
import { db } from '../../db/db'
import { useExercises } from '../../db/queries'
import { useSettings } from '../../db/settings'
import type { Routine, Session } from '../../db/types'
import { cn } from '../../lib/cn'
import { combineDateTime, formatTime, todayStr } from '../../lib/dates'
import { orderedWeekdays, sessionLabel } from '../../lib/schedule'
import { uid } from '../../lib/id'
import { templateFromRoutine, useStartWorkout } from './actions'
import { ExercisePicker } from './ExercisePicker'

/** /routines/:id (or /routines/new): build a reusable workout template. */
export default function RoutinePage() {
  const { id = 'new' } = useParams()
  const isNew = id === 'new'
  const routine = useLiveQuery(async () => (isNew ? null : ((await db.routines.get(id)) ?? null)), [id, isNew])
  if (!isNew && routine === undefined) return <PageLoading />
  if (!isNew && routine === null) return <NotFound title="Routine not found" back="/workouts" />
  return <RoutineEditor key={id} initial={routine ?? undefined} />
}

function RoutineEditor({ initial }: { initial?: Routine }) {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const start = useStartWorkout()
  const { map } = useExercises()
  const { weekStartsOn, sessions } = useSettings()
  const [r, setR] = useState<Routine>(
    () => initial ?? { id: uid(), name: '', exercises: [], createdAt: Date.now(), updatedAt: Date.now() },
  )
  const [pickerOpen, setPickerOpen] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const persist = async (): Promise<Routine> => {
    const saved = { ...r, name: r.name.trim() || 'Routine', updatedAt: Date.now() }
    await db.routines.put(saved)
    return saved
  }

  const save = async () => {
    await persist()
    toast('Routine saved')
    navigate('/workouts')
  }

  const saveAndStart = async () => {
    const saved = await persist()
    await start(templateFromRoutine(saved))
  }

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete routine?',
      message: 'Workouts you already logged from it are kept.',
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    navigate('/workouts', { replace: true })
    await db.routines.delete(r.id)
    if (initial) toast('Routine deleted', { action: { label: 'Undo', onClick: () => void db.routines.put(initial) } })
  }

  const move = (rowId: string, dir: -1 | 1) =>
    setR((x) => {
      const i = x.exercises.findIndex((e) => e.id === rowId)
      const j = i + dir
      if (i < 0 || j < 0 || j >= x.exercises.length) return x
      const list = [...x.exercises]
      ;[list[i], list[j]] = [list[j], list[i]]
      return { ...x, exercises: list }
    })

  const patchRow = (rowId: string, patch: Partial<Routine['exercises'][number]>) =>
    setR((x) => ({ ...x, exercises: x.exercises.map((e) => (e.id === rowId ? { ...e, ...patch } : e)) }))

  const menuRow = r.exercises.find((e) => e.id === menuFor)
  const canSave = r.name.trim().length > 0 || r.exercises.length > 0

  return (
    <>
      <PageHeader
        back="/workouts"
        title={initial ? 'Edit routine' : 'New routine'}
        actions={
          <Button size="sm" variant="primary" disabled={!canSave} onClick={() => void save()}>
            Save
          </Button>
        }
      />

      <Field label="Name">
        <TextInput
          value={r.name}
          placeholder="e.g. Push day"
          maxLength={80}
          onChange={(e) => setR((x) => ({ ...x, name: e.target.value }))}
        />
      </Field>

      <div className="mt-4">
        <p className="mb-1.5 text-footnote font-medium text-ink-2">Days</p>
        <div className="flex gap-1.5" role="group" aria-label="Days this routine is planned for">
          {orderedWeekdays(weekStartsOn).map((d) => {
            const on = r.days?.includes(d.day) ?? false
            return (
              <button
                key={d.day}
                type="button"
                aria-pressed={on}
                aria-label={d.name}
                onClick={() =>
                  setR((x) => ({
                    ...x,
                    days: on ? (x.days ?? []).filter((v) => v !== d.day) : [...(x.days ?? []), d.day].sort(),
                  }))
                }
                className={cn(
                  'grid size-10 flex-1 place-items-center rounded-full text-subhead font-semibold transition-colors',
                  on ? 'bg-accent text-on-accent' : 'bg-fill text-ink-2 hover:text-ink',
                )}
              >
                {d.short}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-footnote font-medium text-ink-2">Session</p>
        <Segmented<'any' | Session>
          full
          ariaLabel="Gym session"
          value={r.session ?? 'any'}
          onChange={(v) => setR((x) => ({ ...x, session: v === 'any' ? null : v }))}
          options={[
            ...(['morning', 'evening'] as const).map((s) => ({ value: s, label: sessionLabel(s) })),
            { value: 'any' as const, label: 'Any time' },
          ]}
        />
        <p className="mt-1.5 text-footnote text-ink-2">
          Morning is {formatTime(combineDateTime(todayStr(), sessions.morning))}, evening{' '}
          {formatTime(combineDateTime(todayStr(), sessions.evening))}. Change your gym times in Settings → Alarms.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        {r.exercises.length === 0 && (
          <EmptyState title="No exercises yet">Add the exercises you do in this session, in order.</EmptyState>
        )}
        {r.exercises.map((row) => (
          <Card key={row.id} className="p-3">
            <div className="flex items-center gap-2">
              <p className="min-w-0 flex-1 truncate pl-1 font-medium">{map.get(row.exerciseId)?.name ?? 'Unknown'}</p>
              <IconButton size="sm" label="Exercise options" onClick={() => setMenuFor(row.id)}>
                <Ellipsis />
              </IconButton>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 pl-1">
              <span className="flex items-center gap-2 text-footnote text-ink-2">
                Sets
                <Stepper label="Sets" value={row.sets} min={1} max={10} onChange={(v) => patchRow(row.id, { sets: v })} />
              </span>
              <label className="flex items-center gap-2 text-footnote text-ink-2">
                Target reps
                <NumberField
                  size="sm"
                  integer
                  className="w-16"
                  value={row.reps}
                  placeholder="–"
                  onValueChange={(v) => patchRow(row.id, { reps: v && v > 0 ? v : null })}
                />
              </label>
            </div>
          </Card>
        ))}
        <Button variant="outline" full onClick={() => setPickerOpen(true)}>
          <Plus />
          Add exercises
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <Button variant="primary" size="lg" full disabled={r.exercises.length === 0} onClick={() => void saveAndStart()}>
          <Play />
          Save and start workout
        </Button>
        {initial && (
          <Button variant="danger-ghost" full onClick={() => void remove()}>
            <Trash />
            Delete routine
          </Button>
        )}
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(ids) =>
          setR((x) => ({
            ...x,
            exercises: [...x.exercises, ...ids.map((exerciseId) => ({ id: uid(), exerciseId, sets: 3, reps: null }))],
          }))
        }
      />

      <ActionSheet
        open={menuRow !== undefined}
        onClose={() => setMenuFor(null)}
        title={(menuRow && map.get(menuRow.exerciseId)?.name) ?? 'Exercise'}
        actions={
          menuRow
            ? [
                {
                  label: 'Move up',
                  icon: <ArrowUp />,
                  disabled: r.exercises[0]?.id === menuRow.id,
                  onSelect: () => move(menuRow.id, -1),
                },
                {
                  label: 'Move down',
                  icon: <ArrowDown />,
                  disabled: r.exercises[r.exercises.length - 1]?.id === menuRow.id,
                  onSelect: () => move(menuRow.id, 1),
                },
                {
                  label: 'Remove from routine',
                  icon: <Trash />,
                  danger: true,
                  onSelect: () => setR((x) => ({ ...x, exercises: x.exercises.filter((e) => e.id !== menuRow.id) })),
                },
              ]
            : []
        }
      />
    </>
  )
}
