import type { ReactNode } from 'react'

/** The arc runs 240° (open at the bottom, like a dial), starting bottom-left and filling clockwise. */
const SWEEP = 240

function arcPath(c: number, r: number, from: number, to: number) {
  const pt = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180
    return `${c + r * Math.cos(rad)} ${c + r * Math.sin(rad)}`
  }
  const large = to - from > 180 ? 1 : 0
  return `M ${pt(from)} A ${r} ${r} 0 ${large} 1 ${pt(to)}`
}

/**
 * VFit's progress dial: a 240° arc that fills towards the goal, with the number in the middle.
 * Past 100% it stays full and the end cap shows a tick.
 */
export function Dial({
  value,
  max,
  color,
  size = 96,
  stroke = 9,
  label,
  children,
}: {
  value: number
  max: number
  color: string
  size?: number
  stroke?: number
  /** spoken label, e.g. "Calories 1,200 of 2,600" */
  label: string
  /** what sits in the middle (the number) */
  children?: ReactNode
}) {
  const c = size / 2
  const r = c - stroke / 2 - 1
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const start = -SWEEP / 2
  const end = start + SWEEP * pct
  const done = max > 0 && value >= max
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <path d={arcPath(c, r, start, start + SWEEP)} fill="none" stroke={color} strokeOpacity={0.2} strokeWidth={stroke} strokeLinecap="round" />
        {pct > 0 && (
          <path
            d={arcPath(c, r, start, Math.max(end, start + 0.5))}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        )}
        {done && (
          <path
            d={`M ${c - stroke * 0.35} ${size - stroke * 1.05} l ${stroke * 0.3} ${stroke * 0.3} l ${stroke * 0.55} -${stroke * 0.6}`}
            fill="none"
            stroke={color}
            strokeWidth={Math.max(2, stroke / 3.5)}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center pb-1">{children}</div>}
    </div>
  )
}
