import { useCallback, useSyncExternalStore } from 'react'

/* ---------- Install prompt (Chrome, Edge, Android) ---------- */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

// Registered at import time (from main.tsx) so the early browser event isn't missed.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    emit()
  })
}

export function useInstallPrompt() {
  const canInstall = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    () => deferredPrompt !== null,
  )
  const install = useCallback(async () => {
    const e = deferredPrompt
    if (!e) return false
    await e.prompt()
    const { outcome } = await e.userChoice
    deferredPrompt = null
    emit()
    return outcome === 'accepted'
  }, [])
  return { canInstall, install }
}

export function isStandalone(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}

/* ---------- Rest-timer alerts ---------- */

let audio: AudioContext | null = null

/** Call from a tap handler: iOS only allows sound from an audio context unlocked by a gesture. */
export function primeAudio(): void {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    audio = null
  }
}

export function beep(times = 2): void {
  if (!audio) return
  const t0 = audio.currentTime
  for (let i = 0; i < times; i++) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    const start = t0 + i * 0.28
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2)
    osc.connect(gain).connect(audio.destination)
    osc.start(start)
    osc.stop(start + 0.22)
  }
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* not supported */
  }
}
