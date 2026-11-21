import { useLiveQuery } from 'dexie-react-hooks'
import { Apple, Plus, Search, Trash } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../../components/toast'
import {
  Button,
  Chip,
  EmptyState,
  Field,
  FieldGroup,
  IconButton,
  NumberField,
  PageLoading,
  Segmented,
  Sheet,
  TextInput,
} from '../../components/ui'
import { db } from '../../db/db'
import type { FoodEntry, Meal, SavedFood } from '../../db/types'
import { uid } from '../../lib/id'
import { todayStr } from '../../lib/dates'
import { mealForNow } from '../../lib/meals'
import { caloriesFromMacros, macroLine, mealName } from '../../lib/nutrition'
import { useSettings } from '../../db/settings'
import { fmtNum } from '../../lib/units'

/** Remember a food under "My foods" (matched by name, case-insensitive). */
async function rememberFood(e: FoodEntry): Promise<void> {
  await db.transaction('rw', db.savedFoods, async () => {
    const existing = await db.savedFoods.where('name').equalsIgnoreCase(e.name).first()
    await db.savedFoods.put({
      id: existing?.id ?? uid(),
      name: e.name,
      serving: e.serving,
      calories: e.calories,
      protein: e.protein,
      carbs: e.carbs,
      fat: e.fat,
      lastUsed: Date.now(),
      useCount: (existing?.useCount ?? 0) + 1,
    })
  })
}

export function FoodSheet({
  open,
  onClose,
  date,
  meal,
  entry,
}: {
  open: boolean
  onClose: () => void
  date: string
  /** defaults to the meal whose time it is (today), else your first meal */
  meal?: Meal
  entry?: FoodEntry
}) {
  return (
    <Sheet open={open} onClose={onClose} title={entry ? 'Edit food' : 'Add food'}>
      {entry ? (
        <FoodForm date={entry.date} meal={entry.meal} entry={entry} onDone={onClose} />
      ) : (
        <AddFood date={date} meal={meal} onDone={onClose} />
      )}
    </Sheet>
  )
}

type Tab = 'saved' | 'new'

function AddFood({ date, meal: requested, onDone }: { date: string; meal?: Meal; onDone: () => void }) {
  const { meals } = useSettings()
  // Picked once when the sheet opens: the meal whose time it is (today), else your first meal.
  const [meal] = useState<Meal>(
    () =>
      requested ??
      (date === todayStr() ? mealForNow(meals, date, Date.now()) : meals[0]?.id) ??
      'breakfast',
  )
  const saved = useLiveQuery(() => db.savedFoods.orderBy('lastUsed').reverse().toArray(), [])
  const [tab, setTab] = useState<Tab>('saved')
  const [prefill, setPrefill] = useState<SavedFood | null>(null)
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        full
        ariaLabel="How to add food"
        value={tab}
        onChange={(t) => {
          setTab(t)
          setPrefill(null)
        }}
        options={[
          { value: 'saved', label: 'My foods' },
          { value: 'new', label: 'New food' },
        ]}
      />
      {tab === 'saved' && (
        <SavedFoods
          foods={saved}
          onPick={(f) => {
            setPrefill(f)
            setTab('new')
          }}
          onNew={() => setTab('new')}
        />
      )}
      {tab === 'new' && (
        <FoodForm key={prefill?.id ?? 'blank'} date={date} meal={meal} prefill={prefill ?? undefined} onDone={onDone} />
      )}
    </div>
  )
}

