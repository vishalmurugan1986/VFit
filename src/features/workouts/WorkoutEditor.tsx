import { useLiveQuery } from 'dexie-react-hooks'
import {
  ArrowDown,
  ArrowUp,
  ChartLine,
  Check,
  ChevronLeft,
  Dumbbell,
  Ellipsis,
  Flame,
  Minus,
  Pencil,
  Plus,
  Trash,
  X,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useConfirm } from '../../components/confirm'
import { useRestTimer } from '../../components/RestTimer'
import { useToast } from '../../components/toast'
import {
  ActionSheet,
  Button,
  Card,
  DurationField,
  EmptyState,
  Field,
  FieldGroup,
  IconButton,
  NumberField,
  TextArea,
  TextInput,
  TimeField,
} from '../../components/ui'
import { db } from '../../db/db'
import { previousSetsMap, useExercises } from '../../db/queries'
import { useSettings } from '../../db/settings'
import type { ExerciseKind, Workout, WorkoutExercise, WorkoutSet } from '../../db/types'
import { cn } from '../../lib/cn'
import {
  combineDateTime,
  dateStrFromTs,
  dayLabel,
  formatClock,
  formatDuration,
  timeStrFromTs,
  todayStr,
} from '../../lib/dates'
import { vibrate } from '../../lib/device'
import { useNow } from '../../lib/hooks'
import { uid } from '../../lib/id'
import {
  cleanupForFinish,
  countSets,
  formatSetShort,
  hasData,
  withExerciseIds,
  workoutStats,
} from '../../lib/strength'
import { fmtVolume, inputText, kgTo, toKg, type WeightUnit } from '../../lib/units'
import { defaultWorkoutName, newSet } from './actions'
import { ExercisePicker } from './ExercisePicker'

type SetValues = Pick<WorkoutSet, 'weight' | 'reps' | 'durationSec'>

const SET_GRID = 'grid grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_4rem_2.75rem] items-center gap-1.5'

/**
 * Logs a workout. `active`: in progress, with a running clock and rest timer.
 * `edit`: changing a finished workout. Every change is saved to the device immediately,
 * so closing the app mid-workout loses nothing.
 */
