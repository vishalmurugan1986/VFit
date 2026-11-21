import { Timer } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatClock } from '../lib/dates'
import { beep, primeAudio, vibrate } from '../lib/device'
import { useNow } from '../lib/hooks'
import { Button } from './ui'

interface RestState {
  endsAt: number
  total: number
}

interface RestTimerApi {
  state: RestState | null
  start: (seconds: number) => void
  adjust: (seconds: number) => void
  stop: () => void
}

const RestTimerContext = createContext<RestTimerApi>({
  state: null,
  start: () => {},
  adjust: () => {},
  stop: () => {},
})

/** App-wide rest timer, so it keeps running while you browse other screens mid-workout. */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RestState | null>(null)
  const start = useCallback((seconds: number) => {
    primeAudio()
    setState({ endsAt: Date.now() + seconds * 1000, total: seconds })
  }, [])
  const adjust = useCallback((seconds: number) => {
    setState((s) =>
      s ? { endsAt: Math.max(Date.now(), s.endsAt + seconds * 1000), total: Math.max(1, s.total + seconds) } : s,
    )
  }, [])
  const stop = useCallback(() => setState(null), [])
  const api = useMemo(() => ({ state, start, adjust, stop }), [state, start, adjust, stop])
  return <RestTimerContext.Provider value={api}>{children}</RestTimerContext.Provider>
}

export function useRestTimer(): RestTimerApi {
  return useContext(RestTimerContext)
}

export function RestTimerBar() {
  const { state, adjust, stop } = useRestTimer()
  const now = useNow(250, state !== null)

  // Alert when time is up, then tidy the bar away a few seconds later.
  useEffect(() => {
    if (!state) return
    const ms = Math.max(0, state.endsAt - Date.now())
    const alertTimer = window.setTimeout(() => {
      beep()
      vibrate([200, 100, 200])
    }, ms)
    const closeTimer = window.setTimeout(stop, ms + 5000)
    return () => {
      window.clearTimeout(alertTimer)
      window.clearTimeout(closeTimer)
    }
  }, [state, stop])

  if (!state) return null
  // `now` can be up to one tick old, so clamp to the timer's length.
  const remaining = Math.min(state.total, Math.max(0, Math.ceil((state.endsAt - now) / 1000)))
  const done = remaining === 0
  return (
    <div
      role="timer"
      aria-label="Rest timer"
      className="pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border-[0.5px] border-bar-line bg-bar shadow-[0_8px_30px_rgb(0_0_0/0.35)] backdrop-blur-xl backdrop-saturate-150"
    >
      <div className="flex items-center gap-1 py-2 pr-2 pl-4">
        <Timer className="mr-2 size-5 shrink-0 text-strength" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-footnote text-ink-2">{done ? 'Rest complete' : 'Rest'}</p>
          <p className="font-rounded text-title3 tabular-nums">{formatClock(remaining)}</p>
        </div>
        {!done && (
          <>
            <Button size="sm" variant="ghost" onClick={() => adjust(-15)} aria-label="15 seconds less">
              −15
            </Button>
            <Button size="sm" variant="ghost" onClick={() => adjust(15)} aria-label="15 seconds more">
              +15
            </Button>
          </>
        )}
        <Button size="sm" variant="secondary" onClick={stop}>
          {done ? 'Close' : 'Skip'}
        </Button>
      </div>
      <div className="h-1 bg-fill">
        <div
          className="h-full bg-strength transition-[width] duration-200 ease-linear"
          style={{ width: `${(remaining / state.total) * 100}%` }}
        />
      </div>
    </div>
  )
}
