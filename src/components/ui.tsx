import { ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, SearchX, TrendingDown, TrendingUp, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Link, useNavigate } from 'react-router'
import { cn } from '../lib/cn'
import { formatClock, parseClock } from '../lib/dates'
import { inputText, parseNum } from '../lib/units'

/* ───────────────────────── Buttons ───────────────────────── */

/**
 * Button styles follow the iOS set:
 * - primary: filled accent, the screen's one main action
 * - tinted: accent wash with accent text, a strong secondary action
 * - secondary: gray fill, a quiet action
 * - outline: gray fill with accent text (iOS "gray" style)
 * - ghost: plain accent text, for bar buttons and inline links
 * - danger / danger-ghost: destructive, filled or plain
 * Every size gives a 44pt touch target and visible pressed feedback.
 */
export type ButtonVariant = 'primary' | 'tinted' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_BASE =
  'relative inline-flex items-center justify-center font-semibold whitespace-nowrap select-none transition-[opacity,transform,background-color,color] duration-150 active:scale-[0.97] active:opacity-75 [&_svg]:shrink-0 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  tinted: 'bg-accent-soft text-accent-ink hover:brightness-110',
  secondary: 'bg-fill text-ink hover:bg-fill-2',
  outline: 'bg-fill text-accent-ink hover:bg-fill-2',
  ghost: 'text-accent-ink hover:bg-fill',
  danger: 'bg-critical text-white hover:brightness-110',
  'danger-ghost': 'text-bad-ink hover:bg-critical/10',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  // 32px capsule; the invisible band above and below makes the touch target 44px.
  sm: "h-8 gap-1.5 rounded-full px-3.5 text-subhead before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] [&_svg]:size-4",
  md: 'h-11 gap-2 rounded-xl px-4 text-body font-semibold [&_svg]:size-5',
  lg: 'h-[50px] gap-2 rounded-[14px] px-5 text-headline [&_svg]:size-5',
}

export function buttonClass(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', full = false): string {
  // Full-width buttons share a row (e.g. Cancel | Save); others keep their natural width.
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], full ? 'w-full min-w-0' : 'shrink-0')
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
}

export function Button({ variant, size, full, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cn(buttonClass(variant, size, full), className)} {...rest} />
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  size?: 'sm' | 'md'
  /** plain: secondary-label gray (in content) · tint: accent (bar buttons) · fill: gray circle */
  tone?: 'plain' | 'tint' | 'fill'
}

/** Icon-only button with a 44pt touch target and the action's name for screen readers. */
export function IconButton({ label, size = 'md', tone = 'plain', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full transition-[opacity,background-color,transform] duration-150 active:scale-95 active:opacity-70 focus-visible:outline-2 focus-visible:outline-accent-ink disabled:pointer-events-none disabled:opacity-35',
        tone === 'plain' && 'text-ink-2 hover:bg-fill hover:text-ink',
        tone === 'tint' && 'text-accent-ink hover:bg-fill',
        tone === 'fill' && 'bg-fill text-ink-2 hover:bg-fill-2 hover:text-ink',
        size === 'sm'
          ? "size-8 before:absolute before:-inset-1.5 before:content-[''] [&_svg]:size-[18px]"
          : 'size-11 [&_svg]:size-[22px]',
        className,
      )}
      {...rest}
    />
  )
}

/* ───────────────────────── Surfaces ───────────────────────── */

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean
}

/** The one card: elevated surface, 12px corners, 16px padding. */
export function Card({ padded = true, className, ...rest }: CardProps) {
  return <div className={cn('rounded-xl border border-transparent bg-surface', padded && 'p-4', className)} {...rest} />
}

/** A grouped list (iOS inset-grouped table): rows share one card, divided by inset hairlines. */
export function List({ className, children, ...rest }: HTMLAttributes<HTMLUListElement>) {
  return (
    <ul className={cn('overflow-hidden rounded-xl bg-surface', className)} {...rest}>
      {children}
    </ul>
  )
}

const ROW_INNER =
  'flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 [&_svg]:shrink-0'

