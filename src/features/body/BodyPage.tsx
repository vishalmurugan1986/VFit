import { useLiveQuery } from 'dexie-react-hooks'
import { Gauge, Plus, Target } from 'lucide-react'
import { useState } from 'react'
import { ChartTable, Legend } from '../../components/chartParts'
import { TimeChart } from '../../components/charts'
import {
  Button,
  Card,
  Chip,
  EmptyState,
  List,
  ListRow,
  PageHeader,
  PageLoading,
  SectionHeader,
  Segmented,
  Stat,
  type Delta,
} from '../../components/ui'
import { db } from '../../db/db'
import { usePhases } from '../../db/settings'
import type { BodyEntry } from '../../db/types'
import { bmi, bmiCategory } from '../../lib/body'
import { cn } from '../../lib/cn'
import { addDays, dateStrFromTs, DAY_MS, dayLabel, dayStartTs, formatDate, todayStr } from '../../lib/dates'
import { GOAL_COLOR, goalLabel, phaseStats } from '../../lib/phases'
import { movingAverage, valueOnOrBefore } from '../../lib/series'
import { fmtNum } from '../../lib/units'
import { BodySheet } from './BodySheet'

type MetricKey = 'weight' | 'bodyFat'
type RangeKey = '1M' | '3M' | '6M' | '1Y' | 'All'

const RANGES: { value: RangeKey; days: number | null }[] = [
  { value: '1M', days: 30 },
  { value: '3M', days: 91 },
  { value: '6M', days: 182 },
  { value: '1Y', days: 365 },
  { value: 'All', days: null },
]

const METRICS: { key: MetricKey; label: string; unit: string }[] = [
  { key: 'weight', label: 'Weight', unit: 'kg' },
  { key: 'bodyFat', label: 'Body fat', unit: '%' },
]

const valueOf = (e: BodyEntry, k: MetricKey): number | null => (k === 'weight' ? e.weightKg : e.bodyFatPct)
const format = (k: MetricKey, v: number) => (k === 'bodyFat' ? `${fmtNum(v, 1)}%` : `${fmtNum(v, 1)} kg`)
const PAGE = 14

