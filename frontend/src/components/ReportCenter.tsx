import { useState } from 'react'
import { FileText, Download, Plus, AlertTriangle, Clock, CheckCircle2, Loader2, X } from 'lucide-react'
import { useReportList } from '../api/hooks'
import type { Report, ReportType } from '../api/hooks'

const TYPE_META: Record<ReportType, { label: string; bg: string; color: string }> = {
  Monthly:     { label: '月度报告',     bg: '#EFF6FF', color: '#1E40AF' },
  SiteDeepDive:{ label: '中心深度分析', bg: '#FAF5FF', color: '#6B21A8' },
  CapaAnalysis:{ label: 'CAPA 分析',   bg: '#ECFDF5', color: '#065F46' },
  Custom:      { label: '自定义报告',   bg: '#FEF3C7', color: '#92400E' },
}

const FORMAT_COLOR: Record<string, string> = {
  PDF:   '#DC3545',
  Excel: '#10B981',
}

function TypeBadge({ type }: { type: ReportType }) {
  const m = TYPE_META[type]
  return (
    <span style={{ background: m.bg, color: m.color, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'SF Mono, Menlo, monospace', fontWeight: 600 }}>
      {m.label}
    </span>
  )
}

function simulateDownload(report: Report) {
  const content = [
    `报告标题: ${report.title}`,
    `报告类型: ${TYPE_META[report.type].label}`,
    `报告周期: ${report.period}`,
    `生成人员: ${report.generatedBy}`,
    `生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`,
    `文件格式: ${report.format}`,
    '',
    '执行摘要:',
    `  严重预警数:     ${report.summary.totalCriticalAlerts}`,
    `  未解决工单:     ${report.summary.unresolvedTasks}`,
    `  平均录入滞后:   ${report.summary.avgEntryDelayDays} 天`,
    `  最高风险中心:   ${report.summary.highestRiskSite}`,
  ].join('\n')
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${report.reportId}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function ReportCard({ report, onDownload }: { report: Report; onDownload: (r: Report) => void }) {
  const generating = report.status === 'Generating'
  const ts = new Date(report.generatedAt)
  const dateStr = ts.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const timeStr = ts.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  return (
    <div
      className="card"
      style={{
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        opacity: generating ? 0.7 : 1,
        transition: 'box-shadow 0.15s',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div style={{ background: generating ? '#F3F4F6' : '#EFF6FF', borderRadius: '8px', padding: '10px', flexShrink: 0 }}>
            {generating
              ? <span style={{ color: '#6B7280' }}><Loader2 size={20} className="animate-spin" /></span>
              : <span style={{ color: 'var(--color-brand)' }}><FileText size={20} /></span>}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', lineHeight: 1.3 }}>{report.title}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              周期：{report.period}
            </div>
          </div>
        </div>
        <TypeBadge type={report.type} />
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr', fontSize: '12px' }}>
        {[
          { label: '严重预警', value: report.summary.totalCriticalAlerts, color: report.summary.totalCriticalAlerts > 0 ? '#DC3545' : '#6B7280' },
          { label: '未解决工单', value: report.summary.unresolvedTasks, color: report.summary.unresolvedTasks > 5 ? '#F59E0B' : '#6B7280' },
          { label: '最高风险中心', value: report.summary.highestRiskSite, color: 'var(--color-text-primary)', full: true },
        ].map(item => (
          <div key={item.label} style={{ gridColumn: item.full ? '1 / -1' : undefined, background: '#F8FAFB', borderRadius: '6px', padding: '8px 10px' }}>
            <div style={{ color: 'var(--color-text-secondary)', fontSize: '11px', fontFamily: 'SF Mono, Menlo, monospace', marginBottom: '2px' }}>{item.label}</div>
            <div style={{ fontWeight: 600, color: item.color, fontFamily: 'SF Mono, Menlo, monospace' }}>
              {typeof item.value === 'number' ? item.value : item.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'SF Mono, Menlo, monospace' }}>
          <div>{report.generatedBy} · {dateStr} {timeStr}</div>
          <div style={{ marginTop: '2px' }}>
            <span style={{ color: FORMAT_COLOR[report.format], fontWeight: 600 }}>{report.format}</span>
            {' · '}{report.sizeMb.toFixed(1)} MB
          </div>
        </div>
        {generating
          ? <span style={{ fontSize: '12px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Loader2 size={12} />生成中…
            </span>
          : <button
              onClick={() => onDownload(report)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: '#fff', cursor: 'pointer', color: 'var(--color-text-primary)', transition: 'all 0.15s' }}
              aria-label={`下载 ${report.title}`}
            >
              <Download size={13} /> 下载
            </button>}
      </div>
    </div>
  )
}

type GenerateForm = {
  type: ReportType
  period: string
  format: 'PDF' | 'Excel'
  operator: string
}

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'Monthly',      label: '月度风险监控报告' },
  { value: 'SiteDeepDive', label: '中心深度分析报告' },
  { value: 'CapaAnalysis', label: 'CAPA 效率分析报告' },
  { value: 'Custom',       label: '自定义报告' },
]

function GenerateModal({ onClose, onGenerate }: {
  onClose: () => void
  onGenerate: (form: GenerateForm) => void
}) {
  const [form, setForm] = useState<GenerateForm>({
    type: 'Monthly',
    period: '2026-05',
    format: 'PDF',
    operator: '赵晓燕',
  })

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 32px', width: '440px', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ fontSize: '16px', fontWeight: 700 }}>生成新报告</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            {
              label: '报告类型', key: 'type' as const,
              node: (
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as ReportType }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px' }}
                  aria-label="报告类型"
                >
                  {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              ),
            },
            {
              label: '报告周期', key: 'period' as const,
              node: (
                <input
                  value={form.period}
                  onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                  placeholder="例：2026-05 或 2026-Q2"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                  aria-label="报告周期"
                />
              ),
            },
            {
              label: '输出格式', key: 'format' as const,
              node: (
                <div className="flex gap-3">
                  {(['PDF', 'Excel'] as const).map(f => (
                    <label key={f} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input type="radio" name="format" value={f} checked={form.format === f} onChange={() => setForm(prev => ({ ...prev, format: f }))} />
                      <span style={{ color: FORMAT_COLOR[f], fontWeight: 600 }}>{f}</span>
                    </label>
                  ))}
                </div>
              ),
            },
            {
              label: '生成人员', key: 'operator' as const,
              node: (
                <input
                  value={form.operator}
                  onChange={e => setForm(f => ({ ...f, operator: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box' }}
                  aria-label="生成人员"
                />
              ),
            },
          ].map(row => (
            <div key={row.key}>
              <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'SF Mono, Menlo, monospace', display: 'block', marginBottom: '6px' }}>
                {row.label}
              </label>
              {row.node}
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '10px', border: '1px solid var(--color-border)', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '13px' }}
          >
            取消
          </button>
          <button
            onClick={() => onGenerate(form)}
            className="btn-primary"
            style={{ flex: 2, padding: '10px', borderRadius: '8px', fontSize: '13px' }}
            data-testid="confirm-generate"
          >
            确认生成
          </button>
        </div>
      </div>
    </div>
  )
}

function KpiBanner({ reports }: { reports: Report[] }) {
  const ready = reports.filter(r => r.status === 'Ready')
  const lastReport = ready[0]
  const monthlyCount = ready.filter(r => r.type === 'Monthly').length
  const lastDate = lastReport ? new Date(lastReport.generatedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '—'

  return (
    <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {[
        { label: '报告总数', value: ready.length, icon: FileText, color: 'var(--color-brand)' },
        { label: '月度报告', value: monthlyCount, icon: CheckCircle2, color: '#10B981' },
        { label: '最近生成', value: lastDate, icon: Clock, color: '#6B7280' },
        { label: '待处理预警', value: lastReport?.summary.totalCriticalAlerts ?? 0, icon: AlertTriangle, color: (lastReport?.summary.totalCriticalAlerts ?? 0) > 0 ? '#DC3545' : '#6B7280' },
      ].map(k => (
        <div key={k.label} className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'SF Mono, Menlo, monospace', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: k.color }}><k.icon size={12} /></span>
            {k.label}
          </div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: k.color, fontFamily: 'SF Mono, Menlo, monospace', lineHeight: 1 }}>
            {k.value}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ReportCenter() {
  const q = useReportList()
  const [showModal, setShowModal] = useState(false)
  const [localReports, setLocalReports] = useState<Report[]>([])

  if (q.isLoading) return <div className="text-slate-500">加载中…</div>
  if (q.isError || !q.data) return <div className="text-red-600">无法加载报告列表</div>

  const allReports = [...localReports, ...q.data]

  function handleGenerate(form: GenerateForm) {
    setShowModal(false)
    const typeLabel = REPORT_TYPES.find(t => t.value === form.type)?.label ?? '自定义报告'
    const newReport: Report = {
      reportId: `RPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(localReports.length + 7).padStart(3, '0')}`,
      title: `${form.period} ${typeLabel}`,
      type: form.type,
      period: form.period,
      generatedBy: form.operator,
      generatedAt: new Date().toISOString(),
      status: 'Generating',
      format: form.format,
      sizeMb: 0,
      summary: { totalCriticalAlerts: 0, unresolvedTasks: 0, avgEntryDelayDays: 0, highestRiskSite: '—' },
    }
    setLocalReports(prev => [newReport, ...prev])

    setTimeout(() => {
      setLocalReports(prev => prev.map(r =>
        r.reportId === newReport.reportId
          ? { ...r, status: 'Ready', sizeMb: +(Math.random() * 3 + 0.5).toFixed(1), summary: { totalCriticalAlerts: 3, unresolvedTasks: 5, avgEntryDelayDays: 4.2, highestRiskSite: '北京协和医院' } }
          : r
      ))
    }, 2500)
  }

  return (
    <div className="animate-in fade-in duration-300">
      {showModal && <GenerateModal onClose={() => setShowModal(false)} onGenerate={handleGenerate} />}

      <div className="flex items-center justify-between mb-6">
        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          已归档 <strong>{allReports.filter(r => r.status === 'Ready').length}</strong> 份报告，可随时下载或生成新报告
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', padding: '8px 18px' }}
        >
          <Plus size={15} /> 生成新报告
        </button>
      </div>

      <KpiBanner reports={allReports} />

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {allReports.map(report => (
          <ReportCard key={report.reportId} report={report} onDownload={simulateDownload} />
        ))}
      </div>

      {allReports.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-secondary)', fontSize: '14px' }}>
          暂无报告，点击「生成新报告」创建第一份报告
        </div>
      )}
    </div>
  )
}