/**
 * One row of a List: optional leading icon chip, title and subtitle, trailing value, and a chevron
 * when it opens something. Give it `to` (a link) or `onClick` (a button) to make it tappable.
 */
export function ListRow({
  icon,
  iconColor = 'var(--ink-2)',
  title,
  subtitle,
  value,
  chevron,
  to,
  onClick,
  destructive,
  trailing,
  className,
}: {
  icon?: ReactNode
  iconColor?: string
  title: ReactNode
  subtitle?: ReactNode
  value?: ReactNode
  chevron?: boolean
  to?: string
  onClick?: () => void
  destructive?: boolean
  /** a control at the end of the row (switch, segmented control) */
  trailing?: ReactNode
  className?: string
}) {
  const inner = (
    <>
      {icon && (
        <IconChip color={iconColor} size="sm">
          {icon}
        </IconChip>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn('block text-body', destructive ? 'text-bad-ink' : 'text-ink')}>{title}</span>
        {subtitle && <span className="mt-0.5 block text-footnote text-ink-2">{subtitle}</span>}
      </span>
      {value != null && <span className="shrink-0 text-body text-ink-2 tabular-nums">{value}</span>}
      {trailing}
      {(chevron ?? Boolean(to)) && <ChevronRight className="-mr-1 size-[18px] text-muted" aria-hidden />}
    </>
  )
  const interactive = cn(ROW_INNER, 'hover:bg-fill/60 active:bg-fill')
  return (
    <li
      className={cn(
        "relative not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:h-px not-first:before:scale-y-50 not-first:before:bg-bar-line not-first:before:content-['']",
        icon ? 'not-first:before:left-[60px]' : 'not-first:before:left-4',
        className,
      )}
    >
      {to ? (
        <Link to={to} className={interactive}>
          {inner}
        </Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={interactive}>
          {inner}
        </button>
      ) : (
        <div className={ROW_INNER}>{inner}</div>
      )}
    </li>
  )
}

/* ───────────────────────── Navigation ───────────────────────── */

/** Go back within the app if possible, otherwise to `fallback` (e.g. after opening a deep link). */
export function useGoBack(fallback = '/') {
  const navigate = useNavigate()
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate(fallback, { replace: true })
  }, [navigate, fallback])
}

/** The back button's label: the screen it returns to. */
const BACK_LABELS: Record<string, string> = {
  '/': 'Today',
  '/workouts': 'Workouts',
  '/workouts/history': 'History',
  '/exercises': 'Exercises',
  '/cardio': 'Cardio',
  '/body': 'Body',
  '/nutrition': 'Food',
  '/supplements': 'Supplements',
  '/settings': 'Settings',
}

/** Height of the iPhone status bar area (0 elsewhere), read from the CSS env() value. */
function safeTop(): number {
  if (typeof document === 'undefined') return 0
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top);visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  const h = probe.offsetHeight
  probe.remove()
  return h
}

/**
 * iOS navigation bar plus large title. The bar stays on screen: back button on the left, actions on
 * the right, and once the large title scrolls under it the bar turns translucent and shows the title.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  back,
  leading,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  /** small grey uppercase line above the title, such as today's date */
  eyebrow?: ReactNode
  /** where Back goes when there is no history (also shows the back button) */
  back?: string
  /** shown at the left of the bar when there is no back button (e.g. the logo) */
  leading?: ReactNode
  actions?: ReactNode
}) {
  const goBack = useGoBack(back)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const el = titleRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setCollapsed(!e.isIntersecting), {
      // The title counts as hidden once it has slid under the 44px bar (below the status bar).
      rootMargin: `-${safeTop() + 44}px 0px 0px 0px`,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <>
      <div
        className={cn(
          'sticky top-[env(safe-area-inset-top)] z-30 -mx-4 border-b-[0.5px] px-1.5 transition-[background-color,border-color] duration-200 md:-mx-8 md:px-5',
          collapsed ? 'border-bar-line bg-bar backdrop-blur-xl backdrop-saturate-150' : 'border-transparent',
        )}
      >
        <div className="relative flex h-11 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center">
            {back !== undefined ? (
              <button
                type="button"
                onClick={goBack}
                className="flex h-11 min-w-11 items-center gap-0.5 pr-2 text-body text-accent-ink transition-opacity active:opacity-60"
              >
                <ChevronLeft className="size-[26px] shrink-0" strokeWidth={2.4} aria-hidden />
                <span className="max-w-28 truncate">{BACK_LABELS[back] ?? 'Back'}</span>
              </button>
            ) : (
              <div className="pl-2.5">{leading}</div>
            )}
          </div>
          <p
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-x-[30%] truncate text-center text-headline transition-opacity duration-200',
              collapsed ? 'opacity-100' : 'opacity-0',
            )}
          >
            {title}
          </p>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 pr-1">{actions}</div>
        </div>
      </div>
      <header className="pt-1 pb-3">
        {eyebrow && <p className="text-footnote font-semibold tracking-wide text-ink-2 uppercase">{eyebrow}</p>}
        <h1 ref={titleRef} className="text-largetitle text-balance">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-subhead text-ink-2">{subtitle}</p>}
      </header>
    </>
  )
}

