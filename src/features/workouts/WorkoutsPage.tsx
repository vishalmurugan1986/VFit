import { useLiveQuery } from 'dexie-react-hooks'
import { BookOpen, CalendarPlus, ClipboardList, History, Moon, Play, Plus, Sun } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button, Card, EmptyState, List, ListRow, PageHeader, SectionHeader } from '../../components/ui'
import { db } from '../../db/db'
import { useActiveWorkout, useExercises } from '../../db/queries'
import { useSettings } from '../../db/settings'
import type { Exercise, Routine, Session } from '../../db/types'
import { cn } from '../../lib/cn'
import { combineDateTime, formatDate, formatTime, parseDateStr, todayStr } from '../../lib/dates'
import { orderedWeekdays, routinesOn, sessionLabel } from '../../lib/schedule'
import { ActiveWorkoutBanner } from './ActiveWorkoutBanner'
import { createPastWorkout, templateFromRoutine, useStartWorkout } from './actions'

/** Bar button: an icon link in the accent color with a 44pt target. */
function BarLink({ to, label, children }: { to: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className="grid size-11 place-items-center rounded-full text-accent-ink transition-opacity active:opacity-60 [&_svg]:size-[22px]"
    >
      {children}
    </Link>
  )
}

const SessionIcon = ({ session, className }: { session: Session; className?: string }) =>
  session === 'morning' ? <Sun className={className} aria-hidden /> : <Moon className={className} aria-hidden />

/**
 * Workouts are built around your routines: each one can be planned for weekdays and a gym
 * session (morning or evening), and today's plan sits at the top with a Start button.
 */
