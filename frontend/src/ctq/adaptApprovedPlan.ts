import type { ActivePlanResponse, ApprovedMonitoringVersion } from '../api/hooks'

export interface EffectiveThreshold {
  id: string
  labelKey: string
  warningThreshold: number
  actionThreshold: number
  monitoringMethod: string | null
  candidateId: string | null
  versionId: string | null
  approvedBy: string | null
  readEntry: 'ThresholdConfig'
  effective: true
}

/** Same contract as the backend adapter: only an approved plan yields rows. */
export function adaptApprovedPlan(active: ApprovedMonitoringVersion | null | undefined): EffectiveThreshold[] {
  if (!active || active.approvalStatus !== 'approved' || active.status !== 'approved') return []
  return active.legacyThresholdMap
    .filter((item) => item.source === 'approved_kri' && item.rbmCategoryId)
    .map((item) => ({
      id: item.rbmCategoryId,
      labelKey: item.rbmCategoryId,
      warningThreshold: item.warningThreshold,
      actionThreshold: item.actionThreshold,
      monitoringMethod: item.monitoringMethod,
      candidateId: item.candidateId,
      versionId: active.versionId,
      approvedBy: active.approvedBy,
      readEntry: 'ThresholdConfig' as const,
      effective: true as const,
    }))
}

export function thresholdsForReadEntry(body: ActivePlanResponse | undefined): EffectiveThreshold[] {
  if (!body) return []
  return adaptApprovedPlan(body.active)
}

export function applyApprovedPresets<T extends { id: string; warningThreshold: number; actionThreshold: number }>(
  categories: T[],
  active: ApprovedMonitoringVersion | null | undefined,
): Array<T & { presetFromPlan: boolean }> {
  const locked = new Map(adaptApprovedPlan(active).map((row) => [row.id, row]))
  return categories.map((category) => {
    const row = locked.get(category.id)
    if (!row) return { ...category, presetFromPlan: false }
    return {
      ...category,
      warningThreshold: row.warningThreshold,
      actionThreshold: row.actionThreshold,
      presetFromPlan: true,
    }
  })
}