/** A section title (Title 2) with an optional action on the right, such as "Show All". */
/** A section's Title 2 heading. `flush` drops the space above, for the first section under the title. */
export function SectionHeader({
  title,
  action,
  flush,
  className,
}: {
  title: ReactNode
  action?: ReactNode
  flush?: boolean
  className?: string
}) {
  return (
    <div className={cn(flush ? 'mt-1' : 'mt-8', 'mb-2 flex min-h-8 items-end justify-between gap-3', className)}>
      <h2 className="text-title2">{title}</h2>
      {action && <div className="shrink-0 text-body">{action}</div>}
    </div>
  )
}

/** Small uppercase heading above a grouped list or form group (iOS section header). */
export function GroupLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('mt-6 mb-1.5 px-4 text-footnote text-ink-2 uppercase', className)}>{children}</h3>
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-surface px-6 py-10 text-center">
      {icon && (
        <div className="mb-2 grid size-14 place-items-center rounded-full bg-fill text-ink-2 [&_svg]:size-7">{icon}</div>
      )}
      <p className="text-headline">{title}</p>
      {children && <p className="max-w-sm text-subhead text-ink-2">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function IconChip({ color, children, size = 'md' }: { color: string; children: ReactNode; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full',
        size === 'sm' ? 'size-8 [&_svg]:size-[17px]' : 'size-10 [&_svg]:size-5',
      )}
      style={{
        background: `linear-gradient(135deg, color-mix(in oklab, ${color} 14%, var(--surface)), color-mix(in oklab, ${color} 26%, var(--surface)))`,
        color,
      }}
    >
      {children}
    </span>
  )
}

/** Loading placeholder shaped like a screen: a title and a few cards, gently pulsing. */
export function PageLoading() {
  return (
    <div role="status" aria-label="Loading" className="animate-shimmer pt-14">
      <div className="h-9 w-44 rounded-lg bg-fill" />
      <div className="mt-6 h-36 rounded-xl bg-surface" />
      <div className="mt-3 h-24 rounded-xl bg-surface" />
      <div className="mt-3 h-24 rounded-xl bg-surface" />
    </div>
  )
}

export function NotFound({ title = 'Not found', back = '/' }: { title?: string; back?: string }) {
  return (
    <>
      <PageHeader title={title} back={back} />
      <EmptyState
        icon={<SearchX />}
        title="Nothing here"
        action={
          <Link to={back} className={buttonClass('secondary')}>
            Go back
          </Link>
        }
      >
        It may have been deleted.
      </EmptyState>
    </>
  )
}

/* ───────────────────────── Form controls ───────────────────────── */

/* Fields sit on a gray fill (iOS style); focus shows an accent ring instead of a border change. */
const INPUT =
  'w-full min-w-0 border border-transparent bg-fill text-ink placeholder:text-muted outline-none transition-[background-color,box-shadow,border-color] duration-150 focus:border-accent-ink focus:ring-3 focus:ring-accent/25 disabled:opacity-50'
