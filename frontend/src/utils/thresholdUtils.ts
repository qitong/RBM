export interface ThresholdLevels {
  warningThreshold: number
  actionThreshold: number
}

export type OutlierLevel = 'action' | 'warning' | 'normal'

export function checkOutlier(value: number, thresholds: ThresholdLevels): OutlierLevel {
  const absVal = Math.abs(value)
  if (absVal >= thresholds.actionThreshold) return 'action'
  if (absVal >= thresholds.warningThreshold) return 'warning'
  return 'normal'
}
