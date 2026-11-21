import { X } from 'lucide-react'
import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button, IconButton } from './ui'

/** Registers the service worker and offers updates (never reloads on its own mid-workout). */
export function PwaPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) window.setInterval(() => void registration.update(), 60 * 60 * 1000)
    },
  })

  useEffect(() => {
    if (!offlineReady) return
    const t = window.setTimeout(() => setOfflineReady(false), 5000)
    return () => window.clearTimeout(t)
  }, [offlineReady, setOfflineReady])

  if (!needRefresh && !offlineReady) return null
  return (
    <div className="animate-toast pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl border-[0.5px] border-bar-line bg-bar shadow-[0_8px_30px_rgb(0_0_0/0.35)] backdrop-blur-xl backdrop-saturate-150 py-1.5 pr-1.5 pl-4 text-subhead">
      <span className="min-w-0 flex-1">
        {needRefresh ? 'A new version of the app is ready.' : 'The app now works offline.'}
      </span>
      {needRefresh && (
        <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>
          Update
        </Button>
      )}
      <IconButton
        size="sm"
        label="Dismiss"
        onClick={() => {
          setNeedRefresh(false)
          setOfflineReady(false)
        }}
      >
        <X />
      </IconButton>
    </div>
  )
}
