import { useLiveQuery } from 'dexie-react-hooks'
import { AlarmClock, Check, Dumbbell, Gauge, Plus, Settings, ShieldCheck, Target } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Legend, Sparkline } from '../../components/chartParts'
import { useToast } from '../../components/toast'
import { Button, Card, EmptyState, List, ListRow, Meter, PageHeader, SectionHeader, Stat } from '../../components/ui'
import { downloadBackup } from '../../db/backup'
import { db } from '../../db/db'
import { getBodyFacts, getLastBackup, useActiveWorkout, useCardioTypes, useTargets } from '../../db/queries'
import { usePhases, useSettings } from '../../db/settings'
import { bmi, bmiCategory } from '../../lib/body'
import { cardioTotals, paceLabel } from '../../lib/cardio'
import { cn } from '../../lib/cn'
import {
  addDays,
  combineDateTime,
  DAY_MS,
  dateStrFromTs,
  dayLabel,
  dayStartTs,
  formatDate,
  formatDuration,
  formatTime,
  parseDateStr,
  startOfWeek,
  todayStr,
} from '../../lib/dates'
import { useNow } from '../../lib/hooks'
import { entryTotals, sumNutrients } from '../../lib/nutrition'
import { GOAL_COLOR, goalLabel, phaseProgressLabel } from '../../lib/phases'
import { valueOnOrBefore } from '../../lib/series'
import { workoutStats } from '../../lib/strength'
import { fmtNum } from '../../lib/units'
import { BodySheet } from '../body/BodySheet'
import { CARDIO_ICONS } from '../cardio/activityIcons'
import { FoodSheet } from '../nutrition/FoodSheet'
import { Logo } from '../../components/Logo'
import { TodayCheck, YesterdayNudge } from '../check/TodayCheck'
import { ActiveWorkoutBanner } from '../workouts/ActiveWorkoutBanner'

type SheetKind = 'body' | 'food' | null

