import { ArrowDown, ArrowUp, Plus, Trash } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../../components/toast'
import { Button, IconButton, Sheet, TextInput, TimeField } from '../../components/ui'
import { updateSettings, useSettings } from '../../db/settings'
import type { MealDef } from '../../db/types'
import { uid } from '../../lib/id'
import { isClock } from '../../lib/meals'

/** Add, rename, reorder and remove your meals. */
export function MealsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Your meals">
      <MealsEditor onDone={onClose} />
    </Sheet>
  )
}

function MealsEditor({ onDone }: { onDone: () => void }) {
  const toast = useToast()
  const { meals } = useSettings()
  const [list, setList] = useState<MealDef[]>(meals)

  const patch = (id: string, p: Partial<MealDef>) => setList((l) => l.map((m) => (m.id === id ? { ...m, ...p } : m)))
  const move = (i: number, dir: -1 | 1) =>
    setList((l) => {
      const j = i + dir
      if (j < 0 || j >= l.length) return l
      const next = [...l]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const save = async () => {
    const cleaned = list.map((m, i) => ({
      ...m,
      name: m.name.trim() || `Meal ${i + 1}`,
      time: isClock(m.time) ? m.time : null,
    }))
    if (cleaned.length === 0) {
      toast('Keep at least one meal')
      return
    }
    await updateSettings({ meals: cleaned })
    toast('Meals saved')
    onDone()
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-footnote text-ink-2">
        Name your meals and set when each one starts. The times are used for your meal alarms (Settings → Alarms) and the
        day check. Food already logged under a meal you remove shows under “Other”.
      </p>
      <ul className="flex flex-col gap-2">
        {list.map((m, i) => (
          <li key={m.id} className="flex flex-col gap-2 rounded-xl bg-fill/50 p-2">
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <TextInput
                  value={m.name}
                  aria-label={`Meal ${i + 1} name`}
                  maxLength={30}
                  onChange={(e) => patch(m.id, { name: e.target.value })}
                />
              </div>
              <IconButton size="sm" label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp />
              </IconButton>
              <IconButton size="sm" label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown />
              </IconButton>
              <IconButton
                size="sm"
                label={`Remove ${m.name}`}
                disabled={list.length === 1}
                onClick={() => setList((l) => l.filter((x) => x.id !== m.id))}
              >
                <Trash />
              </IconButton>
            </div>
            <TimeField
              allowEmpty
              label={`${m.name || `Meal ${i + 1}`} time`}
              value={m.time ?? null}
              onChange={(v) => patch(m.id, { time: v })}
            />
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        full
        onClick={() => setList((l) => [...l, { id: uid(), name: `Meal ${l.length + 1}`, time: null }])}
      >
        <Plus />
        Add a meal
      </Button>
      <Button variant="primary" size="lg" full onClick={() => void save()}>
        Save
      </Button>
    </div>
  )
}
