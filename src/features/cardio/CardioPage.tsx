import { useLiveQuery } from 'dexie-react-hooks'
import { Activity, ListChecks, Plus, TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { ChartTable } from '../../components/chartParts'
import { ColumnChart, type ColumnDatum } from '../../components/charts'
import {
  Button,
  Card,
  EmptyState,
  IconButton,
  List,
  ListRow,
  PageHeader,
  PageLoading,
  Segmented,
  SectionHeader,
  type Delta,
} from '../../components/ui'
import { db } from '../../db/db'
import { useCardioTypes } from '../../db/queries'
import { useSettings } from '../../db/settings'
import type { CardioSession, CardioType } from '../../db/types'
import { cardioTotals, paceLabel } from '../../lib/cardio'
import { cn } from '../../lib/cn'
import { addDays, dayLabel, formatDate, formatDuration, startOfWeek, todayStr } from '../../lib/dates'
import { inPeriod, lastPeriods, periodAxisLabel, periodsBetween, periodTitle } from '../../lib/periods'
import { fmtNum, round } from '../../lib/units'
import { ActivitiesSheet } from './ActivityManager'
import { CARDIO_ICONS } from './activityIcons'
import { CardioSheet } from './CardioSheet'

type Span = 'week' | 'month' | 'year'
const COUNT = 12
const PAGE = 40
const km = (v: number, digits = 1) => `${fmtNum(v, digits)} km`

export default function CardioPage() {
  const settings = useSettings()
  const { typeOf } = useCardioTypes()
  const sessions = useLiveQuery(() => db.cardio.orderBy('date').reverse().toArray(), [])
  const [sheet, setSheet] = useState<{ open: boolean; session?: CardioSession }>({ open: false })
  const [manage, setManage] = useState(false)
  const [metric, setMetric] = useState<'distance' | 'time'>('distance')
  const [span, setSpan] = useState<Span>('week')
  const [limit, setLimit] = useState(PAGE)

  if (!sessions) return <PageLoading />

  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  const today = todayStr()
  const thisWeek = startOfWeek(today, settings.weekStartsOn)
  const between = (from: string, to: string) => sorted.filter((s) => s.date >= from && s.date < to)

  const current = cardioTotals(between(thisWeek, addDays(thisWeek, 7)))
  const previous = cardioTotals(between(addDays(thisWeek, -7), thisWeek))
  const diffKm = current.distanceKm - previous.distanceKm
  const distanceDelta: Delta | null =
    previous.sessions === 0 && current.sessions === 0
      ? null
      : {
          text: `${diffKm >= 0 ? '+' : '−'}${km(Math.abs(diffKm))} vs last week`,
          tone: diffKm > 0 ? 'good' : 'neutral',
          direction: diffKm > 0 ? 'up' : diffKm < 0 ? 'down' : 'flat',
        }

  // Weeks and months: the last 12. Years: every year since your first session.
  const oldest = sorted[sorted.length - 1]?.date ?? today
  const periods =
    span === 'year'
      ? periodsBetween('year', oldest, today, settings.weekStartsOn)
      : lastPeriods(span, today, COUNT, settings.weekStartsOn)
  const buckets = periods.map((p) => ({ p, ...cardioTotals(sorted.filter((x) => inPeriod(p, x.date))) }))
  const chartData: ColumnDatum[] = buckets.map((b) => ({
    key: b.p.start,
    label: periodAxisLabel(b.p),
    title: periodTitle(b.p, today),
    v: metric === 'distance' ? round(b.distanceKm, 1) : round(b.durationSec / 3600, 2),
  }))
  const allTime = cardioTotals(sorted)
  const formatMetric = (v: number) => (metric === 'distance' ? km(v) : formatDuration(v * 3600))

  // History grouped by week, newest first.
  const groups: { start: string; items: CardioSession[] }[] = []
  for (const s of sorted.slice(0, limit)) {
    const start = startOfWeek(s.date, settings.weekStartsOn)
    const last = groups[groups.length - 1]
    if (last?.start === start) last.items.push(s)
    else groups.push({ start, items: [s] })
  }
  const weekLabel = (start: string) =>
    start === thisWeek
      ? 'This week'
      : start === addDays(thisWeek, -7)
        ? 'Last week'
        : `${formatDate(start, { day: 'numeric', month: 'short' })} – ${formatDate(addDays(start, 6), { day: 'numeric', month: 'short' })}`

  return (
    <>
      <PageHeader
        title="Cardio"
        actions={
          <>
            <IconButton label="Activities" tone="tint" onClick={() => setManage(true)}>
              <ListChecks />
            </IconButton>
            <Button size="sm" variant="primary" onClick={() => setSheet({ open: true })}>
              <Plus />
              Log
            </Button>
          </>
        }
      />

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Activity />}
          title="No cardio yet"
          action={
            <Button variant="primary" onClick={() => setSheet({ open: true })}>
              <Plus />
              Log a session
            </Button>
          }
        >
          Log walks, runs, rides and swims to track your weekly distance and pace. Add your own activities with
          Activities.
        </EmptyState>
      ) : (
        <>
          <Card>
            <p className="text-footnote text-ink-2">This week</p>
            <div className="mt-0.5 flex items-end justify-between gap-3">
              <p className="font-rounded text-[48px] leading-[52px] font-semibold tracking-tight">
                {fmtNum(current.distanceKm, 1)}
                <span className="ml-1 text-title3 text-ink-2">KM</span>
              </p>
              <div className="pb-1.5 text-right text-subhead text-ink-2 tabular-nums">
                <p>{formatDuration(current.durationSec)}</p>
                <p>
                  {current.sessions} {current.sessions === 1 ? 'session' : 'sessions'}
                </p>
              </div>
            </div>
            {distanceDelta && (
              <p
                className={cn(
                  'mt-1 flex items-center gap-1 text-footnote',
                  distanceDelta.tone === 'good' ? 'text-good-ink' : 'text-ink-2',
                )}
              >
                {distanceDelta.direction === 'up' && <TrendingUp className="size-3.5" aria-hidden />}
                {distanceDelta.direction === 'down' && <TrendingDown className="size-3.5" aria-hidden />}
                {distanceDelta.text}
              </p>
            )}
          </Card>

          <SectionHeader
            title={span === 'week' ? 'By week' : span === 'month' ? 'By month' : 'By year'}
            action={<span className="text-subhead text-ink-2">{metric === 'distance' ? 'km' : 'hours'}</span>}
          />
          <Card>
            <Segmented
              full
              ariaLabel="Group by"
              value={span}
              onChange={setSpan}
              options={[
                { value: 'week', label: 'Weeks' },
                { value: 'month', label: 'Months' },
                { value: 'year', label: 'Years' },
              ]}
            />
            <div className="mt-3 mb-4 flex items-center justify-between gap-3">
              <p className="min-w-0 text-footnote text-ink-2">
                All time: {km(allTime.distanceKm, 0)} · {formatDuration(allTime.durationSec)} · {allTime.sessions}{' '}
                {allTime.sessions === 1 ? 'session' : 'sessions'}
              </p>
              <Segmented
                size="sm"
                ariaLabel="Chart shows"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: 'distance', label: 'Distance' },
                  { value: 'time', label: 'Time' },
                ]}
              />
            </div>
            <ColumnChart
              data={chartData}
              color="var(--cardio)"
              format={formatMetric}
              yFormat={(v) => fmtNum(v, 1)}
              seriesLabel={metric === 'distance' ? 'Distance' : 'Time'}
              ariaLabel={`Cardio ${metric} by ${span}`}
            />
            <ChartTable
              columns={[span === 'week' ? 'Week' : span === 'month' ? 'Month' : 'Year', 'Distance', 'Time', 'Sessions']}
              rows={[...buckets]
                .reverse()
                .map((b) => [periodTitle(b.p, today), km(b.distanceKm), formatDuration(b.durationSec), b.sessions])}
            />
          </Card>

          <SectionHeader title="History" />
          <div className="flex flex-col gap-5">
            {groups.map((g) => {
              const t = cardioTotals(g.items)
              return (
                <section key={g.start}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 px-4 text-footnote text-ink-2">
                    <h3 className="uppercase">{weekLabel(g.start)}</h3>
                    <span className="tabular-nums">
                      {km(t.distanceKm)} · {formatDuration(t.durationSec)}
                    </span>
                  </div>
                  <List>
                    {g.items.map((s) => (
                      <CardioRow
                        key={s.id}
                        session={s}
                        type={typeOf(s.activity)}
                        onOpen={() => setSheet({ open: true, session: s })}
                      />
                    ))}
                  </List>
                </section>
              )
            })}
          </div>
          {sorted.length > limit && (
            <Button variant="outline" full className="mt-3" onClick={() => setLimit((l) => l + PAGE)}>
              Show more
            </Button>
          )}
        </>
      )}

      <CardioSheet
        open={sheet.open}
        session={sheet.session}
        defaultActivity={sorted[0]?.activity}
        onClose={() => setSheet({ open: false })}
      />
      <ActivitiesSheet open={manage} onClose={() => setManage(false)} />
    </>
  )
}

function CardioRow({ session: s, type, onOpen }: { session: CardioSession; type: CardioType; onOpen: () => void }) {
  const Icon = CARDIO_ICONS[type.icon] ?? CARDIO_ICONS.activity
  const details = [
    formatDuration(s.durationSec),
    paceLabel(type.measure, s.distanceKm, s.durationSec),
    s.calories ? `${s.calories} kcal` : null,
    s.avgHr ? `${s.avgHr} bpm` : null,
  ].filter(Boolean)
  return (
    <ListRow
      onClick={onOpen}
      icon={<Icon aria-hidden />}
      iconColor="var(--cardio)"
      title={type.name}
      subtitle={`${dayLabel(s.date)} · ${details.join(' · ')}`}
      value={
        s.distanceKm ? (
          <span className="font-rounded text-headline text-ink">
            {fmtNum(s.distanceKm, 2)}
            <span className="ml-0.5 text-footnote font-semibold text-ink-2">KM</span>
          </span>
        ) : null
      }
      chevron={false}
    />
  )
}
