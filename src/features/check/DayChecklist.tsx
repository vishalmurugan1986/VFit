import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronRight, Clock, Minus, Moon, Pill, Play, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { ActionSheet, Button, type SheetAction } from '../../components/ui'
import { db } from '../../db/db'
import { setMealCheck, setWorkoutCheck, type DayCheckData } from '../../db/queries'
import { cn } from '../../lib/cn'
import { formatDuration, formatTime, todayStr } from '../../lib/dates'
import { isDone, type MealItem, type MealState, type WorkoutState } from '../../lib/dayCheck'
import { sessionLabel } from '../../lib/schedule'
import { workoutStats } from '../../lib/strength'
import { isScheduled } from '../../lib/supplements'
import { SupplementChecklist } from '../supplements/SupplementChecklist'
import { templateFromRoutine, useStartWorkout } from '../workouts/actions'

const MEAL_TEXT: Record<MealState, string> = {
  logged: 'Food logged',
  eaten: 'Eaten',
  skipped: 'Skipped',
  open: 'Not checked yet',
  later: 'Later today',
}

const WORKOUT_TEXT: Record<WorkoutState, string> = {
  logged: 'Done',
  done: 'Done (not logged)',
  rest: 'Rest day',
  missed: 'Missed',
  open: 'Not done yet',
  later: 'Later today',
}

/**
 * The day's checklist: each meal, the planned workout and supplements. Tap a row for its options;
 * the button on the right is the usual answer (Ate / Start).
 */
export function DayChecklist({
  date,
  data,
  onAddFood,
}: {
  date: string
  data: DayCheckData
  onAddFood: (meal: string) => void
}) {
  const navigate = useNavigate()
  const start = useStartWorkout()
  const [menu, setMenu] = useState<{ title: string; actions: SheetAction[] } | null>(null)
  const [showSupplements, setShowSupplements] = useState(false)
  const isToday = date === todayStr()
  const w = data.workout

  const mealMenu = (m: MealItem) =>
    setMenu({
      title: m.meal.name,
      actions: [
        { label: 'Add food', icon: <Plus />, onSelect: () => onAddFood(m.meal.id) },
        ...(m.state !== 'logged'
          ? [
              { label: 'Ate it (no food logged)', icon: <Check />, onSelect: () => void setMealCheck(date, m.meal.id, 'eaten') },
              { label: 'Skipped it', icon: <Minus />, onSelect: () => void setMealCheck(date, m.meal.id, 'skipped') },
            ]
          : []),
        ...(m.state === 'eaten' || m.state === 'skipped'
          ? [{ label: 'Clear', onSelect: () => void setMealCheck(date, m.meal.id, null) }]
          : []),
      ],
    })

  const workoutMenu = () =>
    setMenu({
      title: w.planned.length ? w.planned.map((r) => r.name).join(' + ') : 'Workout',
      actions: [
        ...(isToday && w.state !== 'logged'
          ? (w.planned.length ? w.planned : [null]).map((r) => ({
              label: r ? `Start ${r.name}` : 'Start a workout',
              icon: <Play />,
              onSelect: () => void start(r ? templateFromRoutine(r) : undefined),
            }))
          : []),
        ...(w.state !== 'logged'
          ? [
              { label: "Trained, didn't log it", icon: <Check />, onSelect: () => void setWorkoutCheck(date, 'done') },
              { label: 'Rest day', icon: <Moon />, onSelect: () => void setWorkoutCheck(date, 'rest') },
              { label: 'Missed it', icon: <Minus />, onSelect: () => void setWorkoutCheck(date, 'missed') },
            ]
          : [{ label: 'Open workout', icon: <ChevronRight />, onSelect: () => navigate(`/workouts/${data.logged!.id}`) }]),
        ...(data.check?.workout ? [{ label: 'Clear', onSelect: () => void setWorkoutCheck(date, null) }] : []),
      ],
    })

  const workoutTitle = w.planned.length ? w.planned.map((r) => r.name).join(' + ') : data.logged?.name ?? 'Workout'
  const workoutDetail =
    w.state === 'logged' && data.logged
      ? `${formatDuration(workoutStats(data.logged).durationSec)} · ${formatTime(data.logged.startedAt)}`
      : w.session && w.at != null
        ? `${sessionLabel(w.session)} · ${formatTime(w.at)} · ${WORKOUT_TEXT[w.state]}`
        : WORKOUT_TEXT[w.state]

  return (
    <>
      <ul>
        {data.meals.map((m) => (
          <Row
            key={m.meal.id}
            done={isDone(m.state)}
            muted={m.state === 'skipped'}
            later={m.state === 'later'}
            title={m.meal.name}
            detail={[m.at != null ? formatTime(m.at) : null, MEAL_TEXT[m.state]].filter(Boolean).join(' · ')}
            onOpen={() => mealMenu(m)}
            action={
              !isDone(m.state) ? (
                <Button size="sm" variant="tinted" onClick={() => void setMealCheck(date, m.meal.id, 'eaten')}>
                  Ate
                </Button>
              ) : null
            }
          />
        ))}
        <Row
          done={isDone(w.state)}
          muted={w.state === 'missed' || (w.state === 'rest' && w.restDay)}
          later={w.state === 'later'}
          title={w.state === 'rest' && w.restDay && !data.logged ? 'Rest day' : workoutTitle}
          detail={w.state === 'rest' && w.restDay ? 'No routine planned' : workoutDetail}
          onOpen={workoutMenu}
          action={
            !isDone(w.state) ? (
              isToday && w.planned[0] ? (
                <Button size="sm" variant="primary" onClick={() => void start(templateFromRoutine(w.planned[0]))}>
                  Start
                </Button>
              ) : (
                <Button size="sm" variant="tinted" onClick={() => void setWorkoutCheck(date, 'done')}>
                  Done
                </Button>
              )
            ) : null
          }
        />
        {data.supplements.due > 0 && (
          <>
            <Row
              done={data.supplements.taken >= data.supplements.due}
              title="Supplements"
              detail={`${data.supplements.taken} of ${data.supplements.due} taken`}
              icon={<Pill className="size-4" aria-hidden />}
              expanded={showSupplements}
              onOpen={() => setShowSupplements((v) => !v)}
            />
            {showSupplements && (
              <li className="pb-2">
                <InlineSupplements date={date} />
              </li>
            )}
          </>
        )}
      </ul>
      <ActionSheet open={menu != null} onClose={() => setMenu(null)} title={menu?.title ?? ''} actions={menu?.actions ?? []} />
    </>
  )
}

