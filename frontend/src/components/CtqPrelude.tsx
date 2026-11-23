import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { ApiError, apiSendStrict } from '../api/client'
import {
  useActiveMonitoringPlan,
  useCtqVersions,
  type CtqCandidate,
  type CtqDraft,
  type MonitoringMethod,
} from '../api/hooks'
import { SYNTHETIC_MIST_PROTOCOL } from '../ctq/syntheticMistProtocol'

const KIND_LABEL: Record<CtqCandidate['kind'], string> = {
  critical_data: '关键数据',
  ctq: 'CtQ',
  kri: 'KRI',
  qtl: 'QTL',
}

const METHODS: Array<[MonitoringMethod, string]> = [
  ['SDV', 'SDV'],
  ['SDR', 'SDR'],
  ['CENTRAL_REVIEW', '中心化审核'],
  ['SYSTEM_CHECK', '系统核查'],
]

interface DecisionDraft {
  accept: boolean
  warning: string
  action: string
  method: MonitoringMethod
}

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    try {
      const parsed = JSON.parse(error.body) as { code?: string; message?: string }
      if (parsed.code) return `${parsed.code}：${parsed.message ?? ''}`.trim()
    } catch {
      return error.message
    }
    return error.message
  }
  return error instanceof Error ? error.message : '请求失败'
}

function blankDecisions(candidates: CtqCandidate[]): Record<string, DecisionDraft> {
  return Object.fromEntries(candidates.map((candidate) => [candidate.id, {
    accept: false,
    warning: candidate.suggestedWarning == null ? '' : String(candidate.suggestedWarning),
    action: candidate.suggestedAction == null ? '' : String(candidate.suggestedAction),
    method: 'CENTRAL_REVIEW' as MonitoringMethod,
  }]))
}

