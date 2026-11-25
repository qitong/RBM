import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { postRiskTransition, useRbqmRisks, type RbqmRisk } from '../api/hooks'
import { useThresholds } from '../context/ThresholdContext'
import SyntheticNote from '../rbqm/SyntheticNote'

const OPERATOR = '中央监查员-合成'

function readError(error: unknown): string {
  if (error instanceof ApiError) {
    try {
      const parsed = JSON.parse(error.body) as { code?: string; message?: string; missing?: string[] }
      const missing = parsed.missing?.length ? `（${parsed.missing.join('、')}）` : ''
      if (parsed.message) return `${parsed.code ?? 'ERROR'}：${parsed.message}${missing}`
    } catch {
      return error.message
    }
    return error.message
  }
  return error instanceof Error ? error.message : '请求失败'
}

function columnOf(status: string): 'open' | 'active' | 'closed' {
  if (status === 'Closed') return 'closed'
  if (status === 'Detected') return 'open'
  return 'active'
}

function scopeLabel(scope: string): string {
  return scope === 'study_qtl' ? '研究级 QTL' : '中心级 KRI'
}

function BoundThresholdReadout({ risk }: { risk: RbqmRisk }) {
  const bound = risk.boundThreshold
  if (!bound?.traceable) {
    return <p className="text-small mb-2" data-bound-threshold={risk.id}>无法溯源</p>
  }
  return (
    <p className="text-small mb-2" data-bound-threshold={risk.id}>
      已绑定历史阈值 {bound.configVersion} · 单位 {bound.unit} · 预警 {bound.warningThreshold} · 行动 {bound.actionThreshold}
    </p>
  )
}

export default function AlertTracking() {
  const { checkOutlier } = useThresholds()
  const query = useRbqmRisks()
  const client = useQueryClient()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [rootCause, setRootCause] = useState('')
  const [assignee, setAssignee] = useState('合成CRA-甲')
  const [dueDate, setDueDate] = useState('2026-12-15')
  const [actionSummary, setActionSummary] = useState('合成中心复训并复核记录。')
  const [effectivenessNote, setEffectivenessNote] = useState('')
  const [formError, setFormError] = useState('')

  if (query.isLoading) return <div className="text-slate-500">加载中…</div>
  if (query.isError || !query.data) return <div className="text-red-600">无法加载风险信号。接口失败，未改读静态 JSON。</div>

  const risks = query.data.map((risk) => {
    const severity = risk.unit === 'SD'
      ? (checkOutlier(risk.metricValue, risk.dimension) === 'action' ? 'Red' : 'Yellow')
      : (risk.level === 'action' ? 'Red' : 'Yellow')
    return { ...risk, severity }
  })
  const active = risks.find((risk) => risk.id === activeId) ?? null

  async function submit(risk: RbqmRisk, toStatus: string, fields: Record<string, string>) {
    setFormError('')
    try {
      await postRiskTransition(risk.id, {
        toStatus,
        operator: OPERATOR,
        operatorRole: 'central_monitor',
        ...fields,
      })
      setActiveId(null)
      await client.invalidateQueries({ queryKey: ['rbqm-risks'] })
    } catch (error) {
      setFormError(readError(error))
    }
  }

  function renderCard(risk: (typeof risks)[number]) {
    return (
      <article key={risk.id} data-alert-id={risk.id} data-severity={risk.severity} className="card-minimal border-l-4 mb-4">
        <div className="flex gap-2 mb-3">
          <span className="badge badge-neutral">{risk.id}</span>
          <span className="badge badge-neutral">{scopeLabel(risk.scope)}</span>
          <span className="badge badge-neutral">{risk.status}</span>
        </div>
        <h3 className="text-h3 mb-2">{risk.title}</h3>
        <p className="text-small mb-2">{risk.siteId ?? risk.studyId}</p>
        <BoundThresholdReadout risk={risk} />
        <p className="text-small mb-4">
          指标 {risk.metricValue} {risk.unit}
        </p>
        {risk.rootCause && <p className="text-small mb-3">人工根因：{risk.rootCause}</p>}
        <button type="button" className="btn-primary" onClick={() => { setActiveId(risk.id); setFormError('') }}>
          填写人工研判
        </button>
      </article>
    )
  }

  return (
    <div>
      <header className="mb-8">
        <h2 className="text-h1 mb-4">预警跟踪与闭环管理</h2>
        <SyntheticNote />
        <p className="text-large leading-relaxed mt-3">
          合成信号按状态机推进。根因、责任人和有效性复核都由人填写；缺任何一项时不能关闭。
        </p>
      </header>

      <div className="grid-cards grid-cols-1 xl:grid-cols-3">
        <section className="card">
          <h3 className="text-h3 mb-4">待评估</h3>
          {risks.filter((risk) => columnOf(risk.status) === 'open').map(renderCard)}
        </section>
        <section className="card">
          <h3 className="text-h3 mb-4">CAPA执行</h3>
          {risks.filter((risk) => columnOf(risk.status) === 'active').map(renderCard)}
        </section>
        <section className="card">
          <h3 className="text-h3 mb-4">审计闭环</h3>
          {risks.filter((risk) => columnOf(risk.status) === 'closed').map(renderCard)}
        </section>
      </div>

      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <div role="dialog" aria-label={active.title} className="card-featured shadow-2xl w-full overflow-hidden" style={{ maxWidth: '42rem' }}>
            <div className="p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="text-h2">人工根因与行动</h3>
              <p className="text-small mt-2">{active.id} · {scopeLabel(active.scope)} · 当前 {active.status}</p>
              <BoundThresholdReadout risk={active} />
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-small">
                根因
                <textarea className="w-full mt-1 border p-2" value={rootCause} onChange={(event) => setRootCause(event.target.value)} />
              </label>
              <label className="block text-small">
                责任人
                <input className="w-full mt-1 border p-2" value={assignee} onChange={(event) => setAssignee(event.target.value)} />
              </label>
              <label className="block text-small">
                到期日
                <input className="w-full mt-1 border p-2" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </label>
              <label className="block text-small">
                行动说明
                <textarea className="w-full mt-1 border p-2" value={actionSummary} onChange={(event) => setActionSummary(event.target.value)} />
              </label>
              <label className="block text-small">
                有效性复核
                <textarea className="w-full mt-1 border p-2" value={effectivenessNote} onChange={(event) => setEffectivenessNote(event.target.value)} />
              </label>
              {formError && <p role="alert" className="text-red-600">{formError}</p>}
              <div className="flex flex-wrap gap-2">
                {active.status === 'Detected' && (
                  <button type="button" className="btn-primary" onClick={() => submit(active, 'Under_RCA', { rootCause })}>
                    提交根因并进入研判
                  </button>
                )}
                {(active.status === 'Under_RCA' || active.status === 'Triaged') && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => submit(active, 'Action_In_Progress', { rootCause, assignee, dueDate, actionSummary })}
                  >
                    指派行动
                  </button>
                )}
                {active.status === 'Action_In_Progress' && (
                  <button type="button" className="btn-primary" onClick={() => submit(active, 'Effectiveness_Check', {})}>
                    进入有效性复核
                  </button>
                )}
                {active.status === 'Effectiveness_Check' && (
                  <button type="button" className="btn-primary" onClick={() => submit(active, 'Closed', { effectivenessNote })}>
                    确认有效并关闭
                  </button>
                )}
                {active.status !== 'Closed' && (
                  <button type="button" className="btn-secondary" onClick={() => submit(active, 'Closed', {})}>
                    尝试关闭
                  </button>
                )}
                <button type="button" className="btn-secondary" onClick={() => setActiveId(null)}>返回</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
