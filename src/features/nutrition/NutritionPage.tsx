import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Copy, ListChecks, Pill, Plus, Target, TriangleExclamationPoint } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChartTable } from '../../components/chartParts'
import { ColumnChart, type ColumnDatum } from '../../components/charts'
import { useToast } from '../../components/toast'
import { buttonClass, Card, IconButton, List, ListRow, Meter, PageHeader, PageLoading, SectionHeader, Segmented } from '../../components/ui'
import { db } from '../../db/db'
import { useDayCheck, useTargets } from '../../db/queries'
import { usePhases, useSettings } from '../../db/settings'
import type { FoodEntry, Meal } from '../../db/types'
import { cn } from '../../lib/cn'
import { addDays, dayLabel, formatDate, formatTime, isDateStr, todayStr } from '../../lib/dates'
import { useNow } from '../../lib/hooks'
import type { MealState } from '../../lib/dayCheck'
import { uid } from '../../lib/id'
import { averagePerDay, entryTotals, macroLine, sumNutrients, totalsByDay, ZERO_NUTRIENTS } from '../../lib/nutrition'
import { goalLabel, phaseProgressLabel } from '../../lib/phases'
import { lastPeriods, periodAxisLabel, periodTitle, type PeriodKind } from '../../lib/periods'
import { MealsSheet } from './MealsSheet'
import { fmtNum } from '../../lib/units'
import { FoodSheet } from './FoodSheet'

