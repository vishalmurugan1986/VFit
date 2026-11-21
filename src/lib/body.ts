/** Body-mass index: kg ÷ m². */
export function bmi(weightKg: number, heightCm: number): number | null {
  if (!(weightKg > 0) || !(heightCm > 0)) return null
  const m = heightCm / 100
  return weightKg / (m * m)
}

/** WHO adult categories. */
export function bmiCategory(value: number): string {
  if (value < 18.5) return 'Underweight'
  if (value < 25) return 'Healthy range'
  if (value < 30) return 'Overweight'
  return 'Obese range'
}
