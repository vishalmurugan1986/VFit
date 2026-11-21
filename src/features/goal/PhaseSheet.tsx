import { Trash } from 'lucide-react'
import { useState } from 'react'
import { useConfirm } from '../../components/confirm'
import { useToast } from '../../components/toast'
import { Button, Field, FieldGroup, NumberField, Sheet, TextArea, TextInput } from '../../components/ui'
import { db } from '../../db/db'
import { usePhases } from '../../db/settings'
import type { Goal, Nutrients, Phase } from '../../db/types'
import { cn } from '../../lib/cn'
import { addDays, formatDate, isDateStr, todayStr } from '../../lib/dates'
import { uid } from '../../lib/id'
import { caloriesFromMacros } from '../../lib/nutrition'
import { DEFAULT_TARGETS, GOALS, goalLabel, NEXT_GOAL } from '../../lib/phases'
import { fmtNum } from '../../lib/units'

export const TARGET_FIELDS: { key: keyof Nutrients; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
]

/** Create a phase (when `phase` is undefined) or edit one. */
export function PhaseSheet({ open, phase, onClose }: { open: boolean; phase?: Phase; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={phase ? `Edit ${goalLabel(phase.goal)} phase` : 'New phase'}>
      {open && <PhaseForm key={phase?.id ?? 'new'} phase={phase} onDone={onClose} />}
    </Sheet>
  )
}

function PhaseForm({ phase, onDone }: { phase?: Phase; onDone: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const { list } = usePhases()
  const today = todayStr()
  const defaults = phase ?? newPhaseDefaults(list, today)

  const [goal, setGoal] = useState<Goal>(defaults.goal)
  const [start, setStart] = useState(defaults.startDate)
  const [targetWeight, setTargetWeight] = useState<number | null>(defaults.targetWeightKg)
  const [targets, setTargets] = useState<Nutrients>(defaults.targets)
  const [note, setNote] = useState(defaults.note ?? '')

  const macroKcal = Math.round(caloriesFromMacros(targets.protein, targets.carbs, targets.fat))

  const save = async () => {
    if (!isDateStr(start)) {
      toast('Choose a start date')
      return
    }
    if (list.some((p) => p.id !== phase?.id && p.startDate === start)) {
      toast('Another phase already starts on that day. Pick another date, or edit that phase.')
      return
    }
    if (!(targets.calories > 0)) {
      toast('Enter a calorie target')
      return
    }
    await db.phases.put({
      id: phase?.id ?? uid(),
      goal,
      startDate: start,
      targetWeightKg: targetWeight != null && targetWeight > 0 ? targetWeight : null,
      targets,
      note: note.trim() || undefined,
      createdAt: phase?.createdAt ?? Date.now(),
    })
    toast(phase ? 'Phase saved' : start > today ? `${goalLabel(goal)} planned` : `${goalLabel(goal)} started`)
    onDone()
  }

  const remove = async () => {
    if (!phase) return
    const ok = await confirm({
      title: `Delete this ${goalLabel(phase.goal)} phase?`,
      message:
        'Your logs stay as they are. The days it covered will count towards the phase before it (or the next one, if it was the first).',
      confirmText: 'Delete phase',
      danger: true,
    })
    if (!ok) return
    onDone()
    await db.phases.delete(phase.id)
    toast('Phase deleted', { action: { label: 'Undo', onClick: () => void db.phases.put(phase) } })
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <GoalChoice value={goal} onChange={setGoal} />

      <Field label="Start date" hint="It runs until you start your next phase.">
        <TextInput
          type="date"
          value={start}
          onChange={(e) => {
            if (isDateStr(e.target.value)) setStart(e.target.value)
          }}
        />
      </Field>

      <Field label="Target weight">
        <NumberField value={targetWeight} onValueChange={setTargetWeight} decimals={1} suffix="kg" placeholder="Optional" />
      </Field>

      <TargetFields value={targets} onChange={setTargets} />
      <p className="-mt-1 text-footnote text-ink-2">
        Protein, carbs and fat add up to {fmtNum(macroKcal)} kcal
        {Math.abs(macroKcal - targets.calories) > 50 ? ` (calorie target ${fmtNum(targets.calories)}).` : '.'}
      </p>

      <Field label="Notes">
        <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional, e.g. summer cut" />
      </Field>

      <Button type="submit" variant="primary" size="lg" full>
        {phase ? 'Save' : start > today ? `Plan ${goalLabel(goal)}` : `Start ${goalLabel(goal)}`}
      </Button>
      {phase && list.length > 1 && (
        <Button variant="danger-ghost" full onClick={() => void remove()}>
          <Trash />
          Delete phase
        </Button>
      )}
      {!phase && start <= today && (
        <p className="text-center text-footnote text-ink-2">
          Your current phase ends on {formatDate(addDays(start, -1), { day: 'numeric', month: 'short' })}.
        </p>
      )}
    </form>
  )
}

/**
 * A new phase follows your latest one: it starts today (or, after a phase you've planned
 * ahead, 12 weeks after that one), with the usual next goal and the same targets to adjust.
 */
function newPhaseDefaults(list: Phase[], today: string): Omit<Phase, 'id' | 'createdAt'> {
  const last = list[list.length - 1]
  if (!last) return { goal: 'maingain', startDate: today, targetWeightKg: null, targets: DEFAULT_TARGETS }
  let start = last.startDate > today ? addDays(last.startDate, 12 * 7) : today
  if (start <= last.startDate) start = addDays(last.startDate, 1)
  return { goal: NEXT_GOAL[last.goal], startDate: start, targetWeightKg: null, targets: last.targets }
}

export function GoalChoice({ value, onChange }: { value: Goal; onChange: (g: Goal) => void }) {
  return (
    <FieldGroup label="Goal">
      <div className="grid grid-cols-3 gap-2">
        {GOALS.map((g) => (
          <button
            key={g.key}
            type="button"
            aria-pressed={value === g.key}
            onClick={() => onChange(g.key)}
            className={cn(
              'rounded-xl border px-2.5 py-2 text-left transition-colors',
              value === g.key ? 'border-accent-line bg-accent-soft' : 'border-line hover:bg-fill/60 active:bg-fill',
            )}
          >
            <span className="block text-subhead font-semibold">{g.label}</span>
            <span className="block text-footnote leading-snug text-ink-2">{g.hint}</span>
          </button>
        ))}
      </div>
    </FieldGroup>
  )
}

export function TargetFields({ value, onChange }: { value: Nutrients; onChange: (v: Nutrients) => void }) {
  return (
    <FieldGroup label="Daily targets (set by you)">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TARGET_FIELDS.map((t) => (
          <Field key={t.key} label={<span className="text-footnote">{t.label}</span>}>
            <NumberField
              integer
              suffix={t.unit}
              value={value[t.key]}
              onValueChange={(v) => {
                if (v != null && v >= (t.key === 'calories' ? 1 : 0)) onChange({ ...value, [t.key]: v })
              }}
            />
          </Field>
        ))}
      </div>
    </FieldGroup>
  )
}
