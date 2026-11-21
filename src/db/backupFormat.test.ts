import { describe, expect, it } from 'vitest'
import { backupFileName, backupSummary, parseBackup } from './backupFormat'

const valid = {
  app: 'fitness-pwa',
  version: 1,
  exportedAt: '2026-11-18T10:00:00.000Z',
  data: {
    exercises: [{ id: 'bench-press', name: 'Bench Press' }],
    workouts: [
      {
        id: 'w1',
        exerciseIds: ['stale'],
        exercises: [
          { exerciseId: 'bench-press', sets: [] },
          { exerciseId: 'squat', sets: [] },
          { exerciseId: 'bench-press', sets: [] },
        ],
      },
    ],
    routines: [],
    cardio: [],
    body: [],
    foods: [],
    savedFoods: [],
    meta: [{ key: 'settings', value: {} }],
  },
}

describe('parseBackup', () => {
  it('accepts a valid backup and re-derives the indexed exercise list', () => {
    const b = parseBackup(JSON.stringify(valid))
    expect(b.data.workouts[0].exerciseIds).toEqual(['bench-press', 'squat'])
    expect(backupSummary(b)).toBe('1 workout, 0 cardio sessions, 0 body entries, 0 food entries')
    // Older files have no phases; restore rebuilds one from the settings they carry.
    expect(b.data.phases).toEqual([])
  })

  it('reads phases from current backups', () => {
    const b = parseBackup(
      JSON.stringify({ ...valid, version: 3, data: { ...valid.data, phases: [{ id: 'p1' }, { id: 'p2' }] } }),
    )
    expect(b.data.phases).toHaveLength(2)
    expect(backupSummary(b)).toContain('2 phases')
  })

  it('turns skipped meals from version 4 files into day checks', () => {
    const b = parseBackup(
      JSON.stringify({
        ...valid,
        version: 4,
        data: {
          ...valid.data,
          mealSkips: [
            { id: '2026-11-18|lunch', date: '2026-11-18', meal: 'lunch', createdAt: 1 },
            { id: '2026-11-18|snack', date: '2026-11-18', meal: 'snack', createdAt: 2 },
          ],
        },
      }),
    )
    expect(b.data.dayChecks).toHaveLength(1)
    expect(b.data.dayChecks[0]).toMatchObject({ id: '2026-11-18', meals: { lunch: 'skipped', snack: 'skipped' } })
  })

  it('treats a missing table as empty', () => {
    const data: Record<string, unknown> = { ...valid.data }
    delete data.cardio
    expect(parseBackup(JSON.stringify({ ...valid, data })).data.cardio).toEqual([])
  })

  it.each([
    ['not json at all', 'valid backup'],
    [JSON.stringify({ app: 'something-else' }), "doesn't look like"],
    [JSON.stringify({ ...valid, version: 99 }), 'newer version'],
    [JSON.stringify({ ...valid, data: { ...valid.data, foods: [{ name: 'no id' }] } }), '"foods"'],
    [JSON.stringify({ ...valid, data: { ...valid.data, meta: 'oops' } }), '"meta"'],
  ])('rejects bad input (%#)', (text, message) => {
    expect(() => parseBackup(text)).toThrow(message)
  })
})

describe('backupFileName', () => {
  it('includes the local date', () => {
    expect(backupFileName(new Date(2026, 10, 18, 23, 30))).toBe('vfit-backup-2026-11-18.json')
  })
})