export default function BodyPage() {
  const { current, currentSpan, spans } = usePhases()
  const entries = useLiveQuery(() => db.body.orderBy('date').toArray(), [])
  const [sheet, setSheet] = useState<{ open: boolean; entry?: BodyEntry }>({ open: false })
  const [metric, setMetric] = useState<MetricKey>('weight')
  const [range, setRange] = useState<RangeKey>('3M')
  const [limit, setLimit] = useState(PAGE)

  if (!entries) return <PageLoading />

  const today = todayStr()
  const todays = entries.find((e) => e.date === today)
  const openLog = () => setSheet({ open: true, entry: todays })

  const available = METRICS.filter((m) => entries.some((e) => valueOf(e, m.key) != null))
  const active = available.some((m) => m.key === metric) ? metric : (available[0]?.key ?? 'weight')
  const activeLabel = METRICS.find((m) => m.key === active)?.label ?? 'Weight'

  // 7-day trend for weight (computed over all history, then clipped to the range).
  const points = entries
    .filter((e) => valueOf(e, active) != null)
    .map((e) => ({ t: dayStartTs(e.date), v: valueOf(e, active)! }))
  const series = active === 'weight' ? movingAverage(points) : points.map((p) => ({ ...p, avg: null }))
  const days = RANGES.find((r) => r.value === range)?.days ?? null
  const cutoff = days == null ? -Infinity : dayStartTs(addDays(today, -days))
  const data = series.filter((p) => p.t >= cutoff)

  // Headline numbers.
  const newestFirst = [...entries].reverse()
  const latest = newestFirst.find((e) => e.weightKg != null)
  const latestHeight = newestFirst.find((e) => e.heightCm != null)?.heightCm ?? null
  const latestFat = newestFirst.find((e) => e.bodyFatPct != null)
  const goal = current?.targetWeightKg ?? null
  let change: Delta | null = null
  if (latest?.weightKg != null) {
    const monthAgo = valueOnOrBefore(entries, addDays(latest.date, -30), (e) => e.weightKg)
    const first = entries.find((e) => e.weightKg != null)?.weightKg ?? null
    const base = monthAgo ?? (first !== latest.weightKg ? first : null)
    if (base != null) {
      const diff = latest.weightKg - base
      const towardsGoal = goal != null && Math.abs(latest.weightKg - goal) < Math.abs(base - goal)
      change = {
        text: `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${fmtNum(Math.abs(diff), 1)} kg ${monthAgo != null ? 'in 30 days' : 'since start'}`,
        tone: goal == null || Math.abs(diff) < 0.05 ? 'neutral' : towardsGoal ? 'good' : 'bad',
        direction: diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'flat',
      }
    }
  }
  // Results of the current phase so far.
  const weights = entries.filter((e) => e.weightKg != null).map((e) => ({ date: e.date, kg: e.weightKg! }))
  const phaseSoFar = currentSpan
    ? phaseStats(currentSpan, { weights, kcalByDay: new Map(), workoutDates: [], cardio: [] }, today)
    : null
  const bands =
    active === 'weight' && spans.length > 1
      ? spans.map((sp) => ({
          from: dayStartTs(sp.start),
          to: dayStartTs(sp.end ?? today) + DAY_MS - 1,
          label: goalLabel(sp.phase.goal),
          color: GOAL_COLOR[sp.phase.goal],
        }))
      : undefined
  const currentBmi = latest?.weightKg != null && latestHeight != null ? bmi(latest.weightKg, latestHeight) : null

  return (
    <>
      <PageHeader
        title="Body"
        actions={
          <Button size="sm" variant="primary" onClick={openLog}>
            <Plus />
            Log
          </Button>
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={<Gauge />}
          title="No entries yet"
          action={
            <Button variant="primary" onClick={openLog}>
              <Plus />
              Log weight and height
            </Button>
          }
        >
          Log your weight and height. A 7-day average smooths out daily ups and downs, and your height gives your BMI.
        </EmptyState>
      ) : (
        <>
          <Card>
            <p className="text-footnote text-ink-2">{latest ? `Weight · ${dayLabel(latest.date)}` : 'Weight'}</p>
            <p className="mt-0.5 font-rounded text-[48px] leading-[52px] font-semibold tracking-tight">
              {latest?.weightKg != null ? fmtNum(latest.weightKg, 1) : '–'}
              {latest?.weightKg != null && <span className="ml-1 text-title3 text-ink-2">KG</span>}
            </p>
            {change && (
              <p
                className={cn(
                  'mt-1 text-footnote',
                  change.tone === 'good' ? 'text-good-ink' : change.tone === 'bad' ? 'text-bad-ink' : 'text-ink-2',
                )}
              >
                {change.text}
              </p>
            )}
            <div className="mt-4 grid grid-cols-3 gap-3 border-t-[0.5px] border-bar-line pt-4">
              <Stat
                label="Target"
                value={goal != null ? fmtNum(goal, 1) : '–'}
                unit={goal != null ? 'kg' : undefined}
                delta={
                  goal != null && latest?.weightKg != null
                    ? Math.abs(latest.weightKg - goal) < 0.25
                      ? { text: 'Reached', tone: 'good' }
                      : { text: `${fmtNum(Math.abs(latest.weightKg - goal), 1)} kg to go`, tone: 'neutral' }
                    : { text: 'Not set', tone: 'neutral' }
                }
              />
              <Stat
                label="BMI"
                value={currentBmi != null ? fmtNum(currentBmi, 1) : '–'}
                delta={
                  currentBmi != null
                    ? { text: bmiCategory(currentBmi), tone: 'neutral' }
                    : { text: latestHeight == null ? 'Add height' : 'Add weight', tone: 'neutral' }
                }
              />
              <Stat
                label="Body fat"
                value={latestFat?.bodyFatPct != null ? fmtNum(latestFat.bodyFatPct, 1) : '–'}
                unit={latestFat ? '%' : undefined}
                delta={latestFat ? { text: dayLabel(latestFat.date), tone: 'neutral' } : { text: 'Optional', tone: 'neutral' }}
              />
            </div>
          </Card>

          {current && (
            <List className="mt-3">
              <ListRow
                to="/goal"
                icon={<Target />}
                iconColor={GOAL_COLOR[current.goal]}
                title={`${goalLabel(current.goal)} since ${formatDate(current.startDate, { day: 'numeric', month: 'short' })}`}
                subtitle={
                  phaseSoFar?.change != null
                    ? `${phaseSoFar.change > 0 ? '+' : phaseSoFar.change < 0 ? '−' : '±'}${fmtNum(Math.abs(phaseSoFar.change), 1)} kg${
                        phaseSoFar.perWeek != null
                          ? ` · ${phaseSoFar.perWeek > 0 ? '+' : phaseSoFar.perWeek < 0 ? '−' : '±'}${fmtNum(Math.abs(phaseSoFar.perWeek), 2)} kg a week`
                          : ''
                      }`
                    : goal == null
                      ? 'Set a target weight for this phase'
                      : undefined
                }
              />
            </List>
          )}

          {available.length > 0 && (
            <>
              <SectionHeader title={activeLabel} />
              <Card>
                {available.length > 1 && (
                  <div className="mb-3 flex gap-2">
                    {available.map((m) => (
                      <Chip key={m.key} selected={active === m.key} onClick={() => setMetric(m.key)}>
                        {m.label}
                      </Chip>
                    ))}
                  </div>
                )}
                <Segmented
                  full
                  className="mb-4"
                  ariaLabel="Time range"
                  value={range}
                  onChange={setRange}
                  options={RANGES.map((r) => ({ value: r.value, label: r.value }))}
                />
                {data.length === 0 ? (
                  <p className="py-12 text-center text-subhead text-ink-2">No entries in this time range.</p>
                ) : (
                  <>
                    <TimeChart
                      data={data}
                      color="var(--body)"
                      format={(v) => format(active, v)}
                      seriesLabel={active === 'weight' ? 'Weigh-in' : activeLabel}
                      avgLabel={active === 'weight' ? '7-day average' : undefined}
                      goal={active === 'weight' && goal != null ? { value: goal, label: `Target ${fmtNum(goal, 1)}` } : null}
                      bands={bands}
                      ariaLabel={`${activeLabel} over time`}
                    />
                    {active === 'weight' && (
                      <div className="mt-3">
                        <Legend
                          items={[
                            { label: '7-day average', color: 'var(--body)', shape: 'line' },
                            { label: 'Weigh-ins', color: 'var(--body)', shape: 'dot' },
                          ]}
                        />
                      </div>
                    )}
                  </>
                )}
                <ChartTable
                  columns={['Date', activeLabel, ...(active === 'weight' ? ['7-day avg'] : [])]}
                  rows={[...data]
                    .reverse()
                    .map((p) => [
                      formatDate(dateStrFromTs(p.t), { day: 'numeric', month: 'short', year: 'numeric' }),
                      format(active, p.v),
                      ...(active === 'weight' ? [p.avg != null ? format(active, p.avg) : ''] : []),
                    ])}
                />
              </Card>
            </>
          )}

          <SectionHeader title="History" />
          <List>
            {newestFirst.slice(0, limit).map((e, i) => {
              const prev = newestFirst.slice(i + 1).find((x) => x.weightKg != null)
              const diff = e.weightKg != null && prev?.weightKg != null ? e.weightKg - prev.weightKg : null
              const parts = [
                e.bodyFatPct != null ? `${fmtNum(e.bodyFatPct, 1)}% body fat` : null,
                e.weightKg == null && e.heightCm != null ? `Height ${fmtNum(e.heightCm)} cm` : null,
                e.note ?? null,
              ].filter(Boolean)
              return (
                <ListRow
                  key={e.id}
                  onClick={() => setSheet({ open: true, entry: e })}
                  title={dayLabel(e.date)}
                  subtitle={parts.length > 0 ? parts.join(' · ') : undefined}
                  value={
                    e.weightKg != null ? (
                      <span className="flex items-baseline gap-2">
                        {diff != null && Math.abs(diff) >= 0.05 && (
                          <span className="text-footnote text-ink-2">
                            {diff > 0 ? '+' : '−'}
                            {fmtNum(Math.abs(diff), 1)}
                          </span>
                        )}
                        <span className="font-semibold text-ink">{fmtNum(e.weightKg, 1)} kg</span>
                      </span>
                    ) : null
                  }
                  chevron={false}
                />
              )
            })}
          </List>
          {newestFirst.length > limit && (
            <Button variant="outline" full className="mt-3" onClick={() => setLimit((l) => l + PAGE)}>
              Show more
            </Button>
          )}
        </>
      )}

      <BodySheet open={sheet.open} entry={sheet.entry} onClose={() => setSheet({ open: false })} />
    </>
  )
}
