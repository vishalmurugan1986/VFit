/*
 * Everything is stored metric (kg, km, cm) and converted only for display and input,
 * so switching units never rewrites data.
 */
export type WeightUnit = 'kg' | 'lb'
export type DistanceUnit = 'km' | 'mi'
export type LengthUnit = 'cm' | 'in'

export const KG_PER_LB = 0.45359237
export const KM_PER_MI = 1.609344
export const CM_PER_IN = 2.54

export const kgTo = (kg: number, u: WeightUnit) => (u === 'kg' ? kg : kg / KG_PER_LB)
export const toKg = (v: number, u: WeightUnit) => (u === 'kg' ? v : v * KG_PER_LB)
export const kmTo = (km: number, u: DistanceUnit) => (u === 'km' ? km : km / KM_PER_MI)
export const toKm = (v: number, u: DistanceUnit) => (u === 'km' ? v : v * KM_PER_MI)
export const cmTo = (cm: number, u: LengthUnit) => (u === 'cm' ? cm : cm / CM_PER_IN)
export const toCm = (v: number, u: LengthUnit) => (u === 'cm' ? v : v * CM_PER_IN)

export function round(n: number, decimals = 0): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

const nfCache = new Map<string, Intl.NumberFormat>()
/** Locale-aware number with grouping, e.g. 12,345.5 */
export function fmtNum(n: number, maxFrac = 0, minFrac = 0): string {
  const key = `${maxFrac}|${minFrac}`
  let f = nfCache.get(key)
  if (!f) {
    f = new Intl.NumberFormat(undefined, { maximumFractionDigits: maxFrac, minimumFractionDigits: minFrac })
    nfCache.set(key, f)
  }
  return f.format(n)
}

let compactNf: Intl.NumberFormat | undefined
/** 12900 → "12.9K" */
export function fmtCompact(n: number): string {
  compactNf ??= new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
  return compactNf.format(n)
}

export const fmtWeight = (kg: number, u: WeightUnit) => `${fmtNum(kgTo(kg, u), 1)} ${u}`
export const fmtDistance = (km: number, u: DistanceUnit, maxFrac = 2) => `${fmtNum(kmTo(km, u), maxFrac)} ${u}`
export const fmtLength = (cm: number, u: LengthUnit) => `${fmtNum(cmTo(cm, u), 1)} ${u}`

/** Volume in the user's unit, compact once it gets large: "8,420 kg", "126.3K lb". */
export function fmtVolume(kg: number, u: WeightUnit): string {
  const v = kgTo(kg, u)
  return `${v >= 100_000 ? fmtCompact(v) : fmtNum(v)} ${u}`
}

/** Text for an editable field: no grouping, '.' decimal point. */
export function inputText(n: number | null | undefined, decimals = 2): string {
  return n == null || !Number.isFinite(n) ? '' : String(round(n, decimals))
}

/**
 * Lenient parse of a typed number. Accepts "62.5", "62,5" (decimal comma),
 * "1,200" / "1 200" (thousands). Returns null for empty or invalid input.
 */
export function parseNum(text: string): number | null {
  let t = text.trim().replace(/\s+/g, '')
  if (!t) return null
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '')
  else t = t.replace(',', '.')
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
