import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { ChartTable } from '../../components/chartParts'
import { ColumnChart, type ColumnDatum } from '../../components/charts'
import { Card, Segmented } from '../../components/ui'
import { db } from '../../db/db'
import { useSettings } from '../../db/settings'
import { dateStrFromTs, formatDuration, todayStr } from '../../lib/dates'
import { inPeriod, lastPeriods, periodAxisLabel, periodsBetween, periodTitle } from '../../lib/periods'
import { workoutStats } from '../../lib/strength'
import { fmtNum } from '../../lib/units'

type Span = 'week' | 'month' | 'year'

/** How often you train: workouts per week, month or year, with all-time totals. */
export function TrainingChart() {
  const { weekStartsOn } = useSettings()
  const [span, setSpan] = useState<Span>('week')
  const workouts = useLiveQuery(
    () =>
      db.workouts
        .orderBy('startedAt')
        .filter((w) => w.finishedAt != null)
        .toArray(),
    [],
  )
  if (!workouts?.length) return null

  const today = todayStr()
  const rows = workouts.map((w) => {
    const s = workoutStats(w)
    return {
      date: dateStrFromTs(w.startedAt),
      sets: s.sets,
      sec: s.durationSec,
    }
  })
  const periods =
    span === 'year' ? periodsBetween('year', rows[0].date, today, weekStartsOn) : lastPeriods(span, today, 12, weekStartsOn)
  const buckets = periods.map((p) => {
    const inside = rows.filter((r) => inPeriod(p, r.date))
    return { p, workouts: inside.length, sets: inside.reduce((n, r) => n + r.sets, 0), sec: inside.reduce((n, r) => n + r.sec, 0) }
  })
  const data: ColumnDatum[] = buckets.map((b) => ({
    key: b.p.start,
    label: periodAxisLabel(b.p),
    title: periodTitle(b.p, today),
    v: b.workouts,
  }))
  const totalSets = rows.reduce((n, r) => n + r.sets, 0)
  const totalSec = rows.reduce((n, r) => n + r.sec, 0)

  return (
    <Card className="mt-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Workouts per {span}</h2>
        <Segmented
          size="sm"
          ariaLabel="Group by"
          value={span}
          onChange={setSpan}
          options={[
            { value: 'week', label: 'Weeks' },
            { value: 'month', label: 'Months' },
            { value: 'year', label: 'Years' },
          ]}
        />
      </div>
      <p className="mb-3 text-footnote text-ink-2">
        All time: {fmtNum(rows.length)} {rows.length === 1 ? 'workout' : 'workouts'} · {fmtNum(totalSets)} working sets ·{' '}
        {formatDuration(totalSec)}
      </p>
      <ColumnChart
        data={data}
        color="var(--strength)"
        format={(v) => `${fmtNum(v)} ${v === 1 ? 'workout' : 'workouts'}`}
        seriesLabel="Workouts"
        ariaLabel={`Workouts per ${span}`}
      />
      <ChartTable
        columns={[span === 'week' ? 'Week' : span === 'month' ? 'Month' : 'Year', 'Workouts', 'Working sets', 'Time']}
        rows={[...buckets].reverse().map((b) => [periodTitle(b.p, today), b.workouts, b.sets, formatDuration(b.sec)])}
      />
    </Card>
  )
}