const INPUT_SIZES = {
  md: 'h-11 rounded-xl px-3',
  sm: 'h-10 rounded-[10px] px-1 text-center tabular-nums',
}

/** Label + control. Wraps in <label>, so only use it around a single input/select. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-footnote font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-footnote text-ink-2">{hint}</span>}
    </label>
  )
}

/** Like Field, for groups of buttons (segmented controls, chips). */
export function FieldGroup({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id} className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span id={id} className="text-footnote font-medium text-ink-2">
        {label}
      </span>
      {children}
    </div>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="text" className={cn(INPUT, INPUT_SIZES.md, className)} {...rest} />
}

export function TextArea({ className, rows = 3, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={rows} className={cn(INPUT, 'min-h-20 resize-y rounded-xl px-3 py-2.5', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn('relative', className)}>
      <select className={cn(INPUT, INPUT_SIZES.md, 'appearance-none pr-9')} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-2" />
    </div>
  )
}

const sameNum = (a: number | null, b: number | null) =>
  a === b || (a != null && b != null && Math.abs(a - b) < 1e-6)

interface NumberFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'size'> {
  value: number | null
  onValueChange: (v: number | null) => void
  decimals?: number
  integer?: boolean
  suffix?: string
  size?: 'sm' | 'md'
}

/**
 * Numeric text field with a numeric keypad. Keeps the typed text (so "62." or "0.5" can be
 * typed naturally) and reports parsed numbers; null when empty.
 */
export function NumberField({
  value,
  onValueChange,
  decimals = 2,
  integer = false,
  suffix,
  size = 'md',
  className,
  onBlur,
  ...rest
}: NumberFieldProps) {
  const d = integer ? 0 : decimals
  const parse = (t: string) => {
    const n = parseNum(t)
    return n != null && integer ? Math.round(n) : n
  }
  const [text, setText] = useState(() => inputText(value, d))
  const [seen, setSeen] = useState(value)
  // The prop changed: show it, unless it's just the echo of what was typed here.
  if (!sameNum(value, seen)) {
    setSeen(value)
    if (!sameNum(value, parse(text))) setText(inputText(value, d))
  }
  return (
    <div className={cn('relative min-w-0', className)}>
      <input
        type="text"
        inputMode={integer ? 'numeric' : 'decimal'}
        autoComplete="off"
        enterKeyHint="done"
        className={cn(INPUT, INPUT_SIZES[size], suffix && (size === 'sm' ? 'pr-6' : 'pr-12'))}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onValueChange(parse(e.target.value))
        }}
        onBlur={(e) => {
          // Tidy the text ("62." → "62"), or restore the value if the edit wasn't accepted.
          setText(inputText(value, d))
          onBlur?.(e)
        }}
        {...rest}
      />
      {suffix && (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-subhead text-ink-2">{suffix}</span>
      )}
    </div>
  )
}

interface DurationFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'size'> {
  value: number | null
  onValueChange: (seconds: number | null) => void
  size?: 'sm' | 'md'
}

/** Time in seconds, typed as "1:30", "1.30" or plain seconds ("90"). */
export function DurationField({ value, onValueChange, size = 'md', className, onBlur, ...rest }: DurationFieldProps) {
  const fmt = (v: number | null) => (v == null ? '' : formatClock(v))
  const parse = (t: string) => parseClock(t.replace(/[.,]/g, ':'))
  const [text, setText] = useState(() => fmt(value))
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    if (value !== parse(text)) setText(fmt(value))
  }
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      enterKeyHint="done"
      className={cn(INPUT, INPUT_SIZES[size], className)}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onValueChange(parse(e.target.value))
      }}
      onBlur={(e) => {
        setText(fmt(value))
        onBlur?.(e)
      }}
      {...rest}
    />
  )
}

