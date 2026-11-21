import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, Card, Chip, EmptyState, PageHeader, SectionHeader, Sheet, TextInput } from '../../components/ui'
import { db } from '../../db/db'
import { useExercises } from '../../db/queries'
import { exerciseMeta, MUSCLES, type Exercise, type Muscle } from '../../db/types'
import { ExerciseForm } from './ExercisePicker'

export default function ExercisesPage() {
  const navigate = useNavigate()
  const { list } = useExercises()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<Muscle | 'all'>('all')
  const [creating, setCreating] = useState(false)

  const counts = useLiveQuery(async () => {
    const c = new Map<string, number>()
    await db.workouts.each((w) => {
      if (w.finishedAt != null) for (const id of w.exerciseIds) c.set(id, (c.get(id) ?? 0) + 1)
    })
    return c
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = list.filter(
    (e) => (muscle === 'all' || e.muscle === muscle) && (!q || e.name.toLowerCase().includes(q)),
  )
  const active = filtered.filter((e) => !e.archived)
  const archived = filtered.filter((e) => e.archived)

  return (
    <>
      <PageHeader
        back="/workouts"
        title="Exercises"
        subtitle={`${list.filter((e) => !e.archived).length} in your library`}
        actions={
          <Button size="sm" variant="primary" onClick={() => setCreating(true)}>
            <Plus />
            New
          </Button>
        }
      />

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
      <div className="no-scrollbar -mx-4 mt-2 mb-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
        {[{ key: 'all' as const, label: 'All' }, ...MUSCLES].map((m) => (
          <Chip key={m.key} selected={muscle === m.key} onClick={() => setMuscle(m.key)}>
            {m.label}
          </Chip>
        ))}
      </div>

      {active.length === 0 ? (
        <EmptyState
          title="No exercises found"
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus />
              Create exercise
            </Button>
          }
        >
          Try another search, or create it.
        </EmptyState>
      ) : (
        <ExerciseList items={active} counts={counts} />
      )}

      {archived.length > 0 && (
        <>
          <SectionHeader title="Archived" />
          <ExerciseList items={archived} counts={counts} />
        </>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title="New exercise">
        <ExerciseForm
          initialName={query.trim()}
          onCancel={() => setCreating(false)}
          onSaved={(ex) => {
            setCreating(false)
            navigate(`/exercises/${ex.id}`)
          }}
        />
      </Sheet>
    </>
  )
}

function ExerciseList({ items, counts }: { items: Exercise[]; counts?: Map<string, number> }) {
  return (
    <Card padded={false}>
      <ul className="divide-y-[0.5px] divide-bar-line">
        {items.map((e) => {
          const n = counts?.get(e.id) ?? 0
          return (
            <li key={e.id}>
              <Link to={`/exercises/${e.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-fill/60 active:bg-fill">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {e.name}
                    {e.custom && (
                      <span className="ml-2 rounded bg-fill px-1.5 py-0.5 align-middle text-caption2 font-medium text-ink-2">
                        Custom
                      </span>
                    )}
                  </p>
                  <p className="truncate text-footnote text-ink-2">
                    {exerciseMeta(e)}
                  </p>
                </div>
                {n > 0 && (
                  <span className="shrink-0 text-footnote text-ink-2 tabular-nums">
                    {n} {n === 1 ? 'session' : 'sessions'}
                  </span>
                )}
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