export function WorkoutEditor({
  initial,
  mode,
  onDone,
}: {
  initial: Workout
  mode: 'active' | 'edit'
  onDone?: () => void
}) {
  const navigate = useNavigate()
  const settings = useSettings()
  const unit = settings.weightUnit
  const toast = useToast()
  const confirm = useConfirm()
  const rest = useRestTimer()
  const { map: exMap, kindOf } = useExercises()
  const now = useNow(1000, mode === 'active')

  const [w, setW] = useState(initial)
  const latest = useRef(initial)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [exMenu, setExMenu] = useState<string | null>(null)
  const [setMenu, setSetMenu] = useState<{ weId: string; setId: string } | null>(null)

  const commit = useCallback((fn: (w: Workout) => Workout) => {
    const next = withExerciseIds(fn(latest.current))
    latest.current = next
    setW(next)
    void db.workouts.put(next)
  }, [])

  const idsKey = w.exerciseIds.join('|')
  const prevMap =
    useLiveQuery(() => previousSetsMap(w.exerciseIds, w.startedAt, w.id), [idsKey, w.startedAt, w.id]) ?? {}

  /** What a set will be filled with if ticked while empty: last session's matching set, else the set above. */
  const placeholder = (we: WorkoutExercise, index: number): SetValues => {
    const prev = prevMap[we.exerciseId]?.[index]
    if (prev) return { weight: prev.weight, reps: prev.reps, durationSec: prev.durationSec }
    for (let i = index - 1; i >= 0; i--) {
      const s = we.sets[i]
      if (s.reps != null || s.weight != null || s.durationSec != null) {
        return { weight: s.weight, reps: s.reps ?? we.targetReps ?? null, durationSec: s.durationSec }
      }
    }
    return { weight: null, reps: we.targetReps ?? null, durationSec: null }
  }

  const mapExercise = (weId: string, fn: (we: WorkoutExercise) => WorkoutExercise) =>
    commit((x) => ({ ...x, exercises: x.exercises.map((e) => (e.id === weId ? fn(e) : e)) }))

  const patchSet = (weId: string, setId: string, patch: Partial<WorkoutSet>) =>
    mapExercise(weId, (we) => ({ ...we, sets: we.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }))

  const toggleDone = (we: WorkoutExercise, index: number) => {
    const s = we.sets[index]
    if (s.done) {
      patchSet(we.id, s.id, { done: false })
      return
    }
    const kind = kindOf(we.exerciseId)
    const ph = placeholder(we, index)
    const filled: SetValues = {
      weight: s.weight ?? ph.weight,
      reps: s.reps ?? ph.reps,
      durationSec: s.durationSec ?? ph.durationSec,
    }
    if (!hasData({ ...s, ...filled }, kind)) {
      toast(kind === 'time' ? 'Enter a time for this set first' : 'Enter reps for this set first')
      return
    }
    patchSet(we.id, s.id, { ...filled, done: true })
    vibrate(15)
    if (mode === 'active' && settings.autoRest && settings.restSeconds > 0) rest.start(settings.restSeconds)
  }

  const moveExercise = (weId: string, dir: -1 | 1) =>
    commit((x) => {
      const i = x.exercises.findIndex((e) => e.id === weId)
      const j = i + dir
      if (i < 0 || j < 0 || j >= x.exercises.length) return x
      const list = [...x.exercises]
      ;[list[i], list[j]] = [list[j], list[i]]
      return { ...x, exercises: list }
    })

  const removeExercise = async (weId: string) => {
    const we = latest.current.exercises.find((e) => e.id === weId)
    if (!we) return
    if (we.sets.some((s) => s.done)) {
      const ok = await confirm({
        title: 'Remove exercise?',
        message: `${exMap.get(we.exerciseId)?.name ?? 'This exercise'} has completed sets. They'll be removed from this workout.`,
        confirmText: 'Remove',
        danger: true,
      })
      if (!ok) return
    }
    commit((x) => ({ ...x, exercises: x.exercises.filter((e) => e.id !== weId) }))
  }

  const addExercises = async (ids: string[]) => {
    const prev = await previousSetsMap(ids, latest.current.startedAt, latest.current.id)
    commit((x) => ({
      ...x,
      exercises: [
        ...x.exercises,
        ...ids.map((exerciseId) => ({
          id: uid(),
          exerciseId,
          // Same number of sets as last time (3 for a new exercise); empty ones are dropped on finish.
          sets: Array.from({ length: Math.min(8, prev[exerciseId]?.length || 3) }, newSet),
        })),
      ],
    }))
  }

  const deleteAndLeave = async () => {
    rest.stop()
    navigate('/workouts', { replace: true })
    await db.workouts.delete(latest.current.id)
  }

  const finish = async () => {
    const current = latest.current
    const cleaned = cleanupForFinish(current, kindOf)
    if (cleaned.exercises.length === 0) {
      const ok = await confirm({
        title: 'Nothing logged yet',
        message: 'None of the sets have reps or a time entered. Discard this workout?',
        confirmText: 'Discard workout',
        danger: true,
      })
      if (ok) await deleteAndLeave()
      return
    }
    const stats = workoutStats(cleaned)
    const dropped = countSets(current) - countSets(cleaned)
    const ok = await confirm({
      title: 'Finish workout?',
      message: (
        <>
          {stats.sets} {stats.sets === 1 ? 'set' : 'sets'} · {formatDuration(stats.durationSec)} ·{' '}
          {fmtVolume(stats.volumeKg, unit)} lifted
          {dropped > 0 && (
            <span className="mt-2 block">
              {dropped} empty {dropped === 1 ? 'set' : 'sets'} will be removed.
            </span>
          )}
        </>
      ),
      confirmText: 'Finish',
    })
    if (!ok) return
    rest.stop()
    commit(() => ({ ...cleaned, finishedAt: Date.now() }))
    toast('Workout saved. Nice work!')
  }

  const discard = async () => {
    const ok = await confirm({
      title: 'Discard workout?',
      message: 'Everything logged in this workout will be deleted.',
      confirmText: 'Discard',
      danger: true,
    })
    if (ok) await deleteAndLeave()
  }

  const doneEditing = async () => {
    const cleaned = cleanupForFinish(latest.current, kindOf)
    if (cleaned.exercises.length === 0) {
      const ok = await confirm({
        title: 'Delete this workout?',
        message: 'It has no sets with reps or a time entered.',
        confirmText: 'Delete',
        danger: true,
      })
      if (ok) await deleteAndLeave()
      return
    }
    commit(() => cleaned)
    onDone?.()
  }

  const deleteWorkout = async () => {
    const ok = await confirm({
      title: 'Delete workout?',
      message: 'It will be removed from your history.',
      confirmText: 'Delete',
      danger: true,
    })
    if (!ok) return
    const snapshot = latest.current
    await deleteAndLeave()
    toast('Workout deleted', { action: { label: 'Undo', onClick: () => void db.workouts.put(snapshot) } })
  }

  const setStart = (date: string, time: string) =>
    commit((x) => {
      const startedAt = combineDateTime(date, time)
      return { ...x, startedAt, finishedAt: x.finishedAt == null ? null : startedAt + (x.finishedAt - x.startedAt) }
    })

  const stats = workoutStats(w, now)
  const exMenuTarget = w.exercises.find((e) => e.id === exMenu)
  const setMenuTarget = setMenu
    ? w.exercises.find((e) => e.id === setMenu.weId)?.sets.find((s) => s.id === setMenu.setId)
    : undefined

  return (
    <>
      <header className="sticky top-[env(safe-area-inset-top)] z-20 -mx-4 mb-3 border-b-[0.5px] border-bar-line bg-page/90 px-4 py-2.5 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex items-center gap-1">
          <IconButton
            label={mode === 'active' ? 'Back to workouts (keeps this workout running)' : 'Done editing'}
            className="-ml-2.5"
            onClick={() => (mode === 'active' ? navigate('/workouts') : void doneEditing())}
          >
            <ChevronLeft />
          </IconButton>
          <div className="min-w-0 flex-1">
            <input
              aria-label="Workout name"
              value={w.name}
              maxLength={80}
              onChange={(e) => commit((x) => ({ ...x, name: e.target.value }))}
              onBlur={() => {
                if (!latest.current.name.trim()) commit((x) => ({ ...x, name: defaultWorkoutName(x.startedAt) }))
              }}
              className="w-full truncate rounded-md bg-transparent text-title3 font-bold outline-none focus:bg-surface-2"
            />
            <p className="truncate text-footnote text-ink-2 tabular-nums">
              {mode === 'active' ? (
                <span className="font-semibold text-ink">{formatClock((now - w.startedAt) / 1000)}</span>
              ) : (
                dayLabel(dateStrFromTs(w.startedAt))
              )}
              {' · '}
              {stats.sets} {stats.sets === 1 ? 'set' : 'sets'} · {fmtVolume(stats.volumeKg, unit)}
            </p>
          </div>
          {mode === 'active' ? (
            <Button size="sm" variant="primary" onClick={() => void finish()}>
              Finish
            </Button>
          ) : (
            <Button size="sm" variant="primary" onClick={() => void doneEditing()}>
              Done
            </Button>
          )}
        </div>
      </header>

      {mode === 'edit' && (
        <Card className="mb-3 grid grid-cols-2 gap-2">
          <Field label="Date">
            <TextInput
              type="date"
              value={dateStrFromTs(w.startedAt)}
              max={todayStr()}
              onChange={(e) => e.target.value && setStart(e.target.value, timeStrFromTs(w.startedAt))}
            />
          </Field>
          <Field label="Minutes">
            <NumberField
              integer
              value={w.finishedAt ? Math.round((w.finishedAt - w.startedAt) / 60_000) : null}
              onValueChange={(v) => {
                if (v != null && v > 0) commit((x) => ({ ...x, finishedAt: x.startedAt + v * 60_000 }))
              }}
            />
          </Field>
          <FieldGroup label="Start" className="col-span-2">
            <TimeField
              label="Start time"
              value={timeStrFromTs(w.startedAt)}
              onChange={(v) => v && setStart(dateStrFromTs(w.startedAt), v)}
            />
          </FieldGroup>
        </Card>
      )}

      {w.exercises.length === 0 && (
        <EmptyState
          icon={<Dumbbell />}
          title="Add your first exercise"
          action={
            <Button variant="primary" onClick={() => setPickerOpen(true)}>
              <Plus />
              Add exercises
            </Button>
          }
        >
          Pick from the library, or create your own.
        </EmptyState>
      )}

      {w.exercises.length > 0 && mode === 'active' && <HowToCard />}

      <div className="flex flex-col gap-3">
        {w.exercises.map((we) => {
          const ex = exMap.get(we.exerciseId)
          const kind: ExerciseKind = ex?.kind ?? 'weight'
          const prev = prevMap[we.exerciseId]
          let working = 0
          return (
            <Card key={we.id} padded={false}>
              <div className="flex items-start gap-2 pt-2 pr-2 pb-1 pl-4">
                <div className="min-w-0 flex-1 pt-2">
                  <h3 className="truncate font-semibold">{ex?.name ?? 'Unknown exercise'}</h3>
                  {we.targetReps ? <p className="text-footnote text-ink-2">Target {we.targetReps} reps</p> : null}
                </div>
                <IconButton label={`Options for ${ex?.name ?? 'exercise'}`} onClick={() => setExMenu(we.id)}>
                  <Ellipsis />
                </IconButton>
              </div>
              {we.note !== undefined && (
                <div className="px-4 pb-2">
                  <TextInput
                    value={we.note}
                    placeholder="Note, e.g. seat height 4"
                    aria-label="Exercise note"
                    onChange={(e) => mapExercise(we.id, (x) => ({ ...x, note: e.target.value }))}
                  />
                </div>
              )}
              <div className="px-2 pb-2">
                <div className={cn(SET_GRID, 'px-2 pb-1 text-caption2 font-semibold tracking-wide text-ink-2 uppercase')}>
                  <span className="text-center">Set</span>
                  <span>Last time</span>
                  <span className="text-center">{kind === 'bodyweight' ? `+${unit}` : unit}</span>
                  <span className="text-center">{kind === 'time' ? 'Time' : 'Reps'}</span>
                  <span className="sr-only">Done</span>
                </div>
                {we.sets.map((s, i) => {
                  if (!s.warmup) working++
                  return (
                    <SetRow
                      key={s.id}
                      set={s}
                      label={s.warmup ? 'W' : String(working)}
                      kind={kind}
                      unit={unit}
                      prev={prev?.[i]}
                      placeholder={placeholder(we, i)}
                      onPatch={(p) => patchSet(we.id, s.id, p)}
                      onToggle={() => toggleDone(we, i)}
                      onMenu={() => setSetMenu({ weId: we.id, setId: s.id })}
                    />
                  )
                })}
                <div className="mt-1 flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    full
                    onClick={() => mapExercise(we.id, (x) => ({ ...x, sets: [...x.sets, newSet()] }))}
                  >
                    <Plus />
                    Add set
                  </Button>
                  {we.sets.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      full
                      onClick={() => mapExercise(we.id, (x) => ({ ...x, sets: x.sets.slice(0, -1) }))}
                    >
                      <Minus />
                      Remove set
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {w.exercises.length > 0 && (
          <Button variant="outline" full onClick={() => setPickerOpen(true)}>
            <Plus />
            Add exercises
          </Button>
        )}
        <TextArea
          rows={2}
          placeholder="Workout notes"
          aria-label="Workout notes"
          value={w.note ?? ''}
          onChange={(e) => commit((x) => ({ ...x, note: e.target.value }))}
        />
        {mode === 'active' ? (
          <>
            <Button variant="primary" size="lg" full onClick={() => void finish()}>
              <Check />
              Finish workout
            </Button>
            <Button variant="danger-ghost" full onClick={() => void discard()}>
              <Trash />
              Discard workout
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" size="lg" full onClick={() => void doneEditing()}>
              Done
            </Button>
            <Button variant="danger-ghost" full onClick={() => void deleteWorkout()}>
              <Trash />
              Delete workout
            </Button>
          </>
        )}
      </div>

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(ids) => void addExercises(ids)} />

      <ActionSheet
        open={exMenuTarget !== undefined}
        onClose={() => setExMenu(null)}
        title={(exMenuTarget && exMap.get(exMenuTarget.exerciseId)?.name) ?? 'Exercise'}
        actions={
          exMenuTarget
            ? [
                {
                  label: 'History and records',
                  icon: <ChartLine />,
                  onSelect: () => navigate(`/exercises/${exMenuTarget.exerciseId}`),
                },
                {
                  label: exMenuTarget.note === undefined ? 'Add note' : 'Remove note',
                  icon: <Pencil />,
                  onSelect: () =>
                    mapExercise(exMenuTarget.id, (x) => ({ ...x, note: x.note === undefined ? '' : undefined })),
                },
                {
                  label: 'Move up',
                  icon: <ArrowUp />,
                  disabled: w.exercises[0]?.id === exMenuTarget.id,
                  onSelect: () => moveExercise(exMenuTarget.id, -1),
                },
                {
                  label: 'Move down',
                  icon: <ArrowDown />,
                  disabled: w.exercises[w.exercises.length - 1]?.id === exMenuTarget.id,
                  onSelect: () => moveExercise(exMenuTarget.id, 1),
                },
                {
                  label: 'Remove exercise',
                  icon: <Trash />,
                  danger: true,
                  onSelect: () => void removeExercise(exMenuTarget.id),
                },
              ]
            : []
        }
      />

      <ActionSheet
        open={setMenuTarget !== undefined}
        onClose={() => setSetMenu(null)}
        title="Set options"
        actions={
          setMenu && setMenuTarget
            ? [
                {
                  label: setMenuTarget.warmup ? 'Make it a working set' : 'Mark as warm-up',
                  icon: <Flame />,
                  onSelect: () => patchSet(setMenu.weId, setMenu.setId, { warmup: !setMenuTarget.warmup }),
                },
                {
                  label: 'Delete set',
                  icon: <Trash />,
                  danger: true,
                  onSelect: () =>
                    mapExercise(setMenu.weId, (x) => ({ ...x, sets: x.sets.filter((s) => s.id !== setMenu.setId) })),
                },
              ]
            : []
        }
      />
    </>
  )
}

const HOWTO_KEY = 'fitness.hideWorkoutHowTo'

/** Three-line reminder of how logging works; hidden for good once dismissed. */
function HowToCard() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HOWTO_KEY) === '1'
    } catch {
      return false
    }
  })
  if (hidden) return null
  return (
    <Card className="mb-3 bg-accent-soft text-subhead">
      <div className="flex items-start gap-2">
        <ol className="flex flex-1 list-decimal flex-col gap-1 pl-4">
          <li>
            Type the <strong>kg</strong> and <strong>reps</strong> you did.
          </li>
          <li>
            Tap <strong>✓</strong> when the set is done. Grey numbers are a suggestion from last time; ✓ uses them.
          </li>
          <li>
            Tap <strong>Finish</strong> at the end. Empty sets are dropped.
          </li>
        </ol>
        <IconButton
          size="sm"
          label="Hide these tips"
          onClick={() => {
            setHidden(true)
            try {
              localStorage.setItem(HOWTO_KEY, '1')
            } catch {
              /* fine */
            }
          }}
        >
          <X />
        </IconButton>
      </div>
    </Card>
  )
}

