import { Trash } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../../components/toast'
import { Button, Chip, Field, FieldGroup, Select, Sheet, Switch, TextArea, TextInput } from '../../components/ui'
import { db } from '../../db/db'
import { SUPPLEMENT_PRESETS } from '../../db/seed'
import { useSettings } from '../../db/settings'
import type { Supplement, SupplementTime } from '../../db/types'
import { cn } from '../../lib/cn'
import { uid } from '../../lib/id'
import { daysLabel, SUPPLEMENT_TIMES } from '../../lib/supplements'

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function SupplementSheet({
  open,
  onClose,
  supplement,
  existingNames = [],
}: {
  open: boolean
  onClose: () => void
  supplement?: Supplement
  existingNames?: string[]
}) {
  return (
    <Sheet open={open} onClose={onClose} title={supplement ? 'Edit supplement' : 'Add supplement'}>
      <SupplementForm supplement={supplement} existingNames={existingNames} onDone={onClose} />
    </Sheet>
  )
}

function SupplementForm({
  supplement,
  existingNames,
  onDone,
}: {
  supplement?: Supplement
  existingNames: string[]
  onDone: () => void
}) {
  const toast = useToast()
  const { weekStartsOn } = useSettings()
  const [name, setName] = useState(supplement?.name ?? '')
  const [dose, setDose] = useState(supplement?.dose ?? '')
  const [time, setTime] = useState<SupplementTime>(supplement?.time ?? 'morning')
  const [days, setDays] = useState<number[]>(supplement?.days ?? [])
  const [notes, setNotes] = useState(supplement?.notes ?? '')
  const [paused, setPaused] = useState(supplement?.paused ?? false)

  const taken = new Set(existingNames.map((n) => n.toLowerCase()))
  const presets = SUPPLEMENT_PRESETS.filter((p) => !taken.has(p.name.toLowerCase()))
  const order = weekStartsOn === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6]
  const everyDay = days.length === 0

  const toggleDay = (d: number) =>
    setDays((current) => {
      const base = current.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : current
      const next = base.includes(d) ? base.filter((x) => x !== d) : [...base, d]
      return next.length === 7 ? [] : next.sort((a, b) => a - b)
    })

  const save = async () => {
    const n = name.trim()
    if (!n) {
      toast('Give it a name')
      return
    }
    const record: Supplement = {
      id: supplement?.id ?? uid(),
      name: n,
      dose: dose.trim(),
      time,
      days,
      notes: notes.trim() || undefined,
      paused: paused || undefined,
      order: supplement?.order ?? ((await db.supplements.orderBy('order').last())?.order ?? 0) + 1,
      createdAt: supplement?.createdAt ?? Date.now(),
    }
    await db.supplements.put(record)
    toast(supplement ? 'Saved' : `${n} added`)
    onDone()
  }

  const remove = async () => {
    if (!supplement) return
    const logs = await db.supplementLogs.where('supplementId').equals(supplement.id).toArray()
    onDone()
    await db.transaction('rw', db.supplements, db.supplementLogs, async () => {
      await db.supplements.delete(supplement.id)
      await db.supplementLogs.bulkDelete(logs.map((l) => l.id))
    })
    toast(`${supplement.name} deleted`, {
      action: {
        label: 'Undo',
        onClick: () =>
          void db.transaction('rw', db.supplements, db.supplementLogs, async () => {
            await db.supplements.put(supplement)
            await db.supplementLogs.bulkPut(logs)
          }),
      },
    })
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      {!supplement && presets.length > 0 && (
        <FieldGroup label="Common supplements (or type your own below)">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <Chip
                key={p.name}
                selected={name === p.name}
                onClick={() => {
                  setName(p.name)
                  setDose(p.dose)
                  setTime(p.time)
                }}
              >
                {p.name}
              </Chip>
            ))}
          </div>
        </FieldGroup>
      )}

      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Creatine" maxLength={60} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dose">
          <TextInput value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 5 g, 1 capsule" maxLength={40} />
        </Field>
        <Field label="When">
          <Select value={time} onChange={(e) => setTime(e.target.value as SupplementTime)}>
            {SUPPLEMENT_TIMES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <FieldGroup label={`Days · ${daysLabel(days)}`}>
        <div className="flex justify-between gap-1.5">
          {order.map((d) => {
            const on = everyDay || days.includes(d)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={DAY_NAMES[d]}
                onClick={() => toggleDay(d)}
                className={cn(
                  'grid size-10 place-items-center rounded-full text-subhead font-semibold transition-colors',
                  on ? 'bg-ink text-page' : 'bg-fill text-ink-2 hover:text-ink',
                )}
              >
                {DAY_LETTERS[d]}
              </button>
            )
          })}
        </div>
        {!everyDay && (
          <button type="button" onClick={() => setDays([])} className="self-start text-subhead font-medium text-accent-ink">
            Every day
          </button>
        )}
      </FieldGroup>

      <Field label="Notes">
        <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional, e.g. with water, brand" />
      </Field>

      {supplement && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">Paused</p>
            <p className="text-footnote text-ink-2">Hide it from your daily list without deleting its history.</p>
          </div>
          <Switch label="Paused" checked={paused} onChange={setPaused} />
        </div>
      )}

      <Button type="submit" variant="primary" size="lg" full>
        {supplement ? 'Save' : 'Add supplement'}
      </Button>
      {supplement && (
        <Button variant="danger-ghost" full onClick={() => void remove()}>
          <Trash />
          Delete supplement
        </Button>
      )}
    </form>
  )
}
