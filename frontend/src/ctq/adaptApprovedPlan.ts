import type { ActivePlanResponse, ApprovedMonitoringVersion } from '../api/hooks'

export interface EffectiveThreshold {
  id: string
  labelKey: string
  warningThreshold: number
  actionThreshold: number
  unit: string | null
  appliesToSdPreset: boolean
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
      unit: item.unit ?? null,
      appliesToSdPreset: item.unit === 'SD',
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
  defaults: T[] = [],
): Array<T & { presetFromPlan: boolean }> {
  const sdRows = adaptApprovedPlan(active).filter((row) => row.unit === 'SD')
  const list = [...categories]
  for (const row of sdRows) {
    if (!list.some((category) => category.id === row.id)) {
      const fallback = defaults.find((category) => category.id === row.id)
      if (fallback) list.push(fallback)
    }
  }
  return list.map((category) => {
    const row = sdRows.find((item) => item.id === category.id)
    if (!row) return { ...category, presetFromPlan: false }
    return {
      ...category,
      warningThreshold: row.warningThreshold,
      actionThreshold: row.actionThreshold,
      presetFromPlan: true,
    }
  })
}