/** iOS segmented control: a gray track with a raised thumb on the chosen option. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  ariaLabel,
  size = 'md',
  full = false,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  ariaLabel: string
  size?: 'sm' | 'md'
  full?: boolean
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('rounded-[9px] bg-fill p-0.5', full ? 'flex w-full' : 'inline-flex', className)}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex-1 rounded-[7px] whitespace-nowrap transition-[background-color,box-shadow,color] duration-200 before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
              size === 'sm' ? 'h-7 px-2.5 text-footnote' : 'h-8 px-3 text-footnote',
              on
                ? 'bg-thumb font-semibold text-ink shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]'
                : 'font-medium text-ink/80 hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** A filter or choice chip: gray capsule, filled with ink when chosen. */
export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-subhead font-medium whitespace-nowrap transition-[background-color,color,transform] duration-150 before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] active:scale-[0.97]",
        selected ? 'bg-ink text-page' : 'bg-fill text-ink hover:bg-fill-2',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  label: string
}) {
  return (
    <div className="inline-flex items-center rounded-full bg-fill p-0.5" role="group" aria-label={label}>
      <IconButton size="sm" label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus />
      </IconButton>
      <span className="w-7 text-center text-subhead font-semibold tabular-nums">{value}</span>
      <IconButton size="sm" label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus />
      </IconButton>
    </div>
  )
}

/** iOS switch (51 × 31). */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink",
        checked ? 'bg-accent' : 'bg-fill-2',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06)] transition-transform duration-200 ease-[var(--ease-ios)]',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}

/* ───────────────────────── Sheets ───────────────────────── */

/**
 * Modal built on <dialog>: a bottom sheet with a grabber on phones, a centered panel on larger
 * screens. Title in the middle, a round close button on the right (iOS sheet header).
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const pressStartedOnBackdrop = useRef(false)
  const titleId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      // Focus the sheet itself rather than its first button, so no focus ring shows on open;
      // Tab still moves into the sheet and screen readers announce its title.
      d.focus()
    } else if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      className="sheet outline-none"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onPointerDown={(e) => {
        pressStartedOnBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressStartedOnBackdrop.current) onClose()
      }}
    >
      {open && (
        <div className="sheet-panel">
          <div aria-hidden className="mx-auto mt-1.5 h-[5px] w-9 shrink-0 rounded-full bg-fill-2 sm:hidden" />
          <div className="grid grid-cols-[44px_1fr_44px] items-center px-2 pt-1.5 pb-2">
            <span />
            <h2 id={titleId} className="truncate text-center text-headline">
              {title}
            </h2>
            <IconButton label="Close" size="sm" tone="fill" className="justify-self-center" onClick={onClose}>
              <X strokeWidth={2.6} />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-1 pb-5">{children}</div>
          {footer && <div className="border-t-[0.5px] border-bar-line px-4 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

export interface SheetAction {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

/** A short menu of actions, shown as one grouped list in a sheet. */
export function ActionSheet({
  open,
  onClose,
  title,
  actions,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  actions: SheetAction[]
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col overflow-hidden rounded-xl bg-fill">
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            disabled={a.disabled}
            onClick={() => {
              onClose()
              a.onSelect()
            }}
            className={cn(
              'flex min-h-12 items-center gap-3 px-4 text-left text-body transition-colors not-first:border-t-[0.5px] not-first:border-bar-line hover:bg-fill active:bg-fill-2 disabled:opacity-40 [&_svg]:size-5 [&_svg]:shrink-0',
              a.danger ? 'text-bad-ink' : 'text-ink [&_svg]:text-accent-ink',
            )}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

/* ───────────────────────── Figures ───────────────────────── */

export type Tone = 'good' | 'bad' | 'neutral'

export interface Delta {
  text: string
  tone: Tone
  direction?: 'up' | 'down' | 'flat'
}

/**
 * Stat tile (data-viz contract): label · value (+unit) · optional delta (arrow + text, never color
 * alone). Big values use proportional figures; the unit is smaller and secondary.
 */
export function Stat({
  label,
  value,
  unit,
  delta,
  className,
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  delta?: Delta | null
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="truncate text-footnote text-ink-2">{label}</p>
      <p className="mt-0.5 truncate font-rounded text-title2 font-semibold">
        {value}
        {unit && <span className="ml-0.5 text-subhead font-semibold text-ink-2 uppercase">{unit}</span>}
      </p>
      {delta && (
        <p
          className={cn(
            'mt-0.5 flex items-center gap-1 text-footnote',
            delta.tone === 'good' ? 'text-good-ink' : delta.tone === 'bad' ? 'text-bad-ink' : 'text-ink-2',
          )}
        >
          {delta.direction === 'up' && <TrendingUp className="size-3.5 shrink-0" aria-hidden />}
          {delta.direction === 'down' && <TrendingDown className="size-3.5 shrink-0" aria-hidden />}
          <span className="truncate">{delta.text}</span>
        </p>
      )}
    </div>
  )
}

/** Progress against a limit. Track is a light step of the fill's hue; over the limit turns amber. */
export function Meter({
  value,
  max,
  color,
  label,
  height = 6,
  className,
  track,
}: {
  value: number
  max: number
  color: string
  label: string
  height?: number
  className?: string
  /** track colour; defaults to a light step of the fill's hue */
  track?: string
}) {
  const over = max > 0 && value > max
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={cn('w-full overflow-hidden rounded-full', className)}
      style={{ height, background: track ?? `color-mix(in oklab, ${color} 20%, var(--surface))` }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-ios)]"
        style={{ width: `${pct}%`, background: over ? 'var(--warning)' : color }}
      />
    </div>
  )
}

