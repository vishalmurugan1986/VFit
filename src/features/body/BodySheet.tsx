import { useLiveQuery } from 'dexie-react-hooks'
import { Trash } from 'lucide-react'
import { useState } from 'react'
import { useConfirm } from '../../components/confirm'
import { useToast } from '../../components/toast'
import { Button, Field, NumberField, Sheet, TextArea, TextInput } from '../../components/ui'
import { db } from '../../db/db'
import { getBodyFacts } from '../../db/queries'
import type { BodyEntry } from '../../db/types'
import { bmi, bmiCategory } from '../../lib/body'
import { todayStr } from '../../lib/dates'
import { uid } from '../../lib/id'
import { fmtNum } from '../../lib/units'

/** One entry per day: logging again on the same date fills in that day's entry. */
async function saveBodyEntry(record: BodyEntry): Promise<void> {
  await db.transaction('rw', db.body, async () => {
    const clash = (await db.body.where('date').equals(record.date).toArray()).find((e) => e.id !== record.id)
    if (!clash) {
      await db.body.put(record)
      return
    }
    await db.body.put({
      ...clash,
      weightKg: record.weightKg ?? clash.weightKg,
      heightCm: record.heightCm ?? clash.heightCm,
      bodyFatPct: record.bodyFatPct ?? clash.bodyFatPct,
      note: record.note ?? clash.note,
    })
    await db.body.delete(record.id)
  })
}

export function BodySheet({ open, onClose, entry }: { open: boolean; onClose: () => void; entry?: BodyEntry }) {
  return (
    <Sheet open={open} onClose={onClose} title={entry ? 'Body metrics' : 'Log body metrics'}>
      <BodyFormLoader entry={entry} onDone={onClose} />
    </Sheet>
  )
}

/** Height rarely changes, so a new entry starts with the last height you logged. */
function BodyFormLoader({ entry, onDone }: { entry?: BodyEntry; onDone: () => void }) {
  const facts = useLiveQuery(getBodyFacts, [])
  if (!facts) return null
  return <BodyForm entry={entry} lastHeight={facts.heightCm} onDone={onDone} />
}

function BodyForm({ entry, lastHeight, onDone }: { entry?: BodyEntry; lastHeight: number | null; onDone: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [date, setDate] = useState(entry?.date ?? todayStr())
  const [weight, setWeight] = useState<number | null>(entry?.weightKg ?? null)
  const [height, setHeight] = useState<number | null>(entry ? (entry.heightCm ?? null) : lastHeight)
  const [bodyFat, setBodyFat] = useState<number | null>(entry?.bodyFatPct ?? null)
  const [note, setNote] = useState(entry?.note ?? '')

  const weightKg = weight != null && weight > 0 ? weight : null
  const heightCm = height != null && height >= 50 && height <= 250 ? height : null
  const currentBmi = weightKg && heightCm ? bmi(weightKg, heightCm) : null

  const save = async () => {
    const bodyFatPct = bodyFat != null && bodyFat > 0 && bodyFat < 100 ? bodyFat : null
    if (height != null && heightCm == null) {
      toast('Enter your height in centimetres, e.g. 172')
      return
    }
    if (weightKg == null && heightCm == null && bodyFatPct == null) {
      toast('Enter at least one value')
      return
    }
    await saveBodyEntry({
      id: entry?.id ?? uid(),
      date,
      weightKg,
      heightCm,
      bodyFatPct,
      measurements: entry?.measurements,
      note: note.trim() || undefined,
      createdAt: entry?.createdAt ?? Date.now(),
    })
    toast('Saved')
    onDone()
  }

  const remove = async () => {
    if (!entry) return
    const ok = await confirm({ title: 'Delete this entry?', confirmText: 'Delete', danger: true })
    if (!ok) return
    onDone()
    await db.body.delete(entry.id)
    toast('Entry deleted', { action: { label: 'Undo', onClick: () => void db.body.put(entry) } })
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Field label="Date">
        <TextInput type="date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Weight">
          <NumberField value={weight} onValueChange={setWeight} decimals={1} suffix="kg" />
        </Field>
        <Field label="Height">
          <NumberField value={height} onValueChange={setHeight} decimals={1} suffix="cm" />
        </Field>
      </div>
      <Field label="Body fat">
        <NumberField value={bodyFat} onValueChange={setBodyFat} decimals={1} suffix="%" placeholder="Optional" />
      </Field>
      {currentBmi != null && (
        <p className="rounded-xl bg-fill px-3 py-2.5 text-subhead" aria-live="polite">
          <span className="font-semibold">BMI {fmtNum(currentBmi, 1)}</span>
          <span className="text-ink-2"> · {bmiCategory(currentBmi)}</span>
        </p>
      )}
      <Field label="Notes">
        <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </Field>

      <Button type="submit" variant="primary" size="lg" full>
        Save
      </Button>
      {entry && (
        <Button variant="danger-ghost" full onClick={() => void remove()}>
          <Trash />
          Delete entry
        </Button>
      )}
    </form>
  )
}
