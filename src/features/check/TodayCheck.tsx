import { ChevronRight, MoonStar } from 'lucide-react'
import { Link } from 'react-router'
import { buttonClass, Card, SectionHeader } from '../../components/ui'
import { useDayCheck, useFirstActiveDay } from '../../db/queries'
import { useSettings } from '../../db/settings'
import { cn } from '../../lib/cn'
import { addDays, dayStartTs, formatTime } from '../../lib/dates'
import { isBedCheckTime, showYesterdayNudge } from '../../lib/dayCheck'
import { DayChecklist } from './DayChecklist'

/** Today's checklist on the Today screen, with the before-bed check once it's nearly bedtime. */
export function TodayCheck({ date, now, onAddFood }: { date: string; now: number; onAddFood: (meal: string) => void }) {
  const { bedTime } = useSettings()
  const data = useDayCheck(date, now)
  if (!data.ready) return null
  const { done, total } = data.progress
  const bedCheck = isBedCheckTime(now, date, bedTime)
  const closed = data.check?.closedAt

  return (
    <>
      <SectionHeader
        title="Today's check"
        action={
          <Link to="/check" className="relative before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] text-body text-accent-ink tabular-nums transition-opacity active:opacity-60">
            {done} of {total} done
          </Link>
        }
      />
      <Card padded={false} className={cn('px-4 py-1', bedCheck && !closed && 'border-accent-line')}>
        <DayChecklist date={date} data={data} onAddFood={onAddFood} />
        {closed ? (
          <p className="flex items-center gap-1.5 border-t-[0.5px] border-bar-line py-3 text-footnote text-ink-2">
            <MoonStar className="size-4" aria-hidden />
            Day closed at {formatTime(closed)}. Sleep well.
          </p>
        ) : bedCheck ? (
          <div className="border-t-[0.5px] border-bar-line py-3">
            <Link to="/check" className={buttonClass('primary', 'md', true)}>
              <MoonStar />
              Before-bed check
            </Link>
          </div>
        ) : null}
      </Card>
    </>
  )
}

/** In the morning, a nudge to finish yesterday's check if it was left open. */
export function YesterdayNudge({ today, now }: { today: string; now: number }) {
  const yesterday = addDays(today, -1)
  const data = useDayCheck(yesterday, dayStartTs(today) - 1)
  const firstActiveDay = useFirstActiveDay()
  if (!data.ready || firstActiveDay === undefined) return null
  const n = data.progress.open
  if (!showYesterdayNudge({ today, now, firstActiveDay, closed: Boolean(data.check?.closedAt), open: n })) return null
  return (
    <Link
      to={`/check?date=${yesterday}`}
      className="mt-3 flex items-center gap-3 rounded-xl bg-accent-soft p-4 transition-opacity active:opacity-70"
    >
      <MoonStar className="size-6 shrink-0 text-accent-ink" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-headline">Finish yesterday's check</span>
        <span className="block text-footnote text-ink-2">
          {n} {n === 1 ? 'thing' : 'things'} not checked off
        </span>
      </span>
      <ChevronRight className="size-[18px] shrink-0 text-accent-ink" aria-hidden />
    </Link>
  )
}
