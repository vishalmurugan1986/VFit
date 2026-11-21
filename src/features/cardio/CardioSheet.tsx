import { Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { useConfirm } from '../../components/confirm'
import { useToast } from '../../components/toast'
import { Button, Field, FieldGroup, NumberField, Sheet, TextArea, TextInput } from '../../components/ui'
import { db } from '../../db/db'
import { useCardioTypes } from '../../db/queries'
import type { CardioActivity, CardioSession } from '../../db/types'
import { paceLabel, usesDistance } from '../../lib/cardio'
import { cn } from '../../lib/cn'
import { todayStr } from '../../lib/dates'
import { uid } from '../../lib/id'
import { ActivityForm } from './ActivityManager'
import { CARDIO_ICONS } from './activityIcons'

export function CardioSheet({
  open,
  onClose,
  session,
  defaultActivity,
}: {
  open: boolean
  onClose: () => void
  session?: CardioSession
  defaultActivity?: CardioActivity
}) {
  return (
    <Sheet open={open} onClose={onClose} title={session ? 'Edit cardio' : 'Log cardio'}>
      <CardioForm session={session} defaultActivity={defaultActivity} onDone={onClose} />
    </Sheet>
  )
}

function CardioForm({
  session,
  defaultActivity,
  onDone,
}: {
  session?: CardioSession
  defaultActivity?: CardioActivity
  onDone: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const { visible, typeOf } = useCardioTypes()
  const d0 = session?.durationSec ?? 0
  const [adding, setAdding] = useState(false)
  const [activity, setActivity] = useState<CardioActivity>(session?.activity ?? defaultActivity ?? 'walk')
  const [date, setDate] = useState(session?.date ?? todayStr())
  const [hours, setHours] = useState<number | null>(session ? Math.floor(d0 / 3600) || null : null)
  const [minutes, setMinutes] = useState<number | null>(session ? Math.floor((d0 % 3600) / 60) || null : null)
  const [seconds, setSeconds] = useState<number | null>(session ? d0 % 60 || null : null)
  const [distance, setDistance] = useState<number | null>(session?.distanceKm ?? null)
  const [calories, setCalories] = useState<number | null>(session?.calories ?? null)
  const [heartRate, setHeartRate] = useState<number | null>(session?.avgHr ?? null)
  const [note, setNote] = useState(session?.note ?? '')

  const type = typeOf(activity)
  const showDistance = usesDistance(type.measure) || (session?.distanceKm ?? 0) > 0
  const durationSec = (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0)
  const distanceKm = showDistance && distance != null && distance > 0 ? distance : null
  const pace = paceLabel(type.measure, distanceKm, durationSec)
  // The picker shows your visible activities, plus this one if it's hidden (editing an old session).
  const choices = visible.some((t) => t.id === activity) ? visible : [...visible, type]

  if (adding) {
    return (
      <ActivityForm
        onCancel={() => setAdding(false)}
        onSaved={(t) => {
          setAdding(false)
          setActivity(t.id)
        }}
      />
    )
  }

  const save = async () => {
    if (durationSec <= 0) {
      toast('Enter how long it took')
      return
    }
    const record: CardioSession = {
      id: session?.id ?? uid(),
      date,
      activity,
      durationSec,
      distanceKm,
      calories: calories && calories > 0 ? Math.round(calories) : null,
      avgHr: heartRate && heartRate > 0 ? Math.round(heartRate) : null,
      note: note.trim() || undefined,
      createdAt: session?.createdAt ?? Date.now(),
    }
    await db.cardio.put(record)
    toast(session ? 'Session updated' : `${type.name} logged`)
    onDone()
  }

  const remove = async () => {
    if (!session) return
    const ok = await confirm({ title: 'Delete this session?', confirmText: 'Delete', danger: true })
    if (!ok) return
    onDone()
    await db.cardio.delete(session.id)
    toast('Session deleted', { action: { label: 'Undo', onClick: () => void db.cardio.put(session) } })
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <FieldGroup label="Activity">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {choices.map((t) => {
            const Icon = CARDIO_ICONS[t.icon] ?? CARDIO_ICONS.activity
            const on = t.id === activity
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => setActivity(t.id)}
                className={cn(
                  'flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-footnote font-medium transition-colors',
                  on ? 'border-cardio bg-cardio/10 text-ink' : 'border-line text-ink-2 hover:bg-fill/60 active:bg-fill',
                )}
              >
                <Icon className="size-5" style={on ? { color: 'var(--cardio)' } : undefined} aria-hidden />
                <span className="max-w-full truncate">{t.name}</span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-line px-1 py-2.5 text-footnote font-medium text-ink-2 transition-colors hover:bg-fill/60 active:bg-fill"
          >
            <Plus className="size-5" aria-hidden />
            New
          </button>
        </div>
      </FieldGroup>

      <Field label="Date">
        <TextInput type="date" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </Field>

      <FieldGroup label="Duration">
        <div className="grid grid-cols-3 gap-2">
          <NumberField integer value={hours} onValueChange={setHours} suffix="h" aria-label="Hours" placeholder="0" />
          <NumberField integer value={minutes} onValueChange={setMinutes} suffix="min" aria-label="Minutes" placeholder="0" />
          <NumberField integer value={seconds} onValueChange={setSeconds} suffix="s" aria-label="Seconds" placeholder="0" />
        </div>
      </FieldGroup>

      {showDistance && (
        <Field label="Distance" hint={pace ? `${type.measure === 'speed' ? 'Speed' : 'Pace'} ${pace}` : undefined}>
          <NumberField value={distance} onValueChange={setDistance} suffix="km" placeholder="Optional" />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Calories">
          <NumberField integer value={calories} onValueChange={setCalories} suffix="kcal" placeholder="Optional" />
        </Field>
        <Field label="Avg heart rate">
          <NumberField integer value={heartRate} onValueChange={setHeartRate} suffix="bpm" placeholder="Optional" />
        </Field>
      </div>

      <Field label="Notes">
        <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Route, conditions, how it felt" />
      </Field>

      <Button type="submit" variant="primary" size="lg" full>
        {session ? 'Save changes' : 'Save'}
      </Button>
      {session && (
        <Button variant="danger-ghost" full onClick={() => void remove()}>
          <Trash />
          Delete session
        </Button>
      )}
    </form>
  )
}
