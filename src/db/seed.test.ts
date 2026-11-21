import { describe, expect, it } from 'vitest'
import { legacyCardioTypes, REMOVED_EXERCISE_IDS, seedCardioTypes, seedExercises } from './seed'

describe('exercise library', () => {
  const list = seedExercises()

  it('has unique ids and names', () => {
    expect(new Set(list.map((e) => e.id)).size).toBe(list.length)
    expect(new Set(list.map((e) => e.name)).size).toBe(list.length)
  })

  it('only has beginner and intermediate exercises', () => {
    expect(list.every((e) => e.level === 'beginner' || e.level === 'intermediate')).toBe(true)
    expect(list.some((e) => REMOVED_EXERCISE_IDS.includes(e.id))).toBe(false)
  })
})

describe('cardio activities', () => {
  it('starts with the common ones, keeping ids from earlier versions', () => {
    expect(seedCardioTypes().map((t) => t.id)).toEqual(['walk', 'run', 'ride', 'swim', 'elliptical'])
  })

  it('brings back retired activities only if they were logged, hidden', () => {
    const legacy = legacyCardioTypes(new Set(['row', 'run']))
    expect(legacy.map((t) => t.id)).toEqual(['row'])
    expect(legacy[0].hidden).toBe(true)
  })
})
