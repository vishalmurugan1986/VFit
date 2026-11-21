import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export interface ToastOptions {
  action?: { label: string; onClick: () => void }
  duration?: number
}

interface ToastItem extends ToastOptions {
  id: number
  message: string
}

type ToastFn = (message: string, opts?: ToastOptions) => void

const ToastFnContext = createContext<ToastFn>(() => {})
const ToastListContext = createContext<{ items: ToastItem[]; dismiss: (id: number) => void }>({
  items: [],
  dismiss: () => {},
})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), [])
  const toast = useCallback<ToastFn>(
    (message, opts = {}) => {
      const id = nextId.current++
      setItems((list) => [...list.slice(-2), { id, message, ...opts }])
      window.setTimeout(() => dismiss(id), opts.duration ?? (opts.action ? 6000 : 3000))
    },
    [dismiss],
  )
  const list = useMemo(() => ({ items, dismiss }), [items, dismiss])
  return (
    <ToastFnContext.Provider value={toast}>
      <ToastListContext.Provider value={list}>{children}</ToastListContext.Provider>
    </ToastFnContext.Provider>
  )
}

export function useToast(): ToastFn {
  return useContext(ToastFnContext)
}

export function ToastStack() {
  const { items, dismiss } = useContext(ToastListContext)
  return (
    <div aria-live="polite" className="flex w-full flex-col items-center gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className="animate-toast pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl border-[0.5px] border-bar-line bg-bar shadow-[0_8px_30px_rgb(0_0_0/0.35)] backdrop-blur-xl backdrop-saturate-150 py-1.5 pr-1.5 pl-4 text-subhead text-ink"
        >
          <span className="min-w-0 flex-1 py-1">{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => {
                t.action?.onClick()
                dismiss(t.id)
              }}
              className="h-8 rounded-full px-3 font-semibold text-accent-ink transition-colors hover:bg-fill active:bg-fill-2"
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
            className="grid size-8 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-fill hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
