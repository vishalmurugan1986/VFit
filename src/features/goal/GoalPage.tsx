import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarPlus, Pencil, Target } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button, Card, Field, List, ListRow, NumberField, PageHeader, SectionHeader, Stat } from '../../components/ui'
import { db } from '../../db/db'
import { getPhaseInputs } from '../../db/queries'
import { updateSettings, usePhases, useSettings } from '../../db/settings'
import type { Goal, Phase } from '../../db/types'
import { addDays, diffDays, formatDate, todayStr } from '../../lib/dates'
import {
  GOAL_COLOR,
  goalLabel,
  phaseProgressLabel,
  phaseStats,
  type PhaseInputs,
  type PhaseSpan,
  type PhaseStats,
} from '../../lib/phases'
import { fmtNum } from '../../lib/units'
import { PhaseSheet, TargetFields } from './PhaseSheet'


const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmtNum(Math.abs(n), digits)}`
const shortDate = (d: string) => formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' })

export default function GoalPage() {
  const s = useSettings()
  const { spans, currentSpan, upcoming } = usePhases()
  const inputs = useLiveQuery(getPhaseInputs, [])
  const [sheet, setSheet] = useState<{ open: boolean; phase?: Phase }>({ open: false })
  const today = todayStr()
  const open = (phase?: Phase) => setSheet({ open: true, phase })

  const past = spans.filter((sp) => sp.end != null && sp.end < today).reverse()

  return (
    <>
      <PageHeader
        back="/"
        title="Goal & phases"
        actions={
          <Button size="sm" variant="primary" onClick={() => open()}>
            <CalendarPlus />
            New phase
          </Button>
        }
      />

      <p className="-mt-2 mb-4 text-footnote text-ink-2">
        Plan your year as phases, such as Maingain for a few months, then a Cut. Each phase keeps its own target weight
        and daily targets, and a planned phase takes over by itself on its start date.
      </p>

      {currentSpan && <CurrentPhase span={currentSpan} inputs={inputs} onEdit={() => open(currentSpan.phase)} />}

      {upcoming.length > 0 && (
        <>
          <SectionHeader title="Up next" />
          <List>
              {upcoming.map((p) => (
                <PhaseRow
                  key={p.id}
                  phase={p}
                  title={`${goalLabel(p.goal)} · ${phaseProgressLabel(p, today)}`}
                  detail={[
                    `From ${shortDate(p.startDate)}`,
                    `${fmtNum(p.targets.calories)} kcal`,
                    p.targetWeightKg != null ? `target ${fmtNum(p.targetWeightKg, 1)} kg` : null,
                  ]}
                  onOpen={() => open(p)}
                />
              ))}
          </List>
        </>
      )}

      {spans.length > 1 && (
        <>
          <SectionHeader title="Timeline" />
          <Card>
            <Timeline spans={spans} today={today} />
          </Card>
        </>
      )}

      {past.length > 0 && (
        <>
          <SectionHeader title="Past phases" />
          <List>
              {past.map((sp) => {
                const st = inputs ? phaseStats(sp, inputs, today) : null
                return (
                  <PhaseRow
                    key={sp.phase.id}
                    phase={sp.phase}
                    title={`${goalLabel(sp.phase.goal)} · ${Math.max(1, Math.round((diffDays(sp.end!, sp.start) + 1) / 7))} weeks`}
                    detail={[`${shortDate(sp.start)} – ${shortDate(sp.end!)}`, ...(st ? statLine(st) : [])]}
                    onOpen={() => open(sp.phase)}
                  />
                )
              })}
          </List>
        </>
      )}

      <SectionHeader title="You" />
      <Card>
        <Field label="Age">
          <NumberField
            integer
            suffix="years"
            value={s.age}
            placeholder="e.g. 30"
            onValueChange={(v) => v != null && v >= 10 && v <= 100 && void updateSettings({ age: v })}
          />
        </Field>
      </Card>

      <PhaseSheet open={sheet.open} phase={sheet.phase} onClose={() => setSheet({ open: false })} />
    </>
  )
}

function CurrentPhase({ span, inputs, onEdit }: { span: PhaseSpan; inputs?: PhaseInputs; onEdit: () => void }) {
  const today = todayStr()
  const p = span.phase
  const st = inputs ? phaseStats(span, inputs, today) : null
  const latest = inputs?.weights[inputs.weights.length - 1]?.kg ?? null
  const toGo = p.targetWeightKg != null && latest != null ? p.targetWeightKg - latest : null
  const save = (patch: Partial<Phase>) => void db.phases.update(p.id, patch)

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: GOAL_COLOR[p.goal] }} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-footnote font-medium text-ink-2">Current phase</p>
          <h2 className="text-title1 font-semibold tracking-tight">{goalLabel(p.goal)}</h2>
          <p className="text-footnote text-ink-2">
            {phaseProgressLabel(p, today)} · since {shortDate(p.startDate)}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil />
          Edit
        </Button>
      </div>

      {p.note && <p className="text-footnote text-ink-2">{p.note}</p>}

      {st && (
        <div className="grid grid-cols-2 gap-4 border-t-[0.5px] border-bar-line pt-4">
          <Stat
            label="Weight change"
            value={st.change != null ? signed(st.change) : '–'}
            unit={st.change != null ? 'kg' : undefined}
            delta={st.perWeek != null ? { text: `${signed(st.perWeek, 2)} kg a week`, tone: 'neutral' } : null}
          />
          <Stat
            label="Avg calories"
            value={st.avgKcal != null ? fmtNum(st.avgKcal) : '–'}
            unit={st.avgKcal != null ? 'kcal' : undefined}
            delta={
              st.loggedDays
                ? { text: `${st.onTargetDays} of ${st.loggedDays} days on target`, tone: 'neutral' }
                : null
            }
          />
        </div>
      )}

      <div className="flex flex-col gap-4 border-t-[0.5px] border-bar-line pt-4">
        <Field
          label="Target weight"
          hint={
            toGo != null && Math.abs(toGo) >= 0.1
              ? `${fmtNum(Math.abs(toGo), 1)} kg to ${toGo < 0 ? 'lose' : 'gain'} from your latest ${fmtNum(latest!, 1)} kg.`
              : toGo != null
                ? 'Reached.'
                : undefined
          }
        >
          <NumberField
            value={p.targetWeightKg}
            onValueChange={(v) => save({ targetWeightKg: v != null && v > 0 ? v : null })}
            decimals={1}
            suffix="kg"
            placeholder="Optional"
          />
        </Field>
        <TargetFields value={p.targets} onChange={(targets) => save({ targets })} />
      </div>
    </Card>
  )
}

function statLine(st: PhaseStats): string[] {
  return [
    st.change != null ? `${signed(st.change)} kg` : null,
    st.avgKcal != null ? `avg ${fmtNum(st.avgKcal)} kcal` : null,
  ].filter((x): x is string => x != null)
}

function PhaseRow({
  phase,
  title,
  detail,
  onOpen,
}: {
  phase: Phase
  title: string
  detail: (string | null)[]
  onOpen: () => void
}) {
  return (
    <ListRow
      onClick={onOpen}
      icon={<Target />}
      iconColor={GOAL_COLOR[phase.goal]}
      title={title}
      subtitle={detail.filter(Boolean).join(' · ')}
      chevron
    />
  )
}

/** Every phase as a band, sized by its length; the current and planned ones run to their planned end. */
function Timeline({ spans, today }: { spans: PhaseSpan[]; today: string }) {
  const bars = spans.map((sp) => {
    // The open-ended last phase runs to today; one planned ahead shows as 4 weeks.
    const end = sp.end ?? (sp.start > today ? addDays(sp.start, 27) : today)
    return { sp, end: end < sp.start ? sp.start : end }
  })
  const first = bars[0].sp.start
  const last = bars[bars.length - 1].end
  const total = Math.max(1, diffDays(last, first) + 1)
  const todayPct = Math.min(100, Math.max(0, (diffDays(today, first) / total) * 100))
  return (
    <div>
      <div className="relative flex h-7 gap-0.5" role="img" aria-label={timelineLabel(bars)}>
        {bars.map(({ sp, end }) => (
          <div
            key={sp.phase.id}
            className="h-full min-w-1 rounded-[4px]"
            style={{
              width: `${((diffDays(end, sp.start) + 1) / total) * 100}%`,
              background: GOAL_COLOR[sp.phase.goal],
              opacity: sp.start > today ? 0.4 : 1,
            }}
          />
        ))}
        <div
          className="absolute -inset-y-1 w-0.5 rounded-full bg-ink ring-2 ring-surface"
          style={{ left: `${todayPct}%` }}
          aria-hidden
        />
      </div>
      <div className="mt-2 flex justify-between text-footnote text-ink-2">
        <span>{formatDate(first, { month: 'short', year: 'numeric' })}</span>
        <span>{formatDate(last, { month: 'short', year: 'numeric' })}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-footnote text-ink-2">
        {(['bulk', 'maingain', 'cut'] as Goal[])
          .filter((g) => spans.some((sp) => sp.phase.goal === g))
          .map((g) => (
            <LegendDot key={g} color={GOAL_COLOR[g]}>
              {goalLabel(g)}
            </LegendDot>
          ))}
        <LegendDot color="var(--ink)" bar>
          Today
        </LegendDot>
      </div>
    </div>
  )
}

function LegendDot({ color, bar, children }: { color: string; bar?: boolean; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={bar ? 'h-3 w-0.5' : 'size-2.5 rounded-full'} style={{ background: color }} aria-hidden />
      {children}
    </span>
  )
}

function timelineLabel(bars: { sp: PhaseSpan; end: string }[]): string {
  return bars
    .map(({ sp, end }) => `${goalLabel(sp.phase.goal)} from ${shortDate(sp.start)} to ${shortDate(end)}`)
    .join('; ')
}
