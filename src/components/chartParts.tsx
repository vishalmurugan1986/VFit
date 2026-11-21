import { ChevronRight } from 'lucide-react'

/* Lightweight chart pieces (no Recharts), safe to use on the first screen. */

/** Trend sparkline in the de-emphasis gray, with the latest point in the series color. */
export function Sparkline({
  values,
  color,
  width = 104,
  height = 36,
}: {
  values: number[]
  color: string
  width?: number
  height?: number
}) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 5
  const pts = values.map((v, i) => [
    pad + (i / (values.length - 1)) * (width - 2 * pad),
    pad + (1 - (v - min) / span) * (height - 2 * pad),
  ])
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0 overflow-visible">
      <path d={d} fill="none" stroke="var(--muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
    </svg>
  )
}

export interface LegendItem {
  label: string
  color: string
  shape: 'line' | 'dot' | 'bar'
}

/** Legend keys mirror the mark: a dot for dots, a short line for lines, a bar for bars. */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-footnote text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.shape === 'line' && <span className="h-0.5 w-3.5 rounded-full" style={{ background: i.color }} />}
          {i.shape === 'dot' && <span className="size-2 rounded-full" style={{ background: i.color }} />}
          {i.shape === 'bar' && <span className="h-2.5 w-2 rounded-t-[2px]" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  )
}

/** The chart's table twin, collapsed by default, so no value is only reachable by hovering. */
export function ChartTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return null
  return (
    <details className="group mt-3">
      <summary className="inline-flex min-h-11 list-none items-center gap-1 text-subhead text-accent-ink active:opacity-60 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
        Show data
      </summary>
      <div className="mt-1 max-h-72 overflow-auto rounded-xl bg-fill/50">
        <table className="w-full text-footnote tabular-nums">
          <thead className="sticky top-0 bg-surface-2 text-left text-caption text-ink-2">
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col" className="px-3 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t-[0.5px] border-bar-line">
                {r.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