export default function TodayPage() {
  const settings = useSettings()
  const { targets } = useTargets()
  const { current, upcoming } = usePhases()
  const { typeOf } = useCardioTypes()
  const toast = useToast()
  const today = todayStr()
  const weekStart = startOfWeek(today, settings.weekStartsOn)
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [foodMeal, setFoodMeal] = useState<string | undefined>()
  const now = useNow(60_000)

  const active = useActiveWorkout()
  const foods = useLiveQuery(() => db.foods.where('date').equals(today).toArray(), [today])
  const weekWorkouts = useLiveQuery(
    () => db.workouts.where('startedAt').aboveOrEqual(dayStartTs(weekStart)).toArray(),
    [weekStart],
  )
  const weekCardio = useLiveQuery(() => db.cardio.where('date').aboveOrEqual(weekStart).toArray(), [weekStart])
  const weighIns = useLiveQuery(
    () => db.body.orderBy('date').reverse().filter((e) => e.weightKg != null).limit(60).toArray(),
    [],
  )
  const facts = useLiveQuery(getBodyFacts, [])
  const todaysBody = useLiveQuery(() => db.body.where('date').equals(today).first(), [today])
  const recentWorkouts = useLiveQuery(
    () => db.workouts.orderBy('startedAt').reverse().filter((w) => w.finishedAt != null).limit(5).toArray(),
    [],
  )
  const recentCardio = useLiveQuery(() => db.cardio.orderBy('date').reverse().limit(5).toArray(), [])
  const lastBackup = useLiveQuery(getLastBackup, [])
  const hasData = useLiveQuery(
    async () => (await db.workouts.count()) + (await db.cardio.count()) + (await db.body.count()) + (await db.foods.count()) > 0,
    [],
  )

  /* Nutrition */
  const eaten = sumNutrients((foods ?? []).map(entryTotals))
  const left = targets.calories - eaten.calories

  /* This week */
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const finishedThisWeek = (weekWorkouts ?? []).filter((w) => w.finishedAt != null)
  const strengthDays = new Set(finishedThisWeek.map((w) => dateStrFromTs(w.startedAt)))
  const cardioDays = new Set((weekCardio ?? []).map((c) => c.date))
  const weekCardioTotals = cardioTotals(weekCardio ?? [])
  const activeDays = days.filter((d) => strengthDays.has(d) || cardioDays.has(d)).length

  /* Exercise minutes today: workouts (running ones count up to now) plus cardio */
  const exerciseMin = Math.round(
    (weekWorkouts ?? [])
      .filter((w) => dateStrFromTs(w.startedAt) === today)
      .reduce((sum, w) => sum + Math.max(0, (w.finishedAt ?? now) - w.startedAt) / 60_000, 0) +
      (weekCardio ?? []).filter((c) => c.date === today).reduce((sum, c) => sum + c.durationSec / 60, 0),
  )

  /* Body */
  const latest = weighIns?.[0]
  const weighInsAsc = [...(weighIns ?? [])].reverse()
  const monthAgo = latest ? valueOnOrBefore(weighInsAsc, addDays(latest.date, -30), (e) => e.weightKg) : null
  const weightChange = latest?.weightKg != null && monthAgo != null ? latest.weightKg - monthAgo : null
  const currentBmi = latest?.weightKg != null && facts?.heightCm != null ? bmi(latest.weightKg, facts.heightCm) : null

  /* Recent activity (workouts and cardio, newest first) */
  const recent = [
    ...(recentWorkouts ?? []).map((w) => {
      const s = workoutStats(w)
      return {
        key: w.id,
        date: dateStrFromTs(w.startedAt),
        order: w.startedAt,
        title: w.name,
        detail: `${s.sets} sets`,
        value: fmtNum(Math.round(s.durationSec / 60)),
        unit: 'min',
        href: `/workouts/${w.id}`,
        color: 'var(--strength)',
        icon: <Dumbbell aria-hidden />,
      }
    }),
    ...(recentCardio ?? []).map((c) => {
      const type = typeOf(c.activity)
      const Icon = CARDIO_ICONS[type.icon] ?? CARDIO_ICONS.activity
      return {
        key: c.id,
        date: c.date,
        order: c.createdAt,
        title: type.name,
        detail: [c.distanceKm ? formatDuration(c.durationSec) : null, paceLabel(type.measure, c.distanceKm, c.durationSec)]
          .filter(Boolean)
          .join(' · '),
        value: c.distanceKm ? fmtNum(c.distanceKm, 2) : fmtNum(Math.round(c.durationSec / 60)),
        unit: c.distanceKm ? 'km' : 'min',
        href: '/cardio',
        color: 'var(--cardio)',
        icon: <Icon aria-hidden />,
      }
    }),
  ]
    .sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order)
    .slice(0, 5)

  const needsBackup =
    hasData === true && lastBackup !== undefined && (lastBackup === null || now - lastBackup > settings.backupReminderDays * DAY_MS)

  const backupNow = async () => {
    await downloadBackup()
    toast('Backup saved to your downloads')
  }

  return (
    <>
      <PageHeader
        title="Today"
        eyebrow={formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}
        leading={
          <span className="md:hidden">
            <Logo size="sm" />
          </span>
        }
        actions={
          <Link
            to="/settings"
            aria-label="Settings"
            className="grid size-11 place-items-center rounded-full text-accent-ink transition-opacity active:opacity-60 md:hidden"
          >
            <Settings className="size-[22px]" />
          </Link>
        }
      />

      {settings.wakeTime && (
        <Link
          to="/alarm"
          className="-mt-1 mb-4 inline-flex h-8 items-center gap-1.5 rounded-full bg-fill px-3 text-footnote font-medium text-ink-2 transition-colors active:bg-fill-2"
        >
          <AlarmClock className="size-4" aria-hidden />
          Wake-up {formatTime(combineDateTime(today, settings.wakeTime))}
        </Link>
      )}

      {active && (
        <div className="mb-3">
          <ActiveWorkoutBanner workout={active} />
        </div>
      )}

      <SectionHeader title="Activity" flush action={<SectionLink to="/nutrition">Food log</SectionLink>} />
      <Card className="flex flex-col gap-4">
        <GoalBar label="Exercise" value={exerciseMin} max={EXERCISE_GOAL_MIN} unit="min" color="var(--exercise)" />
        <GoalBar label="Calories" value={eaten.calories} max={targets.calories} unit="kcal" color="var(--move)" overIsBad />
        <GoalBar label="Protein" value={eaten.protein} max={targets.protein} unit="g" color="var(--stand)" />
        <div className="grid grid-cols-2 gap-4 border-t-[0.5px] border-bar-line pt-4">
          {(
            [
              ['Carbs', eaten.carbs, targets.carbs],
              ['Fat', eaten.fat, targets.fat],
            ] as const
          ).map(([label, value, target]) => (
            <div key={label} className="min-w-0">
              <p className="flex items-baseline justify-between gap-2">
                <span className="text-subhead">{label}</span>
                <span className="text-footnote text-ink-2 tabular-nums">
                  <span className="font-semibold text-ink">{fmtNum(value)}</span> / {fmtNum(target)} g
                </span>
              </p>
              <Meter className="mt-2" height={4} value={value} max={target} color="var(--ink-2)" label={`${label} eaten today against your target`} />
            </div>
          ))}
        </div>
        <p className={cn('-mb-0.5 text-footnote', left < 0 ? 'text-bad-ink' : 'text-ink-2')}>
          {left >= 0 ? `${fmtNum(left)} kcal left today` : `${fmtNum(-left)} kcal over your target today`}
        </p>
      </Card>

      <YesterdayNudge today={today} now={now} />
      <TodayCheck
        date={today}
        now={now}
        onAddFood={(meal) => {
          setFoodMeal(meal)
          setSheet('food')
        }}
      />

      {needsBackup && (
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-accent-soft p-4">
          <ShieldCheck className="size-6 shrink-0 text-accent-ink" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-headline">Back up your data</p>
            <p className="text-footnote text-ink-2">
              It's stored only on this device.{' '}
              {lastBackup
                ? `Last backup ${formatDate(dateStrFromTs(lastBackup), { day: 'numeric', month: 'short' })}.`
                : 'No backup yet.'}
            </p>
          </div>
          <Button size="sm" variant="primary" onClick={() => void backupNow()}>
            Back up
          </Button>
        </div>
      )}

      {current && (
        <>
          <SectionHeader title="Training phase" action={<SectionLink to="/goal">Plan</SectionLink>} />
          <List>
            <ListRow
              to="/goal"
              icon={<Target aria-hidden />}
              iconColor={GOAL_COLOR[current.goal]}
              title={`${goalLabel(current.goal)} · ${phaseProgressLabel(current, today)}`}
              subtitle={
                [
                  current.targetWeightKg != null
                    ? `Target ${fmtNum(current.targetWeightKg, 1)} kg${
                        latest?.weightKg != null && Math.abs(current.targetWeightKg - latest.weightKg) >= 0.1
                          ? `, ${fmtNum(Math.abs(current.targetWeightKg - latest.weightKg), 1)} kg to go`
                          : ''
                      }`
                    : null,
                  upcoming[0]
                    ? `next: ${goalLabel(upcoming[0].goal)} from ${formatDate(upcoming[0].startDate, { day: 'numeric', month: 'short' })}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || undefined
              }
            />
          </List>
        </>
      )}

      <div className="md:grid md:grid-cols-2 md:gap-3">
        <div>
          <SectionHeader title="This week" />
          <Card>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => {
                const s = strengthDays.has(d)
                const c = cardioDays.has(d)
                const isToday = d === today
                return (
                  <div key={d} className="flex flex-col items-center gap-1.5">
                    <span className="text-caption2 font-semibold text-ink-2 uppercase" aria-hidden>
                      {formatDate(d, { weekday: 'narrow' })}
                    </span>
                    <span
                      className={cn(
                        'grid size-8 place-items-center rounded-full text-subhead font-semibold tabular-nums',
                        isToday ? 'bg-accent text-on-accent' : d > today ? 'text-muted' : 'text-ink',
                      )}
                      aria-hidden
                    >
                      {parseDateStr(d).getDate()}
                    </span>
                    <span className="flex h-1.5 items-center gap-1" aria-hidden>
                      {s && <span className="size-1.5 rounded-full bg-strength" />}
                      {c && <span className="size-1.5 rounded-full bg-cardio" />}
                    </span>
                    <span className="sr-only">
                      {formatDate(d, { weekday: 'long' })}: {[s && 'strength', c && 'cardio'].filter(Boolean).join(' and ') || 'no training'}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex justify-center">
              <Legend
                items={[
                  { label: 'Strength', color: 'var(--strength)', shape: 'dot' },
                  { label: 'Cardio', color: 'var(--cardio)', shape: 'dot' },
                ]}
              />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t-[0.5px] border-bar-line pt-4">
              <Stat label="Workouts" value={finishedThisWeek.length} />
              <Stat label="Cardio" value={fmtNum(weekCardioTotals.distanceKm, 1)} unit="km" />
              <Stat label="Active days" value={`${activeDays}/7`} />
            </div>
          </Card>
        </div>

        <div>
          <SectionHeader title="Body" action={<SectionLink to="/body">Show All</SectionLink>} />
          {latest?.weightKg != null ? (
            <Link
              to="/body"
              className="flex items-end justify-between gap-3 rounded-xl bg-surface p-4 transition-colors active:bg-surface-2"
            >
              <div className="min-w-0">
                <p className="font-rounded text-title1 font-semibold">
                  {fmtNum(latest.weightKg, 1)}
                  <span className="ml-1 text-subhead font-semibold text-ink-2">KG</span>
                </p>
                <p className="mt-1 text-footnote text-ink-2">
                  {dayLabel(latest.date)}
                  {weightChange != null &&
                    ` · ${weightChange > 0 ? '+' : weightChange < 0 ? '−' : '±'}${fmtNum(Math.abs(weightChange), 1)} kg in 30 days`}
                </p>
                {currentBmi != null && (
                  <p className="text-footnote text-ink-2">
                    BMI {fmtNum(currentBmi, 1)} · {bmiCategory(currentBmi)}
                  </p>
                )}
              </div>
              <Sparkline values={weighInsAsc.slice(-12).map((e) => e.weightKg ?? 0)} color="var(--body)" />
            </Link>
          ) : (
            <EmptyState
              icon={<Gauge />}
              title="No weigh-ins yet"
              action={
                <Button size="sm" variant="tinted" onClick={() => setSheet('body')}>
                  <Plus />
                  Log weight
                </Button>
              }
            >
              Log your weight and height to see your trend and BMI.
            </EmptyState>
          )}
        </div>
      </div>

      <SectionHeader title="History" action={<SectionLink to="/workouts/history">Show All</SectionLink>} />
      {recent.length === 0 ? (
        <EmptyState icon={<Dumbbell />} title="Nothing logged yet">
          Workouts and cardio sessions you log will show up here.
        </EmptyState>
      ) : (
        <List>
          {recent.map((r) => (
            <ListRow
              key={r.key}
              to={r.href}
              icon={r.icon}
              iconColor={r.color}
              title={r.title}
              subtitle={`${dayLabel(r.date)} · ${r.detail}`}
              value={
                <span className="font-rounded text-headline text-ink">
                  {r.value}
                  <span className="ml-0.5 text-footnote font-semibold text-ink-2 uppercase">{r.unit}</span>
                </span>
              }
            />
          ))}
        </List>
      )}

      <BodySheet open={sheet === 'body'} onClose={() => setSheet(null)} entry={todaysBody} />
      <FoodSheet open={sheet === 'food'} onClose={() => setSheet(null)} date={today} meal={foodMeal} />
    </>
  )
}

/** A section header's link ("Show All"), in the accent color. */
function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="relative before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] text-body text-accent-ink transition-opacity active:opacity-60">
      {children}
    </Link>
  )
}


/** Daily exercise goal for the green bar, in minutes. */
const EXERCISE_GOAL_MIN = 45

/**
 * One of Today's three goals (data-viz meter): the name, the number against the goal in ink, and a
 * bar that fills towards it in the goal's color. Calories well over target turn the bar amber;
 * going past the exercise or protein goal fills the bar and shows a tick.
 */
function GoalBar({
  label,
  value,
  max,
  unit,
  color,
  overIsBad = false,
}: {
  label: string
  value: number
  max: number
  unit: string
  color: string
  overIsBad?: boolean
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const reached = max > 0 && value >= max
  const over = overIsBad && max > 0 && value > max * 1.05
  const fill = over ? 'var(--warning)' : color
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-1.5 text-headline">
          {label}
          {reached && !overIsBad && (
            <span className="grid size-[18px] place-items-center rounded-full" style={{ background: color }}>
              <Check className="size-3 text-on-accent" strokeWidth={3.5} aria-label="goal reached" />
            </span>
          )}
        </p>
        <p className="font-rounded">
          <span className="text-title3">{fmtNum(value)}</span>
          <span className="text-footnote font-medium text-ink-2">
            {' '}
            / {fmtNum(max)} <span className="uppercase">{unit}</span>
          </span>
        </p>
      </div>
      <div
        role="meter"
        aria-label={`${label} ${fmtNum(value)} of ${fmtNum(max)} ${unit}`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        className="mt-2 h-2.5 overflow-hidden rounded-full"
        style={{ background: `color-mix(in oklab, ${color} 20%, var(--surface))` }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-ios)]"
          style={{ width: `${pct}%`, background: fill }}
        />
      </div>
    </div>
  )
}
