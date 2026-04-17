import { describe, it, expect } from 'vitest'
import { checkOutlier } from '../utils/thresholdUtils'

describe('checkOutlier', () => {
  const defaults = { warningThreshold: 2.0, actionThreshold: 3.0 }

  it('returns normal when absolute value is below warning threshold', () => {
    expect(checkOutlier(1.5, defaults)).toBe('normal')
  })

  it('returns normal for negative values below warning threshold', () => {
    expect(checkOutlier(-1.5, defaults)).toBe('normal')
  })

  it('returns warning when absolute value equals warning threshold', () => {
    expect(checkOutlier(2.0, defaults)).toBe('warning')
  })

  it('returns warning when absolute value is between warning and action thresholds', () => {
    expect(checkOutlier(2.5, defaults)).toBe('warning')
  })

  it('returns action when absolute value equals action threshold', () => {
    expect(checkOutlier(3.0, defaults)).toBe('action')
  })

  it('returns action when absolute value exceeds action threshold', () => {
    expect(checkOutlier(4.2, defaults)).toBe('action')
  })

  it('handles negative values symmetrically (bidirectional)', () => {
    expect(checkOutlier(-3.5, defaults)).toBe('action')
    expect(checkOutlier(-2.2, defaults)).toBe('warning')
  })

  it('uses provided thresholds instead of defaults', () => {
    expect(checkOutlier(1.5, { warningThreshold: 1.0, actionThreshold: 2.0 })).toBe('warning')
  })
})
