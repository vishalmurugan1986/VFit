import { describe, expect, it } from 'vitest'
import { bmi, bmiCategory } from './body'

describe('bmi', () => {
  it('divides weight by height squared', () => {
    expect(bmi(72, 180)).toBeCloseTo(22.22, 2)
    expect(bmi(0, 180)).toBeNull()
    expect(bmi(72, 0)).toBeNull()
  })

  it('names the WHO category', () => {
    expect(bmiCategory(17.9)).toBe('Underweight')
    expect(bmiCategory(18.5)).toBe('Healthy range')
    expect(bmiCategory(24.9)).toBe('Healthy range')
    expect(bmiCategory(25)).toBe('Overweight')
    expect(bmiCategory(31)).toBe('Obese range')
  })
})
