import { SYNTHETIC_OVERDUE_CONSENT } from './syntheticOverdueConsent'

export const PERCENT_UNIT = '百分比'
export const OVERDUE_CONSENT_CANDIDATE = SYNTHETIC_OVERDUE_CONSENT.candidateId

export type PercentLevel = 'normal' | 'warning' | 'action'

export type PercentJudgeFailure =
  | 'MISSING_VALUE'
  | 'INVALID_VALUE'
  | 'MISSING_RULE'
  | 'WRONG_UNIT'
  | 'INVALID_BOUNDS'

export type PercentJudgeResult =
  | { ok: true; level: PercentLevel; unit: typeof PERCENT_UNIT; candidateId: typeof OVERDUE_CONSENT_CANDIDATE }
  | { ok: false; code: PercentJudgeFailure }

export interface PercentRuleInput {
  candidateId: string | null
  unit: string | null
  warningThreshold: number
  actionThreshold: number
}

function finiteNumber(value: number): boolean {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Judge only the synthetic overdue-consent rate. Never treat the bounds as SD. */
export function judgeOverdueConsentRate(
  value: number | null | undefined,
  rule: PercentRuleInput | null | undefined,
): PercentJudgeResult {
  if (value === null || value === undefined) return { ok: false, code: 'MISSING_VALUE' }
  if (!finiteNumber(value) || value < 0) return { ok: false, code: 'INVALID_VALUE' }
  if (!rule || rule.candidateId !== OVERDUE_CONSENT_CANDIDATE) return { ok: false, code: 'MISSING_RULE' }
  if (rule.unit !== PERCENT_UNIT) return { ok: false, code: 'WRONG_UNIT' }
  if (!finiteNumber(rule.warningThreshold) || !finiteNumber(rule.actionThreshold)
    || rule.warningThreshold < 0 || rule.actionThreshold < 0
    || rule.warningThreshold >= rule.actionThreshold) {
    return { ok: false, code: 'INVALID_BOUNDS' }
  }
  if (value >= rule.actionThreshold) {
    return { ok: true, level: 'action', unit: PERCENT_UNIT, candidateId: OVERDUE_CONSENT_CANDIDATE }
  }
  if (value >= rule.warningThreshold) {
    return { ok: true, level: 'warning', unit: PERCENT_UNIT, candidateId: OVERDUE_CONSENT_CANDIDATE }
  }
  return { ok: true, level: 'normal', unit: PERCENT_UNIT, candidateId: OVERDUE_CONSENT_CANDIDATE }
}
