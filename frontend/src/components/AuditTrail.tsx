import { useState, useMemo } from 'react'
import { Shield, Download, ChevronDown, ChevronRight, Filter } from 'lucide-react'
import { useAuditLogs } from '../api/hooks'
import type { AuditLog, AuditActionType } from '../api/hooks'

const ACTION_META: Record<AuditActionType, { label: string; bg: string; color: string }> = {
  UPDATE_THRESHOLD: { label: '阈值变更',   bg: '#FEF3C7', color: '#92400E' },
  CLOSE_ALERT:     { label: '预警关闭',   bg: '#ECFDF5', color: '#065F46' },
  CREATE_TASK:     { label: '工单创建',   bg: '#EFF6FF', color: '#1E40AF' },
  RESOLVE_TASK:    { label: '工单完结',   bg: '#F0FDF4', color: '#166534' },
  UPDATE_SUBJECT:  { label: '受试者更新', bg: '#FAF5FF', color: '#6B21A8' },
  EXPORT_REPORT:   { label: '报告导出',   bg: '#F1F5F9', color: '#334155' },
}

const ALL_ACTIONS = Object.keys(ACTION_META) as AuditActionType[]

function ActionBadge({ type }: { type: AuditActionType }) {
  const m = ACTION_META[type] ?? { label: type, bg: '#F1F5F9', color: '#334155' }
  return (
    <span style={{
      background: m.bg, color: m.color,
      padding: '2px 8px', borderRadius: '4px',
      fontSize: '11px', fontFamily: 'SF Mono, Menlo, monospace',
      fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  )
}

function DetailsPanel({ details }: { details: Record<string, unknown> }) {
  return (
    <div style={{ background: '#F8FAFB', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '10px 14px', marginTop: '8px', fontSize: '12px', fontFamily: 'SF Mono, Menlo, monospace' }}>
      {Object.entries(details).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: '12px', marginBottom: '3px' }}>
          <span style={{ color: 'var(--color-text-secondary)', minWidth: '160px' }}>{k}</span>
          <span style={{ color: 'var(--color-text-primary)' }}>
            {Array.isArray(v) ? v.join(', ') : String(v)}
          </span>
        </div>
      ))}
    </div>
  )
}

function LogRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false)
  const ts = new Date(log.timestamp)
  const dateStr = ts.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  const timeStr = ts.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      <tr
        onClick={() => setOpen(o => !o)}
        style={{ cursor: 'pointer', borderBottom: open ? 'none' : '1px solid var(--color-border)' }}
        className="audit-row"
      >
        <td style={{ padding: '10px 12px', fontFamily: 'SF Mono, Menlo, monospace', fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
          <div>{dateStr}</div>
          <div>{timeStr}</div>
        </td>
        <td style={{ padding: '10px 12px', fontSize: '11px', fontFamily: 'SF Mono, Menlo, monospace', color: 'var(--color-text-secondary)' }}>
          {log.logId}
        </td>
        <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 500 }}>{log.userName}</td>
        <td style={{ padding: '10px 12px' }}>
          <ActionBadge type={log.actionType} />
        </td>
        <td style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--color-text-primary)' }}>
          {log.description}
        </td>
        <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          {open
            ? <span><ChevronDown size={14} /></span>
            : <span><ChevronRight size={14} /></span>}
        </td>
      </tr>
      {open && (
        <tr style={{ borderBottom: '1px solid var(--color-border)', background: '#FAFAFA' }}>
          <td colSpan={6} style={{ padding: '0 12px 12px 48px' }}>
            <DetailsPanel details={log.details} />
          </td>
        </tr>
      )}
    </>
  )
}

