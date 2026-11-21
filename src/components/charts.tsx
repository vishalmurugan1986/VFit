import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { DAY_MS, formatTs } from '../lib/dates'
import { niceScale } from '../lib/series'
import { fmtNum } from '../lib/units'

/*
 * Chart conventions (data-viz skill): 2px lines with an 8px end-dot ringed in the surface color,
 * bars ≤ 22px with 4px rounded tops and a square base, a hairline solid grid on clean round ticks,
 * text in ink tokens (never the series color), the current period emphasised and the rest
 * de-emphasised, a tooltip on hover, and a "Show data" table so no value is hover-only.
 * Recharts is large, so this module is only imported by screens that draw full charts;
 * the lightweight pieces live in chartParts.tsx.
 */

const AXIS_TICK = { fill: 'var(--muted)', fontSize: 11 }
const BAR_MAX = 22
/** Opacity of bars that aren't the one being looked at (the current period or the chosen day). */
const DE_EMPHASIS = 0.38

interface TooltipLikeProps {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: unknown }>
}

function TooltipBox({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border-[0.5px] border-bar-line bg-bar px-3 py-2 text-subhead shadow-[0_8px_24px_rgb(0_0_0/0.3)] backdrop-blur-xl">
      <p className="text-footnote text-ink-2">{title}</p>
      <div className="mt-1 flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

/** Tooltip row: value leads, label follows, keyed with a short line in the series color. */
function TooltipRow({ color, value, label, dot }: { color: string; value: string; label: string; dot?: boolean }) {
  return (
    <p className="flex items-center gap-2 whitespace-nowrap">
      {dot ? (
        <span className="size-2 rounded-full" style={{ background: color }} />
      ) : (
        <span className="h-0.5 w-3 rounded-full" style={{ background: color }} />
      )}
      <strong className="font-semibold tabular-nums">{value}</strong>
      <span className="text-ink-2">{label}</span>
    </p>
  )
}

/** Clean, zero-based ticks for a column chart: 0, 500, 1,000 … never 650 or 1,950. */
function zeroScale(max: number, maxTicks = 4): { domain: [number, number]; ticks: number[] } {
  if (!(max > 0)) return { domain: [0, 1], ticks: [0, 1] }
  const rawStep = max / maxTicks
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? 10 * magnitude
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6)
  return { domain: [0, ticks[ticks.length - 1]], ticks }
}

/* ───────────── Line over time ───────────── */

/** Up to `max` evenly spaced, distinct local-midnight ticks inside [from, to]. */
function dayTicks(from: number, to: number, max = 5): number[] {
  const ticks = new Set<number>()
  for (let i = 0; i < max; i++) {
    const d = new Date(from + ((to - from) * i) / (max - 1))
    d.setHours(0, 0, 0, 0)
    if (d.getTime() >= from && d.getTime() <= to) ticks.add(d.getTime())
  }
  return [...ticks]
}

/** A shaded stretch of time behind a chart, such as a training phase. */
export interface TimeBand {
  from: number
  to: number
  label: string
  color: string
}

export interface TimePoint {
  t: number
  v: number | null
  avg?: number | null
}

export function TimeChart({
  data,
  color,
  format,
  seriesLabel,
  avgLabel,
  goal,
  bands,
  height = 220,
  ariaLabel,
}: {
  data: TimePoint[]
  color: string
  format: (v: number) => string
  seriesLabel: string
  /** When set, `avg` is drawn as the line and raw values as faint dots. */
  avgLabel?: string
  goal?: { value: number; label: string } | null
  /** shaded stretches of time (e.g. phases), clipped to the chart */
  bands?: TimeBand[]
  height?: number
  ariaLabel: string
}) {
  const showAvg = Boolean(avgLabel)
  const values = data.flatMap((d) => [d.v, d.avg]).filter((v): v is number => v != null)
  // Stretch the axis to show the goal when it's within reach of the data; otherwise leave it off
  // rather than squashing the trend (the stat tile still says how far away it is).
  let scaleValues = values
  if (goal && values.length) {
    const lo = Math.min(...values)
    const hi = Math.max(...values)
    const distance = goal.value < lo ? lo - goal.value : goal.value > hi ? goal.value - hi : 0
    if (distance <= Math.max(hi - lo, 2)) scaleValues = [...values, goal.value]
  }
  const y = niceScale(scaleValues)
  const goalVisible = goal != null && goal.value >= y.domain[0] && goal.value <= y.domain[1]
  const goalBelowData = goal != null && values.length > 0 && goal.value < Math.min(...values)
  const t0 = data[0]?.t ?? 0
  const t1 = data[data.length - 1]?.t ?? 0
  const xDomain: [number, number] = t1 - t0 < 6 * DAY_MS ? [t0 - 3 * DAY_MS, t1 + 3 * DAY_MS] : [t0, t1]
  const spanDays = (xDomain[1] - xDomain[0]) / DAY_MS
  const xTicks = dayTicks(xDomain[0], xDomain[1])
  // Over most of a year, "Nov 21" could mean a day or a year, so long ranges read "Nov '25".
  const tickFormat = (t: number) =>
    spanDays > 300
      ? `${formatTs(t, { month: 'short' })} '${String(new Date(t).getFullYear()).slice(2)}`
      : formatTs(t, { month: 'short', day: 'numeric' })
  const dense = data.length > 60
  const ring = { stroke: 'var(--surface)', strokeWidth: 2 }
  const clipped = (bands ?? [])
    .map((b) => ({ ...b, from: Math.max(b.from, xDomain[0]), to: Math.min(b.to, xDomain[1]) }))
    .filter((b) => b.to > b.from)
  // Shading only helps when the range crosses from one phase into another.
  const visibleBands = clipped.length >= 2 ? clipped : []
  // Only label bands wide enough to hold their name.
  const labelMin = (xDomain[1] - xDomain[0]) * 0.14
  const lastIndex = data.length - 1
  /** The line's latest point gets the end-dot; every other point draws nothing. */
  const endDot = (p: { cx?: number; cy?: number; index?: number }) =>
    p.index === lastIndex && p.cx != null && p.cy != null ? (
      <circle key="end" cx={p.cx} cy={p.cy} r={4.5} fill={color} {...ring} />
    ) : (
      <g key={p.index} />
    )

  return (
    <div role="img" aria-label={ariaLabel} className="w-full select-none" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="t"
            type="number"
            domain={xDomain}
            ticks={xTicks}
            tickFormatter={tickFormat}
            tick={AXIS_TICK}
            axisLine={{ stroke: 'var(--baseline)' }}
            tickLine={false}
            tickMargin={8}
            minTickGap={28}
          />
          <YAxis
            domain={y.domain}
            ticks={y.ticks}
            tickFormatter={(v: number) => fmtNum(v, 1)}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={40}
            allowDecimals
          />
          <Tooltip
            cursor={{ stroke: 'var(--baseline)', strokeWidth: 1 }}
            isAnimationActive={false}
            content={(p) => (
              <TimeTooltip
                active={p.active}
                payload={p.payload}
                color={color}
                format={format}
                seriesLabel={seriesLabel}
                avgLabel={avgLabel}
              />
            )}
          />
          {visibleBands.map((b) => (
            <ReferenceArea
              key={`${b.from}-${b.label}`}
              x1={b.from}
              x2={b.to}
              fill={b.color}
              fillOpacity={0.06}
              stroke="none"
              ifOverflow="hidden"
              label={
                b.to - b.from >= labelMin
                  ? { value: b.label, position: 'insideTopLeft', fill: 'var(--ink-2)', fontSize: 11 }
                  : undefined
              }
            />
          ))}
          {goal && goalVisible && (
            <ReferenceLine
              y={goal.value}
              stroke="var(--ink-2)"
              strokeWidth={1}
              strokeDasharray="3 3"
              label={{
                value: goal.label,
                position: goalBelowData ? 'insideTopLeft' : 'insideBottomLeft',
                fill: 'var(--ink-2)',
                fontSize: 11,
              }}
            />
          )}
          {/* Raw values: faint small dots under the average (or the line itself when there's no average). */}
          <Line
            dataKey="v"
            type="monotone"
            stroke={showAvg ? 'none' : color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={
              showAvg
                ? dense
                  ? false
                  : { r: 2.5, fill: color, fillOpacity: 0.4, stroke: 'none' }
                : dense
                  ? endDot
                  : { r: 4, fill: color, ...ring }
            }
            activeDot={{ r: 5, fill: color, ...ring }}
            isAnimationActive={false}
            connectNulls
          />
          {showAvg && (
            <Line
              dataKey="avg"
              type="monotone"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={endDot}
              activeDot={{ r: 4.5, fill: color, ...ring }}
              isAnimationActive={false}
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function TimeTooltip({
  active,
  payload,
  color,
  format,
  seriesLabel,
  avgLabel,
}: TooltipLikeProps & { color: string; format: (v: number) => string; seriesLabel: string; avgLabel?: string }) {
  const p = payload?.[0]?.payload as TimePoint | undefined
  if (!active || !p) return null
  return (
    <TooltipBox title={formatTs(p.t, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}>
      {avgLabel && p.avg != null && <TooltipRow color={color} value={format(p.avg)} label={avgLabel} />}
      {p.v != null && <TooltipRow color={color} value={format(p.v)} label={seriesLabel} dot={Boolean(avgLabel)} />}
    </TooltipBox>
  )
}

/* ───────────── Columns ───────────── */

export interface ColumnDatum {
  key: string
  /** short axis label */
  label: string
  /** full label for the tooltip */
  title: string
  v: number
}

export function ColumnChart({
  data,
  color,
  format,
  yFormat,
  seriesLabel,
  target,
  targetLabel = 'Target',
  selectedKey,
  onSelect,
  height = 200,
  ariaLabel,
}: {
  data: ColumnDatum[]
  color: string
  format: (v: number) => string
  yFormat?: (v: number) => string
  seriesLabel: string
  target?: number | null
  targetLabel?: string
  /** the bar to emphasise; defaults to the last one (the current period) */
  selectedKey?: string
  onSelect?: (key: string) => void
  height?: number
  ariaLabel: string
}) {
  const max = Math.max(0, ...data.map((d) => d.v), target != null && target > 0 ? target : 0)
  const y = zeroScale(max)
  const emphasised = selectedKey ?? data[data.length - 1]?.key
  return (
    <div role="img" aria-label={ariaLabel} className="w-full select-none" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: 0 }} maxBarSize={BAR_MAX} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            axisLine={{ stroke: 'var(--baseline)' }}
            tickLine={false}
            tickMargin={8}
            interval="preserveStartEnd"
            minTickGap={6}
          />
          <YAxis
            domain={y.domain}
            ticks={y.ticks}
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={40}
            allowDecimals={false}
            tickFormatter={yFormat ?? ((v: number) => (v >= 10000 ? `${fmtNum(v / 1000)}K` : fmtNum(v)))}
          />
          <Tooltip
            cursor={{ fill: 'var(--fill)', radius: 4 }}
            isAnimationActive={false}
            content={(p) => (
              <ColumnTooltip active={p.active} payload={p.payload} color={color} format={format} seriesLabel={seriesLabel} />
            )}
          />
          {target != null && target > 0 && (
            <ReferenceLine
              y={target}
              stroke="var(--ink-2)"
              strokeWidth={1}
              strokeDasharray="3 3"
              label={{ value: targetLabel, position: 'insideTopRight', fill: 'var(--ink-2)', fontSize: 11 }}
            />
          )}
          <Bar
            dataKey="v"
            fill={color}
            radius={[4, 4, 0, 0]}
            maxBarSize={BAR_MAX}
            isAnimationActive={false}
            activeBar={{ fillOpacity: 1 }}
            onClick={onSelect ? (d: { payload?: ColumnDatum }) => d.payload && onSelect(d.payload.key) : undefined}
            style={onSelect ? { cursor: 'pointer' } : undefined}
          >
            {data.map((d) => (
              <Cell key={d.key} fillOpacity={d.key === emphasised ? 1 : DE_EMPHASIS} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ColumnTooltip({
  active,
  payload,
  color,
  format,
  seriesLabel,
}: TooltipLikeProps & { color: string; format: (v: number) => string; seriesLabel: string }) {
  const p = payload?.[0]?.payload as ColumnDatum | undefined
  if (!active || !p) return null
  return (
    <TooltipBox title={p.title}>
      <TooltipRow color={color} value={format(p.v)} label={seriesLabel} />
    </TooltipBox>
  )
}
