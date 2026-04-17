import { describe, it, expect } from 'vitest'
import { mean, stddev, zScore, percentile } from '../utils/benchmarkUtils'

describe('benchmarkUtils', () => {
  it('mean of [1,2,3] is 2', () => expect(mean([1, 2, 3])).toBe(2))
  it('mean of [] is 0', () => expect(mean([])).toBe(0))

  it('stddev of [2,2,2] is 0', () => expect(stddev([2, 2, 2])).toBe(0))
  it('stddev of [1,2,3] is ~0.816 (population)', () => expect(stddev([1, 2, 3])).toBeCloseTo(0.8165, 3))

  it('zScore is 0 when value equals mean', () => expect(zScore(5, [3, 5, 7])).toBe(0))
  it('zScore returns 0 when stddev is 0', () => expect(zScore(5, [5, 5, 5])).toBe(0))

  it('percentile finds median', () => expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3))
  it('percentile clamps to bounds', () => {
    expect(percentile([1, 2, 3], 0)).toBe(1)
    expect(percentile([1, 2, 3], 100)).toBe(3)
  })
})
