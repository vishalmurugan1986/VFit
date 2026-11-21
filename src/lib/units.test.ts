import { describe, expect, it } from 'vitest'
import { cmTo, inputText, kgTo, kmTo, parseNum, toCm, toKg, toKm } from './units'

describe('unit conversion', () => {
  it('converts kg and lb both ways without drift', () => {
    expect(kgTo(100, 'lb')).toBeCloseTo(220.462, 3)
    expect(toKg(135, 'lb')).toBeCloseTo(61.235, 3)
    expect(kgTo(toKg(135, 'lb'), 'lb')).toBeCloseTo(135, 9)
    expect(kgTo(80, 'kg')).toBe(80)
  })

  it('converts distance and length', () => {
    expect(kmTo(10, 'mi')).toBeCloseTo(6.2137, 4)
    expect(toKm(26.2, 'mi')).toBeCloseTo(42.165, 3)
    expect(cmTo(2.54, 'in')).toBeCloseTo(1, 9)
    expect(toCm(32, 'in')).toBeCloseTo(81.28, 9)
  })
})

describe('parseNum', () => {
  it.each([
    ['62.5', 62.5],
    ['62,5', 62.5],
    ['1,200', 1200],
    ['1 200', 1200],
    [' 80 ', 80],
    ['.5', 0.5],
    ['62.', 62],
    ['-3', -3],
  ])('parses %j', (text, expected) => {
    expect(parseNum(text)).toBe(expected)
  })

  it.each(['', '   ', 'abc', '1.2.3', '12kg'])('rejects %j', (text) => {
    expect(parseNum(text)).toBeNull()
  })
})

describe('inputText', () => {
  it('formats for editing: no grouping, no float noise', () => {
    expect(inputText(1234.5)).toBe('1234.5')
    expect(inputText(kgTo(toKg(135, 'lb'), 'lb'))).toBe('135')
    expect(inputText(2.36, 1)).toBe('2.4')
    expect(inputText(null)).toBe('')
  })
})
