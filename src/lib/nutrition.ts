import type { FoodEntry, Meal, MealDef, Nutrients } from '../db/types'
import { fmtNum } from './units'

/** A meal's name from your list; food under a meal you've since removed shows as "Other". */
export const mealName = (meals: MealDef[], id: Meal) => meals.find((m) => m.id === id)?.name ?? 'Other'

export const ZERO_NUTRIENTS: Nutrients = { calories: 0, protein: 0, carbs: 0, fat: 0 }

/** Per-serving values × servings. */
export function entryTotals(e: Pick<FoodEntry, 'calories' | 'protein' | 'carbs' | 'fat' | 'servings'>): Nutrients {
  const k = e.servings > 0 ? e.servings : 0
  return {
    calories: e.calories * k,
    protein: e.protein * k,
    carbs: e.carbs * k,
    fat: e.fat * k,
  }
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce<Nutrients>(
    (t, m) => ({
      calories: t.calories + m.calories,
      protein: t.protein + m.protein,
      carbs: t.carbs + m.carbs,
      fat: t.fat + m.fat,
    }),
    { ...ZERO_NUTRIENTS },
  )
}

/** "P 30 · C 8 · F 3" (grams). */
export function macroLine(v: { protein: number; carbs: number; fat: number }): string {
  return `P ${fmtNum(v.protein)} · C ${fmtNum(v.carbs)} · F ${fmtNum(v.fat)}`
}

/** Atwater factors: 4 kcal/g protein and carbs, 9 kcal/g fat. */
export function caloriesFromMacros(protein: number, carbs: number, fat: number): number {
  return 4 * protein + 4 * carbs + 9 * fat
}


/** Total eaten per day. */
export function totalsByDay(entries: FoodEntry[]): Map<string, Nutrients> {
  const out = new Map<string, Nutrients>()
  for (const e of entries) out.set(e.date, sumNutrients([out.get(e.date) ?? ZERO_NUTRIENTS, entryTotals(e)]))
  return out
}

/** Average per logged day (days with any calories) between two dates, inclusive. */
export function averagePerDay(byDay: Map<string, Nutrients>, from: string, to: string): { avg: Nutrients; days: number } {
  const logged = [...byDay].filter(([d, t]) => d >= from && d <= to && t.calories > 0).map(([, t]) => t)
  const sum = sumNutrients(logged)
  const n = logged.length
  if (!n) return { avg: { ...ZERO_NUTRIENTS }, days: 0 }
  return {
    avg: { calories: sum.calories / n, protein: sum.protein / n, carbs: sum.carbs / n, fat: sum.fat / n },
    days: n,
  }
}