function KpiBanner({ logs }: { logs: AuditLog[] }) {
  const counts = useMemo(() => {
    const c: Partial<Record<AuditActionType, number>> = {}
    for (const l of logs) c[l.actionType] = (c[l.actionType] ?? 0) + 1
    return c
  }, [logs])

  const items = [
    { label: '阈值变更', count: counts.UPDATE_THRESHOLD ?? 0, color: '#92400E' },
    { label: '预警关闭', count: counts.CLOSE_ALERT ?? 0, color: '#065F46' },
    { label: '工单操作', count: (counts.CREATE_TASK ?? 0) + (counts.RESOLVE_TASK ?? 0), color: '#1E40AF' },
    { label: '报告导出', count: counts.EXPORT_REPORT ?? 0, color: '#334155' },
  ]

  return (
    <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {items.map(it => (
        <div key={it.label} className="card" style={{ padding: '14px 20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'SF Mono, Menlo, monospace', marginBottom: '6px' }}>{it.label}</div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: it.color, fontFamily: 'SF Mono, Menlo, monospace', lineHeight: 1 }}>{it.count}</div>
        </div>
      ))}
    </div>
  )
}

function simulateExport(logs: AuditLog[]) {
  const lines = [
    'logId,timestamp,userId,userName,actionType,description',
    ...logs.map(l =>
      [l.logId, l.timestamp, l.userId, l.userName, l.actionType, `"${l.description}"`].join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AuditTrail() {
  const q = useAuditLogs()
  const [actionFilter, setActionFilter] = useState<AuditActionType | 'ALL'>('ALL')
  const [userFilter, setUserFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  if (q.isLoading) return <div className="text-slate-500">加载中…</div>
  if (q.isError || !q.data) return <div className="text-red-600">无法加载审计日志</div>

  const logs = q.data
  const users = ['ALL', ...Array.from(new Set(logs.map(l => l.userName)))]

  const filtered = logs.filter(l => {
    if (actionFilter !== 'ALL' && l.actionType !== actionFilter) return false
    if (userFilter !== 'ALL' && l.userName !== userFilter) return false
    if (search && !l.description.includes(search) && !l.logId.includes(search)) return false
    return true
  })

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center gap-2 mb-6" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '10px 16px', fontSize: '12px', color: '#1E40AF' }}>
        <span><Shield size={14} /></span>
        <span>审计日志为只读不可篡改记录，符合 FDA CFR 21 Part 11 电子记录规范。所有敏感操作均自动捕获并持久化。</span>
      </div>

      <KpiBanner logs={logs} />

      <div className="card" style={{ padding: '20px 24px' }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              <Filter size={12} /> 筛选
            </span>
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value as AuditActionType | 'ALL')}
              style={{ fontSize: '12px', padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: '6px', fontFamily: 'SF Mono, Menlo, monospace', background: '#fff' }}
              aria-label="操作类型"
            >
              <option value="ALL">全部操作</option>
              {ALL_ACTIONS.map(a => (
                <option key={a} value={a}>{ACTION_META[a].label}</option>
              ))}
            </select>
            <select
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
              style={{ fontSize: '12px', padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: '6px', fontFamily: 'SF Mono, Menlo, monospace', background: '#fff' }}
              aria-label="操作人员"
            >
              {users.map(u => (
                <option key={u} value={u}>{u === 'ALL' ? '全部人员' : u}</option>
              ))}
            </select>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索描述或日志 ID…"
              style={{ fontSize: '12px', padding: '4px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', width: '200px', fontFamily: 'SF Mono, Menlo, monospace' }}
              aria-label="搜索日志"
            />
          </div>
          <div className="flex items-center gap-4">
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'SF Mono, Menlo, monospace' }}>
              {filtered.length} / {logs.length} 条记录
            </span>
            <button
              onClick={() => simulateExport(filtered)}
              className="btn-primary"
              style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={13} /> 导出 CSV
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['时间', '日志 ID', '操作人员', '操作类型', '操作描述', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontFamily: 'SF Mono, Menlo, monospace', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                      未找到匹配的审计记录
                    </td>
                  </tr>
                )
                : filtered.map(log => (
                  <LogRow key={log.logId} log={log} />
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
