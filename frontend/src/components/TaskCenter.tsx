import { useState } from 'react'
import { Clock, AlertCircle, CheckCircle2, Circle, User, Building2, Tag, ChevronDown } from 'lucide-react'
import { useTaskList } from '../api/hooks'
import type { Task } from '../api/hooks'

const PRIORITY_CONFIG: Record<Task['priority'], { label: string; color: string; bg: string }> = {
  Critical: { label: '紧急', color: '#DC3545', bg: '#FFF0F0' },
  High:     { label: '高',   color: '#F59E0B', bg: '#FFFBEB' },
  Medium:   { label: '中',   color: '#0066CC', bg: '#EEF4FF' },
  Low:      { label: '低',   color: '#6B7280', bg: '#F3F4F6' },
}

const COLUMNS: { key: Task['status']; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: 'To Do',      label: '待处理',  icon: Circle },
  { key: 'In Progress', label: '处理中', icon: Clock },
  { key: 'Resolved',   label: '已解决',  icon: CheckCircle2 },
]

function isOverdue(task: Task): boolean {
  return task.status !== 'Resolved' && new Date(task.dueDate) < new Date()
}

function formatDate(iso: string): string {
  return iso.slice(0, 10)
}

function TaskCard({ task, onStatusChange }: { task: Task; onStatusChange: (id: string, status: Task['status']) => void }) {
  const overdue = isOverdue(task)
  const pCfg = PRIORITY_CONFIG[task.priority]

  return (
    <div
      className="card mb-3"
      style={{
        borderLeft: `3px solid ${pCfg.color}`,
        padding: '12px 16px',
        cursor: 'default',
        animation: overdue ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-mono" style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>{task.taskId}</span>
        <span
          className="text-mono"
          style={{
            fontSize: '11px',
            padding: '1px 6px',
            borderRadius: '4px',
            background: pCfg.bg,
            color: pCfg.color,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {pCfg.label}
        </span>
      </div>

      <p className="text-body mb-3" style={{ fontSize: '13px', lineHeight: '1.4' }}>{task.title}</p>

      <div className="flex flex-col gap-1" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        <div className="flex items-center gap-1">
          <Building2 size={11} />
          <span>{task.siteName}</span>
        </div>
        <div className="flex items-center gap-1">
          <User size={11} />
          <span>{task.assignee}</span>
        </div>
        <div className="flex items-center gap-1">
          <Tag size={11} />
          <span>{task.category}</span>
        </div>
        <div className="flex items-center gap-1" style={{ color: overdue ? '#DC3545' : 'var(--color-text-secondary)' }}>
          {overdue ? <AlertCircle size={11} /> : <Clock size={11} />}
          <span>{overdue ? '已逾期 · ' : '截止 '}{formatDate(task.dueDate)}</span>
        </div>
      </div>

      <div className="mt-3 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
        <StatusDropdown current={task.status} taskId={task.taskId} onChange={onStatusChange} />
      </div>
    </div>
  )
}

function StatusDropdown({ current, taskId, onChange }: {
  current: Task['status']
  taskId: string
  onChange: (id: string, s: Task['status']) => void
}) {
  const [open, setOpen] = useState(false)
  const options: Task['status'][] = ['To Do', 'In Progress', 'Resolved']

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-mono"
        style={{ fontSize: '11px', color: 'var(--color-brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        移动至 <ChevronDown size={11} />
      </button>
      {open && (
        <div
          className="absolute left-0 z-20 bg-white rounded shadow-md"
          style={{ top: '20px', minWidth: '120px', border: '1px solid var(--color-border)' }}
        >
          {options.filter(o => o !== current).map(o => (
            <button
              key={o}
              onClick={() => { onChange(taskId, o); setOpen(false) }}
              className="block w-full text-left text-body"
              style={{ padding: '8px 12px', fontSize: '12px', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#EEF4F9')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              {COLUMNS.find(c => c.key === o)?.label ?? o}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SummaryBar({ tasks }: { tasks: Task[] }) {
  const overdue = tasks.filter(isOverdue).length
  const critical = tasks.filter(t => t.priority === 'Critical' && t.status !== 'Resolved').length
  const resolved = tasks.filter(t => t.status === 'Resolved').length
  const total = tasks.length

  return (
    <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {[
        { label: '工单总数', value: total, color: 'var(--color-text-primary)' },
        { label: '紧急待处理', value: critical, color: '#DC3545' },
        { label: '已逾期', value: overdue, color: '#F59E0B' },
        { label: '已解决', value: resolved, color: '#10B981' },
      ].map(item => (
        <div key={item.label} className="card" style={{ padding: '16px 20px' }}>
          <div className="text-mono mb-1" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{item.label}</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: item.color, fontFamily: 'SF Mono, Menlo, monospace' }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TaskCenter() {
  const q = useTaskList()
  const [tasks, setTasks] = useState<Task[] | null>(null)

  if (q.isLoading) return <div className="text-slate-500">加载中…</div>
  if (q.isError || !q.data) return <div className="text-red-600">无法加载工单数据</div>

  const data = tasks ?? q.data

  function handleStatusChange(taskId: string, status: Task['status']) {
    const next = (tasks ?? q.data!).map(t => t.taskId === taskId ? { ...t, status } : t)
    setTasks(next)
  }

  return (
    <div className="animate-in fade-in duration-300">
      <SummaryBar tasks={data} />

      <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)', alignItems: 'start' }}>
        {COLUMNS.map(col => {
          const ColIcon = col.icon
          const colTasks = data.filter(t => t.status === col.key)
          return (
            <div key={col.key}>
              <div
                className="flex items-center gap-2 mb-4 px-1"
              >
                <span style={{ color: col.key === 'Resolved' ? '#10B981' : col.key === 'In Progress' ? '#F59E0B' : 'var(--color-text-secondary)' }}>
                  <ColIcon size={16} />
                </span>
                <span className="text-h3" style={{ fontSize: '14px' }}>{col.label}</span>
                <span
                  className="text-mono"
                  style={{
                    marginLeft: 'auto',
                    fontSize: '12px',
                    background: '#EEF4F9',
                    color: 'var(--color-text-secondary)',
                    padding: '1px 8px',
                    borderRadius: '10px',
                  }}
                >
                  {colTasks.length}
                </span>
              </div>

              <div
                style={{
                  minHeight: '200px',
                  background: '#F8FAFB',
                  borderRadius: '12px',
                  padding: '12px',
                }}
              >
                {colTasks.length === 0 ? (
                  <div
                    className="flex items-center justify-center text-small"
                    style={{ height: '80px', color: 'var(--color-text-secondary)' }}
                  >
                    暂无工单
                  </div>
                ) : (
                  colTasks.map(t => (
                    <TaskCard key={t.taskId} task={t} onStatusChange={handleStatusChange} />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
