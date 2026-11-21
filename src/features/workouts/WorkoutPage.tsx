import { useLiveQuery } from 'dexie-react-hooks'
import { useParams, useSearchParams } from 'react-router'
import { NotFound, PageLoading } from '../../components/ui'
import { db } from '../../db/db'
import { WorkoutEditor } from './WorkoutEditor'
import { WorkoutSummary } from './WorkoutSummary'

/** /workouts/:id → live logger while in progress, summary when finished, editor with ?edit=1. */
export default function WorkoutPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const workout = useLiveQuery(async () => (await db.workouts.get(id)) ?? null, [id])

  if (workout === undefined) return <PageLoading />
  if (workout === null) return <NotFound title="Workout not found" back="/workouts" />
  if (workout.finishedAt == null) {
    return <WorkoutEditor key={`${workout.id}-active`} initial={workout} mode="active" />
  }
  if (params.get('edit') === '1') {
    return (
      <WorkoutEditor
        key={`${workout.id}-edit`}
        initial={workout}
        mode="edit"
        onDone={() => setParams({}, { replace: true })}
      />
    )
  }
  return <WorkoutSummary workout={workout} onEdit={() => setParams({ edit: '1' })} />
}
