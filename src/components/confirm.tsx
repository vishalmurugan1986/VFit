import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Button, Sheet } from './ui'

export interface ConfirmOptions {
  title: string
  message?: ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(async () => false)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<{ opts: ConfirmOptions; resolve: (ok: boolean) => void } | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => new Promise((resolve) => setPending({ opts, resolve })), [])

  const close = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  const opts = pending?.opts
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet
        open={pending !== null}
        onClose={() => close(false)}
        title={opts?.title ?? ''}
        footer={
          <div className="flex gap-2">
            <Button full onClick={() => close(false)}>
              {opts?.cancelText ?? 'Cancel'}
            </Button>
            <Button full variant={opts?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {opts?.confirmText ?? 'OK'}
            </Button>
          </div>
        }
      >
        {opts?.message && <div className="text-subhead text-ink-2">{opts.message}</div>}
      </Sheet>
    </ConfirmContext.Provider>
  )
}

/** `if (await confirm({ title: 'Delete?', danger: true })) …` */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext)
}
