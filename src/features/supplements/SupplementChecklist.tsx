import { Check } from 'lucide-react'
import { db } from '../../db/db'
import type { Supplement, SupplementLog } from '../../db/types'
import { cn } from '../../lib/cn'
import { formatTime } from '../../lib/dates'
import { uid } from '../../lib/id'
import { SUPPLEMENT_TIMES } from '../../lib/supplements'

/** Tick a supplement as taken on a date, or untick it. */
async function toggleTaken(s: Supplement, date: string) {
  await db.transaction('rw', db.supplementLogs, async () => {
    const existing = await db.supplementLogs
      .where('date')
      .equals(date)
      .filter((l) => l.supplementId === s.id)
      .first()
    if (existing) await db.supplementLogs.delete(existing.id)
    else await db.supplementLogs.add({ id: uid(), date, supplementId: s.id, takenAt: Date.now() })
  })
}

/** Supplements grouped by time of day, each with a big tick button. */
export function SupplementChecklist({
  date,
  supplements,
  logs,
  onOpen,
  grouped = true,
}: {
  date: string
  supplements: Supplement[]
  logs: SupplementLog[]
  onOpen?: (s: Supplement) => void
  grouped?: boolean
}) {
  const takenAt = new Map(logs.filter((l) => l.date === date).map((l) => [l.supplementId, l.takenAt]))
  const groups = SUPPLEMENT_TIMES.map((t) => ({ ...t, items: supplements.filter((s) => s.time === t.key) })).filter(
    (g) => g.items.length > 0,
  )
  return (
    <div className="flex flex-col">
      {groups.map((g) => (
        <section key={g.key}>
          {grouped && (
            <h3 className="px-4 pt-3 pb-1 text-footnote text-ink-2 uppercase">{g.label}</h3>
          )}
          <ul>
            {g.items.map((s) => {
              const at = takenAt.get(s.id)
              const taken = at != null
              return (
                <li key={s.id} className="flex min-h-12 items-center gap-3 px-4 py-1.5">
                  <button
                    type="button"
                    aria-pressed={taken}
                    aria-label={taken ? `${s.name} taken. Tap to undo` : `Mark ${s.name} as taken`}
                    onClick={() => void toggleTaken(s, date)}
                    className={cn(
                      "relative grid size-8 shrink-0 place-items-center rounded-full border-2 transition-[background-color,border-color,transform] duration-150 before:absolute before:-inset-1.5 before:content-[''] active:scale-90",
                      taken ? 'border-transparent bg-accent text-on-accent' : 'border-baseline text-transparent hover:border-ink-2',
                    )}
                  >
                    <Check className="size-[18px]" strokeWidth={3.2} />
                  </button>
                  <button
                    type="button"
                    disabled={!onOpen}
                    onClick={() => onOpen?.(s)}
                    className="min-w-0 flex-1 text-left disabled:cursor-default"
                  >
                    <p className={cn('truncate text-body', taken && 'text-ink-2 line-through decoration-1')}>{s.name}</p>
                    <p className="truncate text-footnote text-ink-2">
                      {[s.dose, taken ? `taken ${formatTime(at)}` : null].filter(Boolean).join(' · ') || ' '}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
