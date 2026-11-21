import { Activity, Dumbbell, Gauge, House, type LucideIcon, Settings, Utensils } from 'lucide-react'
import { Suspense, useEffect } from 'react'
import { Link, Outlet, useLocation, useNavigationType } from 'react-router'
import { cn } from '../lib/cn'
import { ErrorBoundary } from './ErrorBoundary'
import { Logo } from './Logo'
import { PwaPrompt } from './PwaPrompt'
import { RestTimerBar } from './RestTimer'
import { ToastStack } from './toast'
import { PageLoading } from './ui'

interface NavItem {
  to: string
  label: string
  /** shorter label for the phone's bottom bar */
  short?: string
  icon: LucideIcon
  match: (path: string) => boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: House, match: (p) => p === '/' },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell, match: (p) => /^\/(workouts|routines|exercises)/.test(p) },
  { to: '/cardio', label: 'Cardio', icon: Activity, match: (p) => p.startsWith('/cardio') },
  {
    to: '/nutrition',
    label: 'Food',
    icon: Utensils,
    match: (p) => p.startsWith('/nutrition') || p.startsWith('/goal') || p.startsWith('/supplements'),
  },
  { to: '/body', label: 'Body', icon: Gauge, match: (p) => p.startsWith('/body') },
]

export function Layout() {
  const { pathname } = useLocation()
  const navType = useNavigationType()

  // New screens start at the top; back/forward keeps the browser's own scroll position.
  useEffect(() => {
    if (navType !== 'POP') window.scrollTo(0, 0)
  }, [pathname, navType])

  return (
    <div className="min-h-dvh md:flex">
      {/* Solid strip behind the iPhone status bar when installed (status bar is translucent). */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top)] bg-page" />

      <Sidebar pathname={pathname} />

      <main className="min-w-0 flex-1 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+7rem)] md:pb-16">
        <div className="mx-auto w-full max-w-3xl px-4 md:px-8">
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<PageLoading />}>
              {/* Each screen settles in with a short rise and fade (none with reduced motion). */}
              <div key={pathname} className="animate-page-in">
                <Outlet />
              </div>
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      <BottomNav pathname={pathname} />

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+62px)] z-40 flex flex-col items-center gap-2 px-3 md:bottom-6 md:left-60">
        <ToastStack />
        <PwaPrompt />
        <RestTimerBar />
      </div>
    </div>
  )
}

function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r-[0.5px] border-[color:var(--bar-line)] bg-page px-3 pt-6 pb-4 md:flex">
      <Link to="/" aria-label="VFit, Today" className="mb-7 flex items-center px-3">
        <Logo />
      </Link>
      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV.map((item) => (
          <SideLink key={item.to} to={item.to} label={item.label} icon={item.icon} active={item.match(pathname)} />
        ))}
      </nav>
      <div className="mt-auto">
        <SideLink
          to="/settings"
          label="Settings"
          icon={Settings}
          active={pathname.startsWith('/settings') || pathname.startsWith('/alarm')}
        />
      </div>
    </aside>
  )
}

function SideLink({ to, label, icon: Icon, active }: { to: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-11 items-center gap-3 rounded-xl px-3 text-subhead font-medium transition-colors active:bg-fill',
        active ? 'bg-surface font-semibold text-ink' : 'text-ink-2 hover:bg-surface hover:text-ink',
      )}
    >
      <Icon className={cn('size-5', active && 'text-accent-ink')} aria-hidden />
      {label}
    </Link>
  )
}

function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t-[0.5px] border-[color:var(--bar-line)] bg-[var(--bar)] pb-[env(safe-area-inset-bottom)] backdrop-blur-[25px] md:hidden"
    >
      <div className="mx-auto grid h-[50px] max-w-xl grid-cols-5">
        {NAV.map(({ to, label, short, icon: Icon, match }) => {
          const active = match(pathname)
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-[3px] pt-1 text-[10px] leading-3 font-medium tracking-[0.01em] transition-colors',
                active ? 'text-accent-ink' : 'text-ink-2',
              )}
            >
              <span className="grid h-[26px] w-12 place-items-center transition-transform duration-150 active:scale-90">
                <Icon className="size-[25px]" strokeWidth={active ? 2.3 : 1.9} aria-hidden />
              </span>
              <span aria-hidden={short ? true : undefined}>{short ?? label}</span>
              {short && <span className="sr-only">{label}</span>}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