export default function WorkoutsPage() {
  const navigate = useNavigate()
  const { weekStartsOn, sessions } = useSettings()
  const start = useStartWorkout()
  const active = useActiveWorkout()
  const { map } = useExercises()
  const routines = useLiveQuery(() => db.routines.orderBy('updatedAt').reverse().toArray(), [])
  const today = todayStr()
  const planned = routinesOn(routines ?? [], today)
  const todayDay = parseDateStr(today).getDay()

  const logPast = async () => {
    const id = await createPastWorkout()
    navigate(`/workouts/${id}?edit=1`)
  }

  const timeOf = (s: Session) => formatTime(combineDateTime(today, sessions[s]))
  const names = (r: Routine) => r.exercises.map((e) => map.get(e.exerciseId)?.name).filter(Boolean).join(', ')

  return (
    <>
      <PageHeader
        title="Workouts"
        actions={
          <>
            <BarLink to="/workouts/history" label="History">
              <History />
            </BarLink>
            <BarLink to="/exercises" label="Exercises">
              <BookOpen />
            </BarLink>
          </>
        }
      />

      {active && <ActiveWorkoutBanner workout={active} />}

      <SectionHeader title={`Today · ${formatDate(today, { weekday: 'long' })}`} flush={!active} />
      {routines === undefined ? null : planned.length > 0 ? (
        <div className="flex flex-col gap-3">
          {planned.map((r) => (
            <Card key={r.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-footnote text-ink-2">
                {r.session && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-fill px-2.5 py-1 font-semibold text-ink">
                    <SessionIcon session={r.session} className="size-3.5 text-accent-ink" />
                    {sessionLabel(r.session)} · {timeOf(r.session)}
                  </span>
                )}
                <span>
                  {r.exercises.length} {r.exercises.length === 1 ? 'exercise' : 'exercises'}
                </span>
              </div>
              <div>
                <h3 className="text-title2">{r.name}</h3>
                <p className="mt-1 line-clamp-2 text-subhead text-ink-2">{names(r) || 'No exercises yet'}</p>
              </div>
              <Button
                variant="primary"
                size="lg"
                full
                disabled={r.exercises.length === 0 || active != null}
                onClick={() => void start(templateFromRoutine(r))}
              >
                <Play className="fill-current" />
                Start {r.name}
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-fill text-ink-2">
            <Moon className="size-5" aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-subhead text-ink-2">
            {routines.some((r) => r.days?.length)
              ? 'Rest day: no routine planned for today. You can still start any routine below.'
              : 'Plan your routines for weekdays (Edit → Days) and today’s session shows up here.'}
          </p>
        </Card>
      )}

      <SectionHeader
        title="Routines"
        action={
          <Link to="/routines/new" className="relative before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] inline-flex items-center gap-1 text-body text-accent-ink transition-opacity active:opacity-60">
            <Plus className="size-5" aria-hidden />
            New
          </Link>
        }
      />
      {routines === undefined ? null : routines.length === 0 ? (
        <EmptyState
          icon={<ClipboardList />}
          title="No routines yet"
          action={
            <Link to="/routines/new" className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-4 text-body font-semibold text-on-accent active:opacity-80">
              <Plus className="size-5" aria-hidden />
              New routine
            </Link>
          }
        >
          Save the sessions you do at the gym, like Push, Pull or Legs, plan their days and start them with one tap.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {routines.map((r) => (
            <RoutineCard
              key={r.id}
              routine={r}
              exercises={map}
              weekStartsOn={weekStartsOn}
              todayDay={todayDay}
              sessionTime={r.session ? timeOf(r.session) : null}
              disabled={active != null}
              onStart={() => void start(templateFromRoutine(r))}
            />
          ))}
        </div>
      )}

      <List className="mt-8">
        <ListRow
          icon={<Play />}
          iconColor="var(--strength)"
          title="Start without a routine"
          onClick={active ? undefined : () => void start()}
          chevron={!active}
        />
        <ListRow icon={<CalendarPlus />} iconColor="var(--ink-2)" title="Log a past workout" onClick={() => void logPast()} chevron />
      </List>
    </>
  )
}

function RoutineCard({
  routine,
  exercises,
  weekStartsOn,
  todayDay,
  sessionTime,
  disabled,
  onStart,
}: {
  routine: Routine
  exercises: Map<string, Exercise>
  weekStartsOn: 0 | 1
  todayDay: number
  sessionTime: string | null
  disabled: boolean
  onStart: () => void
}) {
  const names = routine.exercises.map((e) => exercises.get(e.exerciseId)?.name).filter(Boolean)
  const isToday = routine.days?.includes(todayDay) ?? false
  return (
    <Card className={cn('flex flex-col gap-3', isToday && 'border-accent-line')}>
      <div className="flex items-start justify-between gap-2">
        <Link to={`/routines/${routine.id}`} className="min-w-0 flex-1 active:opacity-60">
          <h3 className="truncate text-headline">{routine.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-footnote text-ink-2">{names.length ? names.join(', ') : 'No exercises yet'}</p>
        </Link>
        <Link to={`/routines/${routine.id}`} className="relative before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] -mt-1 -mr-1 shrink-0 px-1 py-1 text-body text-accent-ink active:opacity-60">
          Edit
        </Link>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1" aria-label={`Planned days: ${routine.days?.length ? '' : 'none'}`}>
          {orderedWeekdays(weekStartsOn).map((d) => {
            const on = routine.days?.includes(d.day)
            return (
              <span
                key={d.day}
                title={d.name}
                aria-label={on ? d.name : undefined}
                aria-hidden={on ? undefined : true}
                className={cn(
                  'grid size-6 place-items-center rounded-full text-caption2 font-semibold',
                  on ? 'bg-accent-soft text-accent-ink' : 'text-muted',
                  d.day === todayDay && 'ring-1 ring-ink-2',
                )}
              >
                {d.short}
              </span>
            )
          })}
        </div>
        {routine.session && sessionTime && (
          <span className="inline-flex shrink-0 items-center gap-1 text-footnote text-ink-2">
            <SessionIcon session={routine.session} className="size-3.5" />
            {sessionTime}
          </span>
        )}
      </div>

      <Button size="sm" variant={isToday ? 'primary' : 'tinted'} className="self-start" onClick={onStart} disabled={disabled || routine.exercises.length === 0}>
        <Play className="fill-current" />
        Start
      </Button>
    </Card>
  )
}