function SavedFoods({
  foods,
  onPick,
  onNew,
}: {
  foods?: SavedFood[]
  onPick: (f: SavedFood) => void
  onNew: () => void
}) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  if (!foods) return <PageLoading />
  if (foods.length === 0) {
    return (
      <EmptyState
        icon={<Apple />}
        title="No saved foods yet"
        action={
          <Button variant="primary" onClick={onNew}>
            <Plus />
            Add a new food
          </Button>
        }
      >
        Foods you add are saved here, so logging them again takes one tap.
      </EmptyState>
    )
  }
  const q = query.trim().toLowerCase()
  const list = (q ? foods.filter((f) => f.name.toLowerCase().includes(q)) : foods).slice(0, 100)
  const remove = async (f: SavedFood) => {
    await db.savedFoods.delete(f.id)
    toast(`Removed ${f.name} from My foods`, { action: { label: 'Undo', onClick: () => void db.savedFoods.put(f) } })
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2" />
        <TextInput
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search my foods"
          aria-label="Search my foods"
          className="pl-9"
        />
      </div>
      <ul className="-mx-2">
        {list.map((f) => (
          <li key={f.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPick(f)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-fill/60 active:bg-fill"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{f.name}</p>
                <p className="truncate text-footnote text-ink-2 tabular-nums">
                  {[f.serving, macroLine(f)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className="shrink-0 text-subhead font-medium tabular-nums">{fmtNum(f.calories)} kcal</span>
            </button>
            <IconButton size="sm" label={`Remove ${f.name} from My foods`} onClick={() => void remove(f)}>
              <Trash />
            </IconButton>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="py-6 text-center text-footnote text-ink-2">No saved foods match.</p>}
    </div>
  )
}

function MealPicker({ value, onChange }: { value: Meal; onChange: (m: Meal) => void }) {
  const { meals } = useSettings()
  return (
    <FieldGroup label="Meal">
      <div className="flex flex-wrap gap-2">
        {meals.map((m) => (
          <Chip key={m.id} selected={value === m.id} onClick={() => onChange(m.id)}>
            {m.name}
          </Chip>
        ))}
      </div>
    </FieldGroup>
  )
}

function FoodForm({
  date,
  meal: initialMeal,
  entry,
  prefill,
  onDone,
}: {
  date: string
  meal: Meal
  entry?: FoodEntry
  prefill?: SavedFood
  onDone: () => void
}) {
  const toast = useToast()
  const { meals } = useSettings()
  const src = entry ?? prefill
  const [name, setName] = useState(src?.name ?? '')
  const [serving, setServing] = useState(src?.serving ?? '')
  const [calories, setCalories] = useState<number | null>(src ? src.calories : null)
  const [protein, setProtein] = useState<number | null>(src ? src.protein : null)
  const [carbs, setCarbs] = useState<number | null>(src ? src.carbs : null)
  const [fat, setFat] = useState<number | null>(src ? src.fat : null)
  const [servings, setServings] = useState<number | null>(entry?.servings ?? 1)
  const [meal, setMeal] = useState<Meal>(entry?.meal ?? initialMeal)
  const [remember, setRemember] = useState(!entry)

  const macroKcal = Math.round(caloriesFromMacros(protein ?? 0, carbs ?? 0, fat ?? 0))
  const kcal = calories ?? (macroKcal > 0 ? macroKcal : null)
  const k = servings != null && servings > 0 ? servings : 1
  const totals = {
    calories: (kcal ?? 0) * k,
    protein: (protein ?? 0) * k,
    carbs: (carbs ?? 0) * k,
    fat: (fat ?? 0) * k,
  }

  const save = async () => {
    if (!name.trim()) {
      toast('Give the food a name')
      return
    }
    if (kcal == null) {
      toast('Enter the calories (or the protein, carbs and fat)')
      return
    }
    const record: FoodEntry = {
      id: entry?.id ?? uid(),
      date: entry?.date ?? date,
      meal,
      name: name.trim(),
      serving: serving.trim() || undefined,
      servings: k,
      calories: kcal,
      protein: protein ?? 0,
      carbs: carbs ?? 0,
      fat: fat ?? 0,
      createdAt: entry?.createdAt ?? Date.now(),
    }
    await db.foods.put(record)
    if (remember) await rememberFood(record)
    toast(entry ? 'Food updated' : `Added to ${mealName(meals, meal)}`)
    onDone()
  }

  const remove = async () => {
    if (!entry) return
    onDone()
    await db.foods.delete(entry.id)
    toast(`Removed ${entry.name}`, { action: { label: 'Undo', onClick: () => void db.foods.put(entry) } })
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Field label="Food">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Greek yogurt" maxLength={100} />
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
        <Field label="Serving size">
          <TextInput
            value={serving}
            onChange={(e) => setServing(e.target.value)}
            placeholder="e.g. 1 cup, 150 g"
            maxLength={60}
          />
        </Field>
        <Field label="Servings">
          <NumberField value={servings} onValueChange={setServings} decimals={2} />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-subhead font-semibold">Per serving</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Calories">
            <NumberField
              integer
              value={calories}
              onValueChange={setCalories}
              suffix="kcal"
              placeholder={macroKcal > 0 ? String(macroKcal) : ''}
            />
          </Field>
          <Field label="Protein">
            <NumberField value={protein} onValueChange={setProtein} decimals={1} suffix="g" />
          </Field>
          <Field label="Carbs">
            <NumberField value={carbs} onValueChange={setCarbs} decimals={1} suffix="g" />
          </Field>
          <Field label="Fat">
            <NumberField value={fat} onValueChange={setFat} decimals={1} suffix="g" />
          </Field>
        </div>
        {calories == null && macroKcal > 0 && (
          <p className="mt-1.5 text-footnote text-ink-2">Calories worked out from the macros (4/4/9 kcal per gram).</p>
        )}
      </div>

      <MealPicker value={meal} onChange={setMeal} />

      <p className="rounded-xl bg-fill px-3 py-2.5 text-subhead tabular-nums" aria-live="polite">
        <span className="font-semibold">{fmtNum(totals.calories)} kcal</span>
        <span className="text-ink-2"> · {macroLine(totals)}</span>
      </p>

      {!entry && (
        <label className="flex items-center gap-3 text-subhead">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-5 accent-[var(--accent-ink)]"
          />
          Save to My foods
        </label>
      )}

      <Button type="submit" variant="primary" size="lg" full>
        {entry ? 'Save changes' : 'Add food'}
      </Button>
      {entry && (
        <Button variant="danger-ghost" full onClick={() => void remove()}>
          <Trash />
          Remove from log
        </Button>
      )}
    </form>
  )
}