/** The day's supplements, ticked right inside the checklist. */
function InlineSupplements({ date }: { date: string }) {
  const supplements = useLiveQuery(() => db.supplements.orderBy('order').toArray(), [])
  const logs = useLiveQuery(() => db.supplementLogs.where('date').equals(date).toArray(), [date])
  if (!supplements || !logs) return null
  const due = supplements.filter((s) => isScheduled(s, date))
  return (
    <div className="ml-10 overflow-hidden rounded-xl bg-fill/60">
      <SupplementChecklist date={date} supplements={due} logs={logs} grouped={false} />
      <Link
        to="/supplements"
        className="flex h-11 items-center justify-between border-t-[0.5px] border-bar-line px-4 text-subhead text-accent-ink active:opacity-60"
      >
        Open Supplements
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </div>
  )
}

/**
 * One checklist row: a status mark (filled tick when done, a dash when skipped or missed, a clock
 * when it's later today, an empty ring when it's open), the name and detail, and a quick action.
 */
function Row({
  done,
  muted,
  later,
  title,
  detail,
  icon,
  expanded,
  onOpen,
  action,
}: {
  done: boolean
  muted?: boolean
  later?: boolean
  title: string
  detail: string
  icon?: ReactNode
  /** set for a row that opens in place (shows a turning chevron) */
  expanded?: boolean
  onOpen: () => void
  action?: ReactNode
}) {
  return (
    <li className="relative flex items-center gap-3 py-2.5 not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-10 not-first:before:h-px not-first:before:scale-y-50 not-first:before:bg-bar-line not-first:before:content-['']">
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={expanded}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left transition-opacity active:opacity-60"
      >
        <span
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-full',
            done && !muted && 'bg-accent text-on-accent',
            done && muted && 'bg-fill-2 text-ink-2',
            !done && !later && icon == null && 'border-2 border-baseline',
            !done && (later || icon != null) && 'text-ink-2',
          )}
          aria-hidden
        >
          {done ? (
            muted ? (
              <Minus className="size-4" strokeWidth={3} />
            ) : (
              <Check className="size-4" strokeWidth={3.2} />
            )
          ) : later ? (
            <Clock className="size-[22px]" strokeWidth={1.8} />
          ) : (
            icon ?? null
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-body', muted && 'text-ink-2')}>{title}</span>
          <span className="block truncate text-footnote text-ink-2">{detail}</span>
        </span>
        {expanded !== undefined && (
          <ChevronRight
            className={cn('size-[18px] shrink-0 text-muted transition-transform duration-200', expanded && 'rotate-90')}
            aria-hidden
          />
        )}
      </button>
      {action}
    </li>
  )
}