export default function CtqPrelude() {
  const activeQuery = useActiveMonitoringPlan()
  const versionsQuery = useCtqVersions()
  const queryClient = useQueryClient()
  const [protocolText, setProtocolText] = useState('')
  const [draft, setDraft] = useState<CtqDraft | null>(null)
  const [decisions, setDecisions] = useState<Record<string, DecisionDraft>>({})
  const [operator, setOperator] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionNote, setActionNote] = useState<string | null>(null)

  if (activeQuery.isLoading || versionsQuery.isLoading) {
    return <p className="text-body">正在读取生效监测计划</p>
  }
  if (activeQuery.isError || versionsQuery.isError || !activeQuery.data || !versionsQuery.data) {
    const error = activeQuery.error ?? versionsQuery.error
    return <p className="text-body">生效计划读取失败：{formatApiError(error)}</p>
  }

  const active = activeQuery.data.active
  const versions = versionsQuery.data.versions

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['ctq-active'] })
    await queryClient.invalidateQueries({ queryKey: ['ctq-versions'] })
  }

  async function onExtract() {
    setActionError(null)
    setActionNote(null)
    setDraft(null)
    if (protocolText.trim().length < 40) {
      setActionError('请先粘贴完整的虚构方案文本')
      return
    }
    setBusy(true)
    try {
      const next = await apiSendStrict<CtqDraft>('/api/ctq/extract', {
        method: 'POST',
        body: JSON.stringify({ protocolText }),
      })
      setDraft(next)
      setDecisions(blankDecisions(next.candidates))
      setActionNote('候选已生成，状态为未批准，生效计划没有变化')
    } catch (error) {
      setActionError(`提取失败：${formatApiError(error)}`)
    } finally {
      setBusy(false)
    }
  }

  async function onApprove() {
    if (!draft) return
    setActionError(null)
    setActionNote(null)
    if (!operator.trim()) {
      setActionError('请填写操作者')
      return
    }
    const accepted = draft.candidates.filter((candidate) => decisions[candidate.id]?.accept)
    if (!accepted.some((candidate) => candidate.kind === 'kri' || candidate.kind === 'qtl')) {
      setActionError('至少勾选一条 KRI 或 QTL。未勾选的候选不会生效')
      return
    }
    for (const candidate of accepted) {
      if (candidate.kind !== 'kri' && candidate.kind !== 'qtl') continue
      const decision = decisions[candidate.id]
      const warning = Number(decision.warning)
      const action = Number(decision.action)
      if (decision.warning === '' || decision.action === '' || Number.isNaN(warning) || Number.isNaN(action) || warning >= action) {
        setActionError(`请为 ${candidate.id} 填写小于行动阈值的预警阈值`)
        return
      }
    }
    setBusy(true)
    try {
      const result = await apiSendStrict<{ version: { versionId: string } }>(
        `/api/ctq/drafts/${draft.draftId}/approve`,
        {
          method: 'POST',
          body: JSON.stringify({
            operator: operator.trim(),
            decisions: draft.candidates.map((candidate) => {
              const decision = decisions[candidate.id]
              const numeric = candidate.kind === 'kri' || candidate.kind === 'qtl'
              return {
                candidateId: candidate.id,
                accept: decision.accept,
                monitoringMethod: decision.accept ? decision.method : null,
                warningThreshold: decision.accept && numeric ? Number(decision.warning) : null,
                actionThreshold: decision.accept && numeric ? Number(decision.action) : null,
              }
            }),
          }),
        },
      )
      setDraft(null)
      setActionNote(`已写入版本 ${result.version.versionId}`)
      await refresh()
    } catch (error) {
      setActionError(`批准失败：${formatApiError(error)}`)
    } finally {
      setBusy(false)
    }
  }

  async function onReject() {
    if (!draft) return
    setActionError(null)
    setActionNote(null)
    if (!operator.trim() || !reason.trim()) {
      setActionError('驳回需要操作者和原因')
      return
    }
    setBusy(true)
    try {
      await apiSendStrict(`/api/ctq/drafts/${draft.draftId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ operator: operator.trim(), reason: reason.trim() }),
      })
      setDraft(null)
      setActionNote('草稿已驳回，生效指针未改变')
      await refresh()
    } catch (error) {
      setActionError(`驳回失败：${formatApiError(error)}`)
    } finally {
      setBusy(false)
    }
  }

  async function onRollback() {
    setActionError(null)
    setActionNote(null)
    if (!operator.trim() || !reason.trim()) {
      setActionError('回滚需要操作者和原因')
      return
    }
    setBusy(true)
    try {
      const result = await apiSendStrict<{ activeVersionId: string }>('/api/ctq/active/rollback', {
        method: 'POST',
        body: JSON.stringify({
          operator: operator.trim(),
          reason: reason.trim(),
          studyCode: active?.studyCode ?? null,
        }),
      })
      setActionNote(`已回滚，当前生效 ${result.activeVersionId}`)
      await refresh()
    } catch (error) {
      setActionError(`回滚失败：${formatApiError(error)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-body"><FileText size={18} /></span>
          <h2 className="text-h3">候选与人工批准</h2>
        </div>
        <p className="text-body">
          只接受虚构合成方案。候选保持未批准，直到单独的批准动作写下操作者、时间和来源哈希。
        </p>
        <p className="text-small">{activeQuery.data.disclaimer}</p>
      </section>

      <section className="border rounded-lg p-4 flex flex-col gap-3" style={{ borderColor: 'var(--color-border)' }}>
        <h2 className="text-h3">生效监测计划</h2>
        {active ? (
          <div className="flex flex-col gap-2">
            <p className="text-body">当前版本 {active.versionId} · 批准人 {active.approvedBy} · {active.approvedAt}</p>
            <p className="text-small">来源哈希 {active.sourceHash}</p>
            <p className="text-small">研究 {active.studyCode} {active.studyTitle}</p>
            {active.legacyThresholdMap.map((item) => (
              <p key={item.candidateId} className="text-body">
                映射 {item.rbmCategoryId}：预警 {item.warningThreshold} / 行动 {item.actionThreshold} · {item.monitoringMethod}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-body">尚无已批准监测计划</p>
        )}
        <div className="flex flex-col gap-1">
          <p className="text-small">版本留痕</p>
          {versions.length === 0 ? <p className="text-body">尚无版本记录</p> : versions.map((version) => (
            <p key={version.versionId} className="text-body">{version.versionId} · {version.status}</p>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <label className="flex flex-col gap-2 text-body">
          合成方案文本
          <textarea
            aria-label="合成方案文本"
            className="border rounded-lg p-3 min-h-40 text-body"
            style={{ borderColor: 'var(--color-border)' }}
            value={protocolText}
            onChange={(event) => setProtocolText(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={() => setProtocolText(SYNTHETIC_MIST_PROTOCOL)}>
            填入合成样例
          </button>
          <button type="button" className="btn-primary" disabled={busy} onClick={onExtract}>提取候选</button>
        </div>
      </section>

      {draft && (
        <section className="flex flex-col gap-3">
          <h2 className="text-h3">草稿 {draft.draftId} · 未批准</h2>
          <p className="text-small">来源哈希 {draft.sourceHash}</p>
          {draft.candidates.map((candidate) => {
            const decision = decisions[candidate.id]
            const numeric = candidate.kind === 'kri' || candidate.kind === 'qtl'
            return (
              <article key={candidate.id} className="border rounded-lg p-4 flex flex-col gap-2" style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-body">{KIND_LABEL[candidate.kind]} {candidate.id} · {candidate.title} · 未批准</p>
                <p className="text-small">第 {candidate.line} 行：{candidate.quote}</p>
                {candidate.rbmCategoryId && <p className="text-small">对应现有类别 {candidate.rbmCategoryId}</p>}
                <label className="text-body flex items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`接受 ${candidate.id}`}
                    checked={decision.accept}
                    onChange={(event) => setDecisions((prev) => ({
                      ...prev,
                      [candidate.id]: { ...decision, accept: event.target.checked },
                    }))}
                  />
                  纳入本版
                </label>
                {numeric && (
                  <div className="flex flex-wrap gap-3">
                    <label className="text-small flex flex-col gap-1">
                      预警阈值
                      <input
                        aria-label={`${candidate.id} 预警阈值`}
                        className="border rounded px-2 py-1 text-body"
                        value={decision.warning}
                        onChange={(event) => setDecisions((prev) => ({
                          ...prev,
                          [candidate.id]: { ...decision, warning: event.target.value },
                        }))}
                      />
                    </label>
                    <label className="text-small flex flex-col gap-1">
                      行动阈值
                      <input
                        aria-label={`${candidate.id} 行动阈值`}
                        className="border rounded px-2 py-1 text-body"
                        value={decision.action}
                        onChange={(event) => setDecisions((prev) => ({
                          ...prev,
                          [candidate.id]: { ...decision, action: event.target.value },
                        }))}
                      />
                    </label>
                    <label className="text-small flex flex-col gap-1">
                      监测方式
                      <select
                        aria-label={`${candidate.id} 监测方式`}
                        className="border rounded px-2 py-1 text-body"
                        value={decision.method}
                        onChange={(event) => setDecisions((prev) => ({
                          ...prev,
                          [candidate.id]: { ...decision, method: event.target.value as MonitoringMethod },
                        }))}
                      >
                        {METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                  </div>
                )}
              </article>
            )
          })}
        </section>
      )}

      <section className="flex flex-wrap gap-3 items-end">
        <label className="text-small flex flex-col gap-1">
          操作者
          <input aria-label="操作者" className="border rounded px-2 py-1 text-body" value={operator} onChange={(event) => setOperator(event.target.value)} />
        </label>
        <label className="text-small flex flex-col gap-1">
          原因
          <input aria-label="原因" className="border rounded px-2 py-1 text-body" value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <button type="button" className="btn-primary" disabled={busy || !draft} onClick={onApprove}>批准所选</button>
        <button type="button" className="btn-secondary" disabled={busy || !draft} onClick={onReject}>驳回此草稿</button>
        <button type="button" className="btn-secondary" disabled={busy || !active} onClick={onRollback}>回滚到上一已批准版本</button>
      </section>

      {actionError && <p className="text-body" role="alert">{actionError}</p>}
      {actionNote && <p className="text-body" role="status">{actionNote}</p>}
    </div>
  )
}
