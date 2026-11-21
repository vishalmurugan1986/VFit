import { useId } from 'react'
import { cn } from '../lib/cn'

/** The VFit mark: a V that is also a tick, with two speed lines. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1c1c1e" />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>
        <linearGradient id={`${id}v`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#86e000" />
          <stop offset="1" stopColor="#c4ff4d" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${id}bg)`} />
      <path d="M108 232 L148 232" stroke="#a6ff00" strokeOpacity=".5" strokeWidth="26" strokeLinecap="round" />
      <path d="M84 284 L168 284" stroke="#a6ff00" strokeOpacity=".3" strokeWidth="26" strokeLinecap="round" />
      <path
        d="M200 190 L266 338 L420 156"
        fill="none"
        stroke={`url(#${id}v)`}
        strokeWidth="76"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Mark and name together. */
export function Logo({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={size === 'sm' ? 'size-7' : 'size-8'} />
      <span className={cn('font-extrabold tracking-[-0.04em]', size === 'sm' ? 'text-lg' : 'text-xl')}>
        <span className="text-accent-ink">V</span>Fit
      </span>
    </span>
  )
}