export default function NutritionPage() {
  const settings = useSettings()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const today = todayStr()
  const requested = params.get('date')
  const date = isDateStr(requested) && requested <= today ? requested : today
  const go = (d: string) => setParams(d === today ? {} : { date: d }, { replace: true })
  // Targets follow the phase you were in on that day.
  const { targets } = useTargets(date)
  const { on } = usePhases()
  const phase = on(date)
  const [range, setRange] = useState<PeriodKind>('day')
  const COUNT = 12
  const rangeStart = range === 'day' ? addDays(date, -6) : lastPeriods(range, date, COUNT, settings.weekStartsOn)[0].start

  const entries = useLiveQuery(() => db.foods.where('date').equals(date).toArray(), [date])
  const history = useLiveQuery(
    () => db.foods.where('date').between(rangeStart, date, true, true).toArray(),
    [rangeStart, date],
  )
  const previousDayCount = useLiveQuery(() => db.foods.where('date').equals(addDays(date, -1)).count(), [date])
  const [sheet, setSheet] = useState<{ open: boolean; meal?: Meal; entry?: FoodEntry }>({ open: false })
  const [mealsOpen, setMealsOpen] = useState(false)
  const now = useNow(60_000)
  const { meals: mealStates, supplements: daySupplements } = useDayCheck(date, date === today ? now : Number.MAX_SAFE_INTEGER)
  const stateOf = new Map(mealStates.map((s) => [s.meal.id, s]))

  // A link with ?add=<meal> opens Add food for that meal right away,
  // and closing it clears the link.
  const addFor = params.get('add')
  const closeSheet = () => {
    setSheet((s) => ({ ...s, open: false }))
    if (addFor) {
      setParams(
        (p) => {
          p.delete('add')
          return p
        },
        { replace: true },
      )
    }
  }

  if (!entries) return <PageLoading />

  const totals = sumNutrients(entries.map(entryTotals))
  const left = targets.calories - totals.calories
  const targetNote = phase
    ? `${goalLabel(phase.goal)} · ${phaseProgressLabel(phase, date).toLowerCase()}`
    : 'Goal & phases'
  // Your meals, plus "Other" for food logged under a meal you've since removed.
  const known = new Set(settings.meals.map((m) => m.id))
  const mealGroups = [
    ...settings.meals,
    ...(entries.some((e) => !known.has(e.meal)) ? [{ id: '__other', name: 'Other' }] : []),
  ]

  const copyPreviousDay = async () => {
    const from = addDays(date, -1)
    const items = await db.foods.where('date').equals(from).toArray()
    await db.foods.bulkAdd(items.map((e) => ({ ...e, id: uid(), date, createdAt: Date.now() })))
    toast(`Copied ${items.length} ${items.length === 1 ? 'item' : 'items'}`)
  }

  // Trends: the last 7 days, or the last 12 weeks / months, ending on the selected day.
  const byDay = totalsByDay(history ?? [])
  const periods =
    range === 'day'
      ? Array.from({ length: 7 }, (_, i) => {
          const d = addDays(date, i - 6)
          return { kind: 'day' as const, start: d, end: d }
        })
      : lastPeriods(range, date, COUNT, settings.weekStartsOn)
  const rows = periods.map((p) => ({ p, ...averagePerDay(byDay, p.start, p.end < date ? p.end : date) }))
  const chartData: ColumnDatum[] = rows.map(({ p, avg }) => ({
    key: p.start,
    label: periodAxisLabel(p),
    title: range === 'day' ? dayLabel(p.start) : `${periodTitle(p, today)} · average per logged day`,
    v: Math.round(avg.calories),
  }))
  const loggedDays = rows.reduce((n, r) => n + r.days, 0)
  const average = averagePerDay(byDay, rangeStart, date)
  const nutrients = [
    { label: 'Protein', value: totals.protein, target: targets.protein },
    { label: 'Carbs', value: totals.carbs, target: targets.carbs },
    { label: 'Fat', value: totals.fat, target: targets.fat },
  ]

  return (
    <>
      <PageHeader
        title="Food"
        actions={
          <>
            <IconButton label="Meals" tone="tint" onClick={() => setMealsOpen(true)}>
              <ListChecks />
            </IconButton>
            <Link
              to="/goal"
              aria-label="Goal & phases"
              title="Goal & phases"
              className="grid size-11 place-items-center rounded-full text-accent-ink transition-opacity active:opacity-60 [&_svg]:size-[22px]"
            >
              <Target />
            </Link>
          </>
        }
      />

      <div className="mb-3 flex items-center gap-1 rounded-xl bg-surface p-1">
        <IconButton label="Previous day" tone="tint" onClick={() => go(addDays(date, -1))}>
          <ChevronLeft />
        </IconButton>
        <label className="relative flex min-h-11 flex-1 cursor-pointer flex-col items-center justify-center rounded-lg transition-colors active:bg-fill">
          <span className="text-headline">{dayLabel(date)}</span>
          <span className="text-caption text-ink-2">{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <input
            type="date"
            value={date}
            max={today}
            aria-label="Choose a date"
            onClick={(e) => e.currentTarget.showPicker?.()}
            onChange={(e) => isDateStr(e.target.value) && go(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <IconButton label="Next day" tone="tint" disabled={date >= today} onClick={() => go(addDays(date, 1))}>
          <ChevronRight />
        </IconButton>
      </div>

      <Card>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-footnote text-ink-2">Eaten</p>
            <p className="font-rounded text-[48px] leading-[52px] font-semibold tracking-tight">
              {fmtNum(totals.calories)}
              <span className="ml-1 text-title3 text-ink-2">KCAL</span>
            </p>
          </div>
          <div className="pb-1 text-right">
            <p className={cn('flex items-center justify-end gap-1 text-footnote', left < 0 ? 'text-bad-ink' : 'text-ink-2')}>
              {left < 0 && <TriangleExclamationPoint className="size-3.5" aria-hidden />}
              {left < 0 ? 'Over target' : 'Left'}
            </p>
            <p className={cn('font-rounded text-title2 font-semibold', left < 0 && 'text-bad-ink')}>{fmtNum(Math.abs(left))}</p>
          </div>
        </div>
        <Meter
          className="mt-3"
          height={10}
          value={totals.calories}
          max={targets.calories}
          color="var(--nutrition)"
          label="Calories eaten against your target"
        />
        <p className="mt-2 flex flex-wrap justify-between gap-x-3 text-footnote text-ink-2">
          <span>Target {fmtNum(targets.calories)} kcal</span>
          <Link to="/goal" className="text-accent-ink active:opacity-60">
            {targetNote}
          </Link>
        </p>

        <div className="mt-4 flex flex-col gap-3 border-t-[0.5px] border-bar-line pt-4">
          {nutrients.map((m) => (
            <div key={m.label} className="grid grid-cols-[4.25rem_minmax(0,1fr)_auto] items-center gap-3">
              <span className="text-subhead">{m.label}</span>
              <Meter value={m.value} max={m.target} height={6} color="var(--nutrition)" label={`${m.label} eaten against your target`} />
              <span className="text-footnote text-ink-2 tabular-nums">
                <span className="font-semibold text-ink">{fmtNum(m.value)}</span> / {fmtNum(m.target)} g
              </span>
            </div>
          ))}
        </div>
      </Card>

      {entries.length === 0 && (previousDayCount ?? 0) > 0 && (
        <button
          type="button"
          onClick={() => void copyPreviousDay()}
          className={cn(buttonClass('outline', 'md', true), 'mt-3')}
        >
          <Copy />
          Copy {previousDayCount} {previousDayCount === 1 ? 'item' : 'items'} from the day before
        </button>
      )}

      <SectionHeader title="Meals" action={<span className="text-subhead text-ink-2 tabular-nums">{entries.length} {entries.length === 1 ? 'item' : 'items'}</span>} />
      <div className="flex flex-col gap-3">
        {mealGroups.map((m) => {
          const other = m.id === '__other'
          const items = entries
            .filter((e) => (other ? !known.has(e.meal) : e.meal === m.id))
            .sort((a, b) => a.createdAt - b.createdAt)
          const kcal = items.reduce((sum, e) => sum + entryTotals(e).calories, 0)
          const st = stateOf.get(m.id)
          return (
            <section key={m.id} className="overflow-hidden rounded-xl bg-surface">
              <div className="flex min-h-14 items-center gap-2 py-1.5 pr-1.5 pl-4">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-headline">{m.name}</h3>
                  {st && st.at != null && (
                    <p className="text-footnote text-ink-2 tabular-nums">
                      {formatTime(st.at)}
                      <MealBadge state={st.state} />
                    </p>
                  )}
                </div>
                {items.length > 0 && (
                  <span className="text-subhead text-ink-2 tabular-nums">
                    <span className="font-semibold text-ink">{fmtNum(kcal)}</span> kcal
                  </span>
                )}
                {!other && (
                  <IconButton label={`Add food to ${m.name}`} tone="tint" onClick={() => setSheet({ open: true, meal: m.id })}>
                    <Plus />
                  </IconButton>
                )}
              </div>
              {items.length > 0 && (
                <ul className="border-t-[0.5px] border-bar-line">
                  {items.map((e) => {
                    const t = entryTotals(e)
                    const servingText =
                      e.servings === 1 ? e.serving : `${fmtNum(e.servings, 2)} × ${e.serving ?? 'serving'}`
                    return (
                      <ListRow
                        key={e.id}
                        onClick={() => setSheet({ open: true, meal: e.meal, entry: e })}
                        title={e.name}
                        subtitle={[servingText, macroLine(t)].filter(Boolean).join(' · ')}
                        value={<span className="text-subhead font-semibold text-ink">{fmtNum(t.calories)}</span>}
                        chevron={false}
                      />
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      <List className="mt-3">
        <ListRow
          to="/supplements"
          icon={<Pill />}
          iconColor="var(--supplement)"
          title="Supplements"
          subtitle={
            daySupplements.due > 0
              ? `${daySupplements.taken} of ${daySupplements.due} taken ${date === today ? "today" : "this day"}`
              : "Your supplements and doses"
          }
          chevron
        />
      </List>

      <SectionHeader title="Calories" action={<span className="text-subhead text-ink-2">{range === 'day' ? 'per day' : `per day, by ${range}`}</span>} />
      <Card>
        <Segmented
          full
          ariaLabel="Trend range"
          value={range}
          onChange={setRange}
          options={[
            { value: 'day', label: '7 days' },
            { value: 'week', label: '12 weeks' },
            { value: 'month', label: '12 months' },
          ]}
        />
        <p className="mt-3 mb-4 text-footnote text-ink-2">
          {loggedDays > 0
            ? `Average ${fmtNum(average.avg.calories)} kcal and ${fmtNum(average.avg.protein)} g protein on ${loggedDays} logged ${loggedDays === 1 ? 'day' : 'days'}`
            : 'Nothing logged in this time.'}
        </p>
        <ColumnChart
          data={chartData}
          color="var(--nutrition)"
          format={(v) => `${fmtNum(v)} kcal`}
          seriesLabel={range === 'day' ? 'Calories' : 'Average calories'}
          target={targets.calories}
          selectedKey={range === 'day' ? date : undefined}
          onSelect={range === 'day' ? go : undefined}
          ariaLabel={
            range === 'day'
              ? 'Calories eaten per day over the last 7 days, with your daily target'
              : `Average calories per logged day for the last ${COUNT} ${range}s, with your daily target`
          }
        />
        <ChartTable
          columns={[range === 'day' ? 'Day' : range === 'week' ? 'Week' : 'Month', 'Calories', 'Protein', 'Carbs', 'Fat', ...(range === 'day' ? [] : ['Days logged'])]}
          rows={[...rows].reverse().map(({ p, avg, days }) => {
            const t = range === 'day' ? (byDay.get(p.start) ?? ZERO_NUTRIENTS) : avg
            return [
              range === 'day' ? dayLabel(p.start) : periodTitle(p, today),
              fmtNum(t.calories),
              `${fmtNum(t.protein)} g`,
              `${fmtNum(t.carbs)} g`,
              `${fmtNum(t.fat)} g`,
              ...(range === 'day' ? [] : [days]),
            ]
          })}
        />
      </Card>

      <FoodSheet
        open={sheet.open || addFor != null}
        onClose={closeSheet}
        date={date}
        meal={sheet.open ? sheet.meal : (addFor ?? undefined)}
        entry={sheet.open ? sheet.entry : undefined}
      />
      <MealsSheet open={mealsOpen} onClose={() => setMealsOpen(false)} />
    </>
  )
}

const BADGE: Partial<Record<MealState, { text: string; className: string }>> = {
  eaten: { text: 'Eaten, not logged', className: 'text-accent-ink' },
  skipped: { text: 'Skipped', className: 'text-ink-2' },
  open: { text: 'Nothing logged yet', className: 'text-ink-2' },
}

function MealBadge({ state }: { state: MealState }) {
  const b = BADGE[state]
  if (!b) return null
  return <span className={b.className}> · {b.text}</span>
}
