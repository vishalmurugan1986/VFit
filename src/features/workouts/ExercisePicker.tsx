import { Check, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Chip, Field, FieldGroup, Segmented, Select, Sheet, TextInput } from '../../components/ui'
import { db } from '../../db/db'
import { useExercises } from '../../db/queries'
import {
  EQUIPMENT,
  MUSCLES,
  exerciseMeta,
  type Equipment,
  type Exercise,
  type ExerciseKind,
  type Muscle,
} from '../../db/types'
import { cn } from '../../lib/cn'
import { uid } from '../../lib/id'

const KIND_OPTIONS: { value: ExerciseKind; label: string }[] = [
  { value: 'weight', label: 'Weight × reps' },
  { value: 'bodyweight', label: 'Reps' },
  { value: 'time', label: 'Time' },
]

export function ExerciseForm({
  exercise,
  initialName = '',
  onSaved,
  onCancel,
}: {
  exercise?: Exercise
  initialName?: string
  onSaved: (e: Exercise) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(exercise?.name ?? initialName)
  const [muscle, setMuscle] = useState<Muscle>(exercise?.muscle ?? 'chest')
  const [equipment, setEquipment] = useState<Equipment>(exercise?.equipment ?? 'barbell')
  const [kind, setKind] = useState<ExerciseKind>(exercise?.kind ?? 'weight')

  const save = async () => {
    const n = name.trim()
    if (!n) return
    const ex: Exercise = exercise
      ? { ...exercise, name: n, muscle, equipment, kind }
      : { id: uid(), name: n, muscle, equipment, kind, custom: true, createdAt: Date.now() }
    await db.exercises.put(ex)
    onSaved(ex)
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Field label="Name">
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Incline Cable Fly"
          maxLength={80}
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Muscle group">
          <Select value={muscle} onChange={(e) => setMuscle(e.target.value as Muscle)}>
            {MUSCLES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Equipment">
          <Select
            value={equipment}
            onChange={(e) => {
              const eq = e.target.value as Equipment
              setEquipment(eq)
              if (eq === 'bodyweight' && kind === 'weight') setKind('bodyweight')
            }}
          >
            {EQUIPMENT.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <FieldGroup label="Log it as">
        <Segmented full ariaLabel="Log it as" value={kind} onChange={setKind} options={KIND_OPTIONS} />
      </FieldGroup>
      <div className="flex gap-2 pt-1">
        <Button full onClick={onCancel}>
          Cancel
        </Button>
        <Button full type="submit" variant="primary" disabled={!name.trim()}>
          Save
        </Button>
      </div>
    </form>
  )
}

/** Multi-select exercise picker with search, muscle filters and inline "create". */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = 'Add exercises',
}: {
  open: boolean
  onClose: () => void
  onPick: (ids: string[]) => void
  title?: string
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <PickerBody
        onPick={(ids) => {
          onPick(ids)
          onClose()
        }}
      />
    </Sheet>
  )
}

function PickerBody({ onPick }: { onPick: (ids: string[]) => void }) {
  const { list } = useExercises()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<Muscle | 'all'>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const q = query.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      list.filter(
        (e) => !e.archived && (muscle === 'all' || e.muscle === muscle) && (!q || e.name.toLowerCase().includes(q)),
      ),
    [list, muscle, q],
  )
  const exactMatch = list.some((e) => e.name.toLowerCase() === q)
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  if (creating) {
    return (
      <div className="pt-1">
        <ExerciseForm
          initialName={query.trim()}
          onCancel={() => setCreating(false)}
          onSaved={(ex) => {
            setCreating(false)
            setQuery('')
            setSelected((s) => [...s, ex.id])
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 -mx-4 bg-surface px-4 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2" />
          <TextInput
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises"
            aria-label="Search exercises"
            className="pl-9"
          />
        </div>
        <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
          {[{ key: 'all' as const, label: 'All' }, ...MUSCLES].map((m) => (
            <Chip key={m.key} selected={muscle === m.key} onClick={() => setMuscle(m.key)}>
              {m.label}
            </Chip>
          ))}
        </div>
      </div>

      {q && !exactMatch && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left font-medium text-accent-ink hover:bg-fill/60 active:bg-fill"
        >
          <span className="grid size-6 place-items-center">
            <Plus className="size-5" />
          </span>
          Create “{query.trim()}”
        </button>
      )}

      <ul className="flex-1">
        {filtered.map((e) => {
          const on = selected.includes(e.id)
          return (
            <li key={e.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(e.id)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-fill/60 active:bg-fill"
              >
                <span
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors',
                    on ? 'border-accent-line bg-accent text-on-accent' : 'border-baseline',
                  )}
                >
                  {on && <Check className="size-4" strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.name}</span>
                  <span className="block truncate text-footnote text-ink-2">
                    {exerciseMeta(e)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {filtered.length === 0 && (
        <p className="py-8 text-center text-footnote text-ink-2">
          No exercises match{q ? ` “${query.trim()}”` : ' this filter'}.
        </p>
      )}

      {/* Sticks into the sheet's bottom padding so list rows never show underneath. */}
      <div className="sticky -bottom-4 -mx-4 mt-3 border-t-[0.5px] border-bar-line bg-surface px-4 pt-3 pb-4">
        <Button variant="primary" full disabled={selected.length === 0} onClick={() => onPick(selected)}>
          {selected.length ? `Add ${selected.length} exercise${selected.length === 1 ? '' : 's'}` : 'Select exercises'}
        </Button>
      </div>
    </div>
  )
}