function SetRow({
  set,
  label,
  kind,
  unit,
  prev,
  placeholder,
  onPatch,
  onToggle,
  onMenu,
}: {
  set: WorkoutSet
  label: string
  kind: ExerciseKind
  unit: WeightUnit
  prev?: WorkoutSet
  placeholder: SetValues
  onPatch: (patch: Partial<WorkoutSet>) => void
  onToggle: () => void
  onMenu: () => void
}) {
  return (
    <div className={cn(SET_GRID, 'rounded-xl px-2 py-1 transition-colors', set.done && 'bg-good/10')}>
      <button
        type="button"
        onClick={onMenu}
        aria-label={`Set ${label} options`}
        className={cn(
          'h-9 rounded-lg text-subhead font-semibold tabular-nums transition-colors hover:bg-fill/60 active:bg-fill',
          set.warmup ? 'text-ink' : 'text-ink-2',
        )}
      >
        {label}
      </button>
      <button
        type="button"
        disabled={!prev}
        title={prev ? 'Copy last time’s set' : undefined}
        onClick={() => prev && onPatch({ weight: prev.weight, reps: prev.reps, durationSec: prev.durationSec })}
        className="truncate text-left text-footnote text-ink-2 tabular-nums"
      >
        {prev ? formatSetShort(prev, kind, unit) : '—'}
      </button>
      <NumberField
        size="sm"
        aria-label={kind === 'bodyweight' ? 'Added weight' : 'Weight'}
        value={set.weight == null ? null : kgTo(set.weight, unit)}
        onValueChange={(v) => onPatch({ weight: v == null ? null : toKg(v, unit) })}
        placeholder={placeholder.weight != null ? inputText(kgTo(placeholder.weight, unit), 1) : ''}
      />
      {kind === 'time' ? (
        <DurationField
          size="sm"
          aria-label="Time"
          value={set.durationSec}
          onValueChange={(v) => onPatch({ durationSec: v })}
          placeholder={placeholder.durationSec ? formatClock(placeholder.durationSec) : '0:00'}
        />
      ) : (
        <NumberField
          size="sm"
          integer
          aria-label="Reps"
          value={set.reps}
          onValueChange={(v) => onPatch({ reps: v })}
          placeholder={placeholder.reps != null ? String(placeholder.reps) : ''}
        />
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={set.done}
        aria-label={set.done ? `Set ${label} done (tap to undo)` : `Complete set ${label}`}
        className={cn(
          'grid size-10 place-items-center justify-self-end rounded-xl transition-colors',
          set.done ? 'bg-good text-white' : 'bg-fill text-muted hover:text-ink',
        )}
      >
        <Check className="size-5" strokeWidth={3} />
      </button>
    </div>
  )
}