/* ───────────────────────── 12-hour time ───────────────────────── */

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)
const TIME_SELECT =
  'h-11 appearance-none rounded-xl border border-transparent bg-fill px-2.5 text-center text-callout text-ink tabular-nums outline-none focus:border-accent-ink focus:ring-3 focus:ring-accent/25'

/**
 * A 12-hour time picker (hour, minute, AM/PM) for a 'HH:MM' 24-hour value, so times read the
 * same on every device whatever its clock setting. With `allowEmpty`, the hour list has "No time".
 */
export function TimeField({
  value,
  onChange,
  label,
  allowEmpty = false,
  className,
}: {
  value: string | null
  onChange: (v: string | null) => void
  label: string
  allowEmpty?: boolean
  className?: string
}) {
  const [h24, m] = value ? value.split(':').map(Number) : [null, null]
  const pm = h24 != null && h24 >= 12
  const h12 = h24 == null ? null : h24 % 12 || 12
  const emit = (hour12: number, minute: number, isPm: boolean) => {
    const h = (hour12 % 12) + (isPm ? 12 : 0)
    onChange(`${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
  }
  return (
    <div role="group" aria-label={label} className={cn('flex items-center gap-1', className)}>
      <select
        aria-label={`${label}: hour`}
        className={TIME_SELECT}
        value={h12 ?? ''}
        onChange={(e) => {
          if (!e.target.value) return onChange(null)
          const hour = Number(e.target.value)
          // A new time: 5 to 11 is morning, 12 to 4 afternoon; after that it keeps the AM/PM you had.
          emit(hour, m ?? 0, h24 == null ? hour === 12 || hour < 5 : pm)
        }}
      >
        {(allowEmpty || h12 == null) && <option value="">{allowEmpty ? 'No time' : '–'}</option>}
        {HOURS_12.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-ink-2" aria-hidden>
        :
      </span>
      <select
        aria-label={`${label}: minutes`}
        className={TIME_SELECT}
        value={m ?? ''}
        disabled={h12 == null}
        onChange={(e) => h12 != null && emit(h12, Number(e.target.value), pm)}
      >
        {m == null && <option value="">––</option>}
        {MINUTES.map((x) => (
          <option key={x} value={x}>
            {String(x).padStart(2, '0')}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label}: AM or PM`}
        className={TIME_SELECT}
        value={h24 == null ? '' : pm ? 'pm' : 'am'}
        disabled={h12 == null}
        onChange={(e) => h12 != null && emit(h12, m ?? 0, e.target.value === 'pm')}
      >
        {h24 == null && <option value="">––</option>}
        <option value="am">AM</option>
        <option value="pm">PM</option>
      </select>
    </div>
  )
}
