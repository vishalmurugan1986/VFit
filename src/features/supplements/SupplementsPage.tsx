import { useLiveQuery } from 'dexie-react-hooks'
import { Pill, Plus } from 'lucide-react'
import { useState } from 'react'
import { Legend } from '../../components/chartParts'
import { Button, Card, EmptyState, Meter, PageHeader, PageLoading, SectionHeader } from '../../components/ui'
import { db } from '../../db/db'
import type { Supplement } from '../../db/types'
import { cn } from '../../lib/cn'
import { addDays, formatDate, todayStr } from '../../lib/dates'
import { adherence, daysLabel, isScheduled, timeLabel } from '../../lib/supplements'
import { SupplementChecklist } from './SupplementChecklist'
import { SupplementSheet } from './SupplementSheet'

export default function SupplementsPage() {
  const today = todayStr()
  const supplements = useLiveQuery(() => db.supplements.orderBy('order').toArray(), [])
  const logs = useLiveQuery(
    () => db.supplementLogs.where('date').between(addDays(today, -29), today, true, true).toArray(),
    [today],
  )
  const [sheet, setSheet] = useState<{ open: boolean; supplement?: Supplement }>({ open: false })

  if (!supplements || !logs) return <PageLoading />

  const active = supplements.filter((s) => !s.paused)
  const dueToday = active.filter((s) => isScheduled(s, today))
  const notToday = active.filter((s) => !isScheduled(s, today))
  const paused = supplements.filter((s) => s.paused)
  const takenToday = dueToday.filter((s) => logs.some((l) => l.date === today && l.supplementId === s.id)).length
  const open = (supplement?: Supplement) => setSheet({ open: true, supplement })
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))

  return (
    <>
      <PageHeader
        title="Supplements"
        back="/nutrition"
        subtitle={dueToday.length ? `Today · ${takenToday} of ${dueToday.length} taken` : undefined}
        actions={
          <Button size="sm" variant="primary" onClick={() => open()}>
            <Plus />
            Add
          </Button>
        }
      />

      {supplements.length === 0 ? (
        <EmptyState
          icon={<Pill />}
          title="No supplements yet"
          action={
            <Button variant="primary" onClick={() => open()}>
              <Plus />
              Add a supplement
            </Button>
          }
        >
          Add what you take, such as creatine, whey or vitamin D3, and when. Then tick each one off as you take it.
        </EmptyState>
      ) : (
        <>
          {dueToday.length > 0 ? (
            <Card padded={false} className="pb-2">
              <div className="px-4 pt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-semibold">Today</h2>
                  <span className="text-footnote text-ink-2 tabular-nums">
                    {takenToday} of {dueToday.length} taken
                  </span>
                </div>
                <Meter
                  className="mt-2"
                  value={takenToday}
                  max={dueToday.length}
                  color="var(--supplement)"
                  label="Supplements taken today"
                />
              </div>
              <SupplementChecklist date={today} supplements={dueToday} logs={logs} onOpen={open} />
            </Card>
          ) : (
            active.length > 0 && <p className="px-1 text-footnote text-ink-2">Nothing due today.</p>
          )}

          {notToday.length > 0 && (
            <>
              <SectionHeader title="Not due today" />
              <Card padded={false} className="py-1">
                <SupplementChecklist date={today} supplements={notToday} logs={logs} onOpen={open} grouped={false} />
              </Card>
            </>
          )}

          {active.length > 0 && (
            <>
              <SectionHeader title="Last 7 days" action={<Legend items={LEGEND} />} />
              <Card padded={false}>
                <div className="grid grid-cols-[minmax(0,1fr)_repeat(7,1rem)_2.5rem] items-center gap-x-1 border-b-[0.5px] border-bar-line px-4 py-2 text-caption2 font-medium text-ink-2">
                  <span />
                  {last7.map((d) => (
                    <span key={d} className="text-center" aria-hidden>
                      {formatDate(d, { weekday: 'narrow' })}
                    </span>
                  ))}
                  <span />
                </div>
                <ul className="divide-y-[0.5px] divide-bar-line">
                  {active.map((s) => {
                    const a = adherence(s, logs, today)
                    const month = adherence(s, logs, today, 30)
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => open(s)}
                          className="grid w-full grid-cols-[minmax(0,1fr)_repeat(7,1rem)_2.5rem] items-center gap-x-1 px-4 py-2.5 text-left transition-colors hover:bg-fill/60 active:bg-fill"
                          aria-label={`${s.name}: taken ${a.taken} of ${a.scheduled} due in the last 7 days`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-subhead font-medium">{s.name}</span>
                            <span className="block truncate text-footnote text-ink-2">
                              {timeLabel(s.time)} · {daysLabel(s.days)}
                              {month.scheduled > 0 && ` · 30 days: ${Math.round((month.taken / month.scheduled) * 100)}%`}
                            </span>
                          </span>
                          {a.days.map((d) => (
                            <span key={d.date} className="grid place-items-center" aria-hidden>
                              <span
                                className={cn(
                                  'rounded-full',
                                  d.status === 'taken' && 'size-2.5 bg-good',
                                  d.status === 'missed' && 'size-2.5 border-2 border-baseline',
                                  d.status === 'off' && 'h-0.5 w-2 bg-surface-3',
                                )}
                              />
                            </span>
                          ))}
                          <span className="text-right text-footnote text-ink-2 tabular-nums">
                            {a.scheduled ? `${a.taken}/${a.scheduled}` : '–'}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </>
          )}

          {paused.length > 0 && (
            <>
              <SectionHeader title="Paused" />
              <Card padded={false}>
                <ul className="divide-y-[0.5px] divide-bar-line">
                  {paused.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => open(s)}
                        className="w-full px-4 py-3 text-left transition-colors hover:bg-fill/60 active:bg-fill"
                      >
                        <p className="font-medium text-ink-2">{s.name}</p>
                        <p className="text-footnote text-ink-2">{[s.dose, timeLabel(s.time)].filter(Boolean).join(' · ')}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </>
      )}

      <SupplementSheet
        open={sheet.open}
        supplement={sheet.supplement}
        existingNames={supplements.map((s) => s.name)}
        onClose={() => setSheet({ open: false })}
      />
    </>
  )
}

const LEGEND = [
  { label: 'Taken', color: 'var(--good)', shape: 'dot' as const },
  { label: 'Missed', color: 'var(--baseline)', shape: 'dot' as const },
]
