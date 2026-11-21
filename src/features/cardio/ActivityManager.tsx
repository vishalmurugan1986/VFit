import { useLiveQuery } from 'dexie-react-hooks'
import { Eye, EyeOff, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../../components/toast'
import { Button, Field, FieldGroup, IconButton, IconChip, Sheet, TextInput } from '../../components/ui'
import { db } from '../../db/db'
import { useCardioTypes } from '../../db/queries'
import type { CardioIcon, CardioMeasure, CardioType } from '../../db/types'
import { CARDIO_MEASURES } from '../../lib/cardio'
import { cn } from '../../lib/cn'
import { uid } from '../../lib/id'
import { CARDIO_ICON_KEYS, CARDIO_ICONS } from './activityIcons'

/** Form for adding your own activity: name, how it's measured, and an icon. */
export function ActivityForm({ onSaved, onCancel }: { onSaved: (t: CardioType) => void; onCancel: () => void }) {
  const toast = useToast()
  const { all } = useCardioTypes()
  const [name, setName] = useState('')
  const [measure, setMeasure] = useState<CardioMeasure>('pace')
  const [icon, setIcon] = useState<CardioIcon>('activity')

  const save = async () => {
    const n = name.trim()
    if (!n) return
    if (all.some((t) => t.name.toLowerCase() === n.toLowerCase())) {
      toast(`You already have ${n}`)
      return
    }
    const type: CardioType = {
      id: uid(),
      name: n,
      measure,
      icon,
      builtIn: false,
      order: all.reduce((m, t) => Math.max(m, t.order), 0) + 1,
      createdAt: Date.now(),
    }
    await db.cardioTypes.add(type)
    onSaved(type)
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Field label="Activity name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Skipping, Treadmill, Zumba" maxLength={40} />
      </Field>
      <FieldGroup label="How do you measure it?">
        <div className="flex flex-col gap-2">
          {CARDIO_MEASURES.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={measure === m.key}
              onClick={() => setMeasure(m.key)}
              className={cn(
                'rounded-xl border px-3 py-2.5 text-left transition-colors',
                measure === m.key ? 'border-cardio bg-cardio/10' : 'border-line hover:bg-fill/60 active:bg-fill',
              )}
            >
              <span className="block text-subhead font-medium">{m.label}</span>
              <span className="block text-footnote text-ink-2">{m.hint}</span>
            </button>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Icon">
        <div className="grid grid-cols-6 gap-2">
          {CARDIO_ICON_KEYS.map((key) => {
            const Icon = CARDIO_ICONS[key]
            return (
              <button
                key={key}
                type="button"
                aria-label={`Icon ${key}`}
                aria-pressed={icon === key}
                onClick={() => setIcon(key)}
                className={cn(
                  'grid h-11 place-items-center rounded-xl border transition-colors',
                  icon === key ? 'border-cardio bg-cardio/10 text-cardio' : 'border-line text-ink-2 hover:bg-fill/60 active:bg-fill',
                )}
              >
                <Icon className="size-5" aria-hidden />
              </button>
            )
          })}
        </div>
      </FieldGroup>
      <div className="flex gap-2">
        <Button full onClick={onCancel}>
          Cancel
        </Button>
        <Button full type="submit" variant="primary" disabled={!name.trim()}>
          Add activity
        </Button>
      </div>
    </form>
  )
}

/** Show, hide, add and delete cardio activities. */
export function ActivitiesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Cardio activities">
      <ActivityList />
    </Sheet>
  )
}

function ActivityList() {
  const toast = useToast()
  const { all } = useCardioTypes()
  const [adding, setAdding] = useState(false)
  const counts = useLiveQuery(async () => {
    const c = new Map<string, number>()
    await db.cardio.each((s) => c.set(s.activity, (c.get(s.activity) ?? 0) + 1))
    return c
  }, [])

  if (adding) {
    return <ActivityForm onCancel={() => setAdding(false)} onSaved={(t) => { setAdding(false); toast(`${t.name} added`) }} />
  }

  const remove = async (t: CardioType) => {
    await db.cardioTypes.delete(t.id)
    toast(`${t.name} deleted`, { action: { label: 'Undo', onClick: () => void db.cardioTypes.put(t) } })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-footnote text-ink-2">
        Hidden activities don't appear when you log, but sessions you already logged keep them.
      </p>
      <ul className="-mx-2 flex flex-col">
        {all.map((t) => {
          const Icon = CARDIO_ICONS[t.icon] ?? CARDIO_ICONS.activity
          const n = counts?.get(t.id) ?? 0
          return (
            <li key={t.id} className={cn('flex items-center gap-3 rounded-xl px-2 py-2', t.hidden && 'opacity-60')}>
              <IconChip color="var(--cardio)" size="sm">
                <Icon aria-hidden />
              </IconChip>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.name}</p>
                <p className="truncate text-footnote text-ink-2">
                  {CARDIO_MEASURES.find((m) => m.key === t.measure)?.label ?? 'Distance + pace (per 100 m)'}
                  {n > 0 && ` · ${n} logged`}
                  {t.hidden && ' · Hidden'}
                </p>
              </div>
              <IconButton
                size="sm"
                label={t.hidden ? `Show ${t.name}` : `Hide ${t.name}`}
                onClick={() => void db.cardioTypes.update(t.id, { hidden: !t.hidden })}
              >
                {t.hidden ? <Eye /> : <EyeOff />}
              </IconButton>
              {!t.builtIn && n === 0 && (
                <IconButton size="sm" label={`Delete ${t.name}`} onClick={() => void remove(t)}>
                  <Trash />
                </IconButton>
              )}
            </li>
          )
        })}
      </ul>
      <Button variant="outline" full onClick={() => setAdding(true)}>
        <Plus />
        Add your own activity
      </Button>
    </div>
  )
}
