import { describe, expect, it } from 'vitest'
import { judgeOverdueConsentRate } from '../ctq/judgeOverdueConsent'

const study = 'SYN-FICTION-MIST-001'
const rule = {
  candidateId: 'KRI-01',
  unit: '百分比',
  warningThreshold: 4,
  actionThreshold: 9,
}

describe('judgeOverdueConsentRate', () => {
  it('treats the warning and action bounds as inclusive percentages', () => {
    expect(judgeOverdueConsentRate(3.9, rule, study)).toMatchObject({ ok: true, level: 'normal', unit: '百分比' })
    expect(judgeOverdueConsentRate(4, rule, study)).toMatchObject({ ok: true, level: 'warning' })
    expect(judgeOverdueConsentRate(8.9, rule, study)).toMatchObject({ ok: true, level: 'warning' })
    expect(judgeOverdueConsentRate(9, rule, study)).toMatchObject({ ok: true, level: 'action' })
    expect(judgeOverdueConsentRate(12, rule, study)).toMatchObject({ ok: true, level: 'action' })
  })

  it('fails closed instead of borrowing an SD scale or a static stand-in', () => {
    expect(judgeOverdueConsentRate(null, rule, study).ok).toBe(false)
    expect(judgeOverdueConsentRate(undefined, rule, study)).toMatchObject({ code: 'MISSING_VALUE' })
    expect(judgeOverdueConsentRate(Number.NaN, rule, study)).toMatchObject({ code: 'INVALID_VALUE' })
    expect(judgeOverdueConsentRate(-4, rule, study)).toMatchObject({ code: 'INVALID_VALUE' })
    expect(judgeOverdueConsentRate(9, null, study)).toMatchObject({ code: 'MISSING_RULE' })
    expect(judgeOverdueConsentRate(9, rule, null)).toMatchObject({ code: 'MISSING_RULE' })
    expect(judgeOverdueConsentRate(9, rule, 'SYN-OTHER')).toMatchObject({ code: 'WRONG_STUDY' })
    expect(judgeOverdueConsentRate(9, { ...rule, unit: 'SD' }, study)).toMatchObject({ code: 'WRONG_UNIT' })
    expect(judgeOverdueConsentRate(9, { ...rule, candidateId: 'QTL-01' }, study)).toMatchObject({ code: 'MISSING_RULE' })
    expect(judgeOverdueConsentRate(9, { ...rule, warningThreshold: 9, actionThreshold: 4 }, study)).toMatchObject({ code: 'INVALID_BOUNDS' })
  })
})
