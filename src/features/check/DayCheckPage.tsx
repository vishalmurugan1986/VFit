import { useLiveQuery } from 'dexie-react-hooks'
import { Check, ChevronLeft, ChevronRight, MoonStar } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useToast } from '../../components/toast'
import { Dial } from '../../components/Dial'
import { Button, Card, IconButton, PageHeader, PageLoading } from '../../components/ui'
import { db } from '../../db/db'
import { closeDay, useDayCheck } from '../../db/queries'
import { useSettings } from '../../db/settings'
import { cn } from '../../lib/cn'
import { addDays, dateStrFromTs, dayLabel, dayStartTs, formatDate, formatTime, isDateStr, parseDateStr, todayStr } from '../../lib/dates'
import { dayProgress, mealItems, workoutItem } from '../../lib/dayCheck'
import { useNow } from '../../lib/hooks'
import { routinesOn } from '../../lib/schedule'
import { isScheduled } from '../../lib/supplements'
import { FoodSheet } from '../nutrition/FoodSheet'
import { DayChecklist } from './DayChecklist'

/** /check: the before-bed check for today (or ?date= an earlier day). */
export default function DayCheckPage() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const today = todayStr()
  const requested = params.get('date')
  const date = isDateStr(requested) && requested <= today ? requested : today
  const live = useNow(60_000)
  // A past day is judged as it stood at midnight, so "later today" counts as not done.
  const now = date === today ? live : dayStartTs(addDays(date, 1)) - 1
  const data = useDayCheck(date, now)
  const [food, setFood] = useState<{ open: boolean; meal?: string }>({ open: false })
  const go = (d: string) => setParams(d === today ? {} : { date: d }, { replace: true })

  if (!data.ready) return <PageLoading />
  const { done, total, open } = data.progress
  const closed = data.check?.closedAt

  return (
    <>
      <PageHeader back="/" eyebrow={formatDate(date, { weekday: 'long', day: 'numeric', month: 'short' })} title="Day check" />
      <p className="-mt-1 mb-3 text-subhead text-ink-2">
        Before bed, tick off what you did {date === today ? 'today' : 'that day'}. Meals with food logged and workouts you logged
        are ticked already.
      </p>

      <div className="mb-3 flex items-center justify-between gap-2">
        <IconButton label="Day before" onClick={() => go(addDays(date, -1))}>
          <ChevronLeft />
        </IconButton>
        <p className="font-semibold">{dayLabel(date)}</p>
        <IconButton label="Next day" disabled={date >= today} onClick={() => go(addDays(date, 1))}>
          <ChevronRight />
        </IconButton>
      </div>

      <Card>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">
            {done} of {total} done
          </h2>
          {open > 0 && <span className="text-footnote text-ink-2">{open} open</span>}
        </div>
        <div className="mt-1">
          <DayChecklist date={date} data={data} onAddFood={(meal) => setFood({ open: true, meal })} />
        </div>
      </Card>

      {closed ? (
        <p className="mt-4 flex items-center justify-center gap-1.5 text-subhead text-ink-2">
          <MoonStar className="size-4" aria-hidden />
          Day closed at {formatTime(closed)}
        </p>
      ) : (
        <Button
          variant="primary"
          size="lg"
          full
          className="mt-4"
          onClick={() => {
            void closeDay(date)
            toast(open ? `Day closed with ${open} open. Sleep well.` : 'All done today. Sleep well.')
          }}
        >
          <Check />
          {open ? 'Close the day anyway' : 'Close the day'}
        </Button>
      )}

      <WeekStrip end={today} selected={date} onPick={go} />

      <p className="mt-4 text-center text-footnote text-ink-2">
        An alarm can remind you at bedtime: <Link to="/alarm" className="text-accent-ink hover:underline">Alarms</Link>.
      </p>

      <FoodSheet open={food.open} onClose={() => setFood({ open: false })} date={date} meal={food.meal} />
    </>
  )
}

/** The last seven days: how much of each day was checked off. */
function WeekStrip({ end, selected, onPick }: { end: string; selected: string; onPick: (d: string) => void }) {
  const settings = useSettings()
  const start = addDays(end, -6)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const stats = useLiveQuery(async () => {
    const [foods, checks, workouts, routines, supplements, logs] = await Promise.all([
      db.foods.where('date').between(start, end, true, true).toArray(),
      db.dayChecks.where('date').between(start, end, true, true).toArray(),
      db.workouts.where('startedAt').between(dayStartTs(start), dayStartTs(addDays(end, 1)), true, false).toArray(),
      db.routines.toArray(),
      db.supplements.toArray(),
      db.supplementLogs.where('date').between(start, end, true, true).toArray(),
    ])
    return days.map((d) => {
      const now = d === end ? Date.now() : dayStartTs(addDays(d, 1)) - 1
      const check = checks.find((c) => c.date === d)
      const meals = mealItems(settings.meals, d, now, new Set(foods.filter((f) => f.date === d).map((f) => f.meal)), check)
      const trained = workouts.some((w) => dateStrFromTs(w.startedAt) === d)
      const workout = workoutItem(routinesOn(routines, d), d, now, trained, settings.sessions, check)
      const due = supplements.filter((s) => isScheduled(s, d))
      const taken = due.filter((s) => logs.some((l) => l.date === d && l.supplementId === s.id)).length
      return { date: d, closed: check?.closedAt != null, ...dayProgress(meals, workout, { due: due.length, taken }) }
    })
  }, [start, end, settings.meals, settings.sessions])

  if (!stats) return null
  return (
    <Card className="mt-4">
      <h2 className="mb-2 font-semibold">Last 7 days</h2>
      <div className="grid grid-cols-7 gap-1">
        {stats.map((s) => {
          const pct = s.total ? s.done / s.total : 0
          return (
            <button
              key={s.date}
              type="button"
              onClick={() => onPick(s.date)}
              aria-label={`${formatDate(s.date, { weekday: 'long' })}: ${s.done} of ${s.total} done`}
              className={cn('flex flex-col items-center gap-1 rounded-xl py-2', s.date === selected && 'bg-fill')}
            >
              <span className="text-caption2 font-medium text-ink-2">{formatDate(s.date, { weekday: 'narrow' })}</span>
              <MiniRing pct={pct} />
              <span className="text-caption2 text-ink-2 tabular-nums">{parseDateStr(s.date).getDate()}</span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function MiniRing({ pct }: { pct: number }) {
  return <Dial value={pct} max={1} color="var(--accent)" size={30} stroke={5} label={`${Math.round(pct * 100)}% done`} />
}
