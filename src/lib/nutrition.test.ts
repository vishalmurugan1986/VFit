import { describe, expect, it } from 'vitest'
import { averagePerDay, caloriesFromMacros, entryTotals, macroLine, mealName, sumNutrients, totalsByDay } from './nutrition'

describe('nutrition maths', () => {
  it('multiplies per-serving values by servings', () => {
    expect(entryTotals({ calories: 100, protein: 10, carbs: 5, fat: 2, servings: 1.5 })).toEqual({
      calories: 150,
      protein: 15,
      carbs: 7.5,
      fat: 3,
    })
  })

  it('sums nutrients', () => {
    expect(
      sumNutrients([
        { calories: 100, protein: 10, carbs: 5, fat: 2 },
        { calories: 250, protein: 20, carbs: 30, fat: 5 },
      ]),
    ).toEqual({ calories: 350, protein: 30, carbs: 35, fat: 7 })
  })

  it('works out calories from macros (4/4/9 kcal per gram)', () => {
    expect(caloriesFromMacros(30, 40, 10)).toBe(370)
  })

  it('writes a compact macro line', () => {
    expect(macroLine({ protein: 30, carbs: 8, fat: 3 })).toBe('P 30 · C 8 · F 3')
  })

  it('names meals from your list, "Other" for removed ones', () => {
    const meals = [
      { id: 'breakfast', name: 'Meal 1' },
      { id: 'x', name: 'Post-workout' },
    ]
    expect(mealName(meals, 'breakfast')).toBe('Meal 1')
    expect(mealName(meals, 'x')).toBe('Post-workout')
    expect(mealName(meals, 'gone')).toBe('Other')
  })
})

describe('averagePerDay', () => {
  it('averages only days with food logged', () => {
    const e = (date: string, calories: number) =>
      ({ id: date + calories, date, meal: 'breakfast', name: 'x', servings: 1, calories, protein: 10, carbs: 0, fat: 0, createdAt: 0 })
    const byDay = totalsByDay([e('2026-11-01', 1000), e('2026-11-01', 1000), e('2026-11-03', 3000), e('2026-12-01', 500)])
    const { avg, days } = averagePerDay(byDay, '2026-11-01', '2026-11-30')
    expect(days).toBe(2)
    expect(avg.calories).toBe(2500)
    expect(avg.protein).toBe(15)
    expect(averagePerDay(byDay, '2025-01-01', '2025-01-31').days).toBe(0)
  })
})
