import { useActiveMonitoringPlan } from '../api/hooks'
import { thresholdsForReadEntry } from '../ctq/adaptApprovedPlan'
import { judgeOverdueConsentRate, type PercentJudgeFailure } from '../ctq/judgeOverdueConsent'
import { SYNTHETIC_OVERDUE_CONSENT } from '../ctq/syntheticOverdueConsent'

const FAILURE_TEXT: Record<PercentJudgeFailure, string> = {
  MISSING_VALUE: '无法判断。这条合成指标没有数值，没有改用静态 JSON。',
  INVALID_VALUE: '无法判断。数值不是大于等于 0 的百分比，没有改用标准差。',
  MISSING_RULE: '无法判断。已批准计划里没有这条百分比规则。',
  WRONG_STUDY: '无法判断。已批准计划不是虚构研究 SYN-FICTION-MIST-001。',
  WRONG_UNIT: '无法判断。这条规则的单位不是百分比，没有把它当成标准差。',
  INVALID_BOUNDS: '无法判断。预警界限必须小于行动界限。',
}

const LEVEL_TEXT = { normal: '正常', warning: '预警', action: '行动' } as const

export default function OverdueConsentJudgment() {
  const plan = useActiveMonitoringPlan()
  const rule = thresholdsForReadEntry(plan.data).find(
    (row) => row.candidateId === SYNTHETIC_OVERDUE_CONSENT.candidateId,
  ) ?? null
  const judgment = plan.isSuccess
    ? judgeOverdueConsentRate(SYNTHETIC_OVERDUE_CONSENT.value, rule, plan.data?.active?.studyCode)
    : null

  return (
    <section aria-label="合成逾期签署比例" className="bg-surface-container-high rounded-xl p-6 border border-outline-variant/50 relative z-10" data-percent-judgment="true">
      <h2 className="text-xl font-bold text-on-surface mb-2">合成逾期签署比例</h2>
      <p className="text-sm text-on-surface-variant mb-3">
        只判断候选 {SYNTHETIC_OVERDUE_CONSENT.candidateId}。单位是百分比。界限来自已批准的 CtQ 计划，不读取下面的 RBQM 阈值版本，也不写入 SD 滑块。数值是合成夹具，不是受试者统计。
      </p>
      <p className="text-sm text-on-surface">
        {SYNTHETIC_OVERDUE_CONSENT.studyCode} · {SYNTHETIC_OVERDUE_CONSENT.label} · 合成值 {SYNTHETIC_OVERDUE_CONSENT.value}，单位{SYNTHETIC_OVERDUE_CONSENT.unit}
      </p>
      {plan.isLoading && <p className="text-sm text-on-surface mt-3">正在读取已批准计划</p>}
      {plan.isError && (
        <p role="alert" className="text-sm text-on-surface mt-3" data-judgment="failed">
          无法判断。监测计划没有读到，没有改用静态 JSON。
        </p>
      )}
      {judgment && !judgment.ok && (
        <p role="alert" className="text-sm text-on-surface mt-3" data-judgment="failed" data-failure={judgment.code}>
          {FAILURE_TEXT[judgment.code]}
        </p>
      )}
      {judgment?.ok && (
        <p className="text-sm text-on-surface mt-3" data-judgment={judgment.level} data-unit={judgment.unit}>
          判断：{LEVEL_TEXT[judgment.level]}。已批准预警 {rule?.warningThreshold}{judgment.unit}，行动 {rule?.actionThreshold}{judgment.unit}。等于预警界限算预警，等于行动界限算行动。
        </p>
      )}
    </section>
  )
}
