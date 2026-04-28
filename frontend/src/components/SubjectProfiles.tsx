import { useState } from 'react'
import { AlertCircle, Activity, Calendar, Building2, ChevronRight, ShieldAlert, Stethoscope, CalendarX } from 'lucide-react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { useSubjectList } from '../api/hooks'
import type { Subject, SubjectEvent } from '../api/hooks'

const EVENT_CONFIG: Record<SubjectEvent['type'], { label: string; color: string; bg: string; Icon: React.ComponentType<{ size?: number }> }> = {
  AE:          { label: '不良事件',   color: '#DC3545', bg: '#FFF0F0', Icon: AlertCircle },
  PD:          { label: '方案违背',   color: '#F59E0B', bg: '#FFFBEB', Icon: ShieldAlert },
  MissedVisit: { label: '漏访',       color: '#6B7280', bg: '#F3F4F6', Icon: CalendarX },
}

function riskLevel(score: number): { label: string; color: string; bg: string } {
  if (score >= 75) return { label: '高风险', color: '#DC3545', bg: '#FFF0F0' }
  if (score >= 45) return { label: '中风险', color: '#F59E0B', bg: '#FFFBEB' }
  return { label: '低风险', color: '#10B981', bg: '#ECFDF5' }
}

function RiskBar({ score }: { score: number }) {
  const color = score >= 75 ? '#DC3545' : score >= 45 ? '#F59E0B' : '#10B981'
  return (
    <div style={{ width: '100%', height: '4px', background: '#E5E7EB', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
    </div>
  )
}

function SubjectListItem({ subject, selected, onSelect }: { subject: Subject; selected: boolean; onSelect: () => void }) {
  const lvl = riskLevel(subject.riskScore)
  return (
    <button
      onClick={onSelect}
      className="w-full text-left"
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        background: selected ? '#EEF4F9' : 'transparent',
        border: selected ? '1px solid var(--color-brand)' : '1px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.15s',
        marginBottom: '4px',
        display: 'block',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#F8FAFB' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-mono" style={{ fontSize: '13px', fontWeight: 600 }}>{subject.subjectId}</span>
        <div className="flex items-center gap-2">
          <span
            className="text-mono"
            style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: lvl.bg, color: lvl.color, fontWeight: 600 }}
          >
            {lvl.label}
          </span>
          <span style={{ fontFamily: 'SF Mono, Menlo, monospace', fontSize: '14px', fontWeight: 700, color: lvl.color, minWidth: '28px', textAlign: 'right' }}>
            {subject.riskScore}
          </span>
          <ChevronRight size={14} style={{ color: 'var(--color-text-secondary)' }} />
        </div>
      </div>
      <RiskBar score={subject.riskScore} />
      <div className="flex items-center gap-1 mt-2" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        <Building2 size={11} />
        <span>{subject.siteName}</span>
        <span style={{ marginLeft: '8px' }}>AE {subject.aeCount} · PD {subject.pdCount} · 漏访 {subject.missedVisitCount}</span>
      </div>
    </button>
  )
}

function EventTimeline({ events }: { events: SubjectEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center text-small" style={{ height: '120px', color: 'var(--color-text-secondary)' }}>
        暂无事件记录
      </div>
    )
  }

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div style={{ position: 'relative', paddingLeft: '24px' }}>
      <div style={{ position: 'absolute', left: '7px', top: 0, bottom: 0, width: '2px', background: '#E5E7EB' }} />
      {sorted.map((ev, i) => {
        const cfg = EVENT_CONFIG[ev.type]
        const Ico = cfg.Icon
        return (
          <div key={i} style={{ position: 'relative', marginBottom: '16px' }}>
            <div style={{
              position: 'absolute', left: '-21px', top: '2px',
              width: '16px', height: '16px', borderRadius: '50%',
              background: cfg.bg, border: `2px solid ${cfg.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: cfg.color, display: 'flex' }}>
                <Ico size={8} />
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div style={{ flex: 1 }}>
                <span
                  className="text-mono"
                  style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: cfg.bg, color: cfg.color, fontWeight: 600, marginRight: '8px' }}
                >
                  {cfg.label}
                </span>
                <span className="text-body" style={{ fontSize: '13px' }}>{ev.description}</span>
                {ev.severity !== '—' && (
                  <span className="text-mono" style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {ev.severity}
                  </span>
                )}
              </div>
              <span className="text-mono" style={{ fontSize: '11px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                {ev.date.slice(0, 10)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SubjectRadar({ subject }: { subject: Subject }) {
  const maxAE = 5
  const maxPD = 4
  const maxMV = 3

  const data = [
    { metric: '不良事件', value: Math.min(subject.aeCount / maxAE, 1) * 100, fullMark: 100 },
    { metric: '方案违背', value: Math.min(subject.pdCount / maxPD, 1) * 100, fullMark: 100 },
    { metric: '漏访次数', value: Math.min(subject.missedVisitCount / maxMV, 1) * 100, fullMark: 100 },
    { metric: '综合风险', value: subject.riskScore, fullMark: 100 },
  ]

  const lvl = riskLevel(subject.riskScore)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="#E5E7EB" />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#6B7280' }} />
        <Radar
          name={subject.subjectId}
          dataKey="value"
          stroke={lvl.color}
          fill={lvl.color}
          fillOpacity={0.2}
          strokeWidth={2}
        />
        <Tooltip
          formatter={(v) => [`${Number(v).toFixed(0)}`, '']}
          contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

function DetailPanel({ subject }: { subject: Subject }) {
  const lvl = riskLevel(subject.riskScore)
  return (
    <div className="animate-in fade-in duration-200">
      <div className="card mb-4" style={{ padding: '20px 24px' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-h3">{subject.subjectId}</span>
              <span
                className="text-mono"
                style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '6px', background: lvl.bg, color: lvl.color, fontWeight: 600 }}
              >
                {lvl.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-small" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="flex items-center gap-1"><Building2 size={12} />{subject.siteName}</span>
              <span className="flex items-center gap-1"><Calendar size={12} />入组 {subject.enrollmentDate.slice(0, 10)}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '40px', fontWeight: 700, color: lvl.color, fontFamily: 'SF Mono, Menlo, monospace', lineHeight: 1 }}>
              {subject.riskScore}
            </div>
            <div className="text-small" style={{ color: 'var(--color-text-secondary)' }}>风险评分</div>
          </div>
        </div>

        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[
            { label: '不良事件', value: subject.aeCount, color: '#DC3545', Icon: AlertCircle },
            { label: '方案违背', value: subject.pdCount, color: '#F59E0B', Icon: ShieldAlert },
            { label: '漏访次数', value: subject.missedVisitCount, color: '#6B7280', Icon: CalendarX },
          ].map(item => (
            <div key={item.label} style={{ background: '#F8FAFB', borderRadius: '8px', padding: '12px 16px' }}>
              <div className="flex items-center gap-1 mb-1" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                <span style={{ color: item.color }}><item.Icon size={12} /></span>
                {item.label}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: item.color, fontFamily: 'SF Mono, Menlo, monospace' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} style={{ color: 'var(--color-brand)' }} />
            <span className="text-h3" style={{ fontSize: '14px' }}>事件时间轴</span>
          </div>
          <EventTimeline events={subject.events} />
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope size={14} style={{ color: 'var(--color-brand)' }} />
            <span className="text-h3" style={{ fontSize: '14px' }}>风险雷达图</span>
          </div>
          <SubjectRadar subject={subject} />
        </div>
      </div>
    </div>
  )
}

export default function SubjectProfiles() {
  const q = useSubjectList()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (q.isLoading) return <div className="text-slate-500">加载中…</div>
  if (q.isError || !q.data) return <div className="text-red-600">无法加载受试者数据</div>

  const sorted = [...q.data].sort((a, b) => b.riskScore - a.riskScore)
  const selected = sorted.find(s => s.subjectId === selectedId) ?? sorted[0]

  const highRisk = sorted.filter(s => s.riskScore >= 75).length
  const midRisk  = sorted.filter(s => s.riskScore >= 45 && s.riskScore < 75).length
  const lowRisk  = sorted.filter(s => s.riskScore < 45).length

  return (
    <div className="animate-in fade-in duration-300">
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: '受试者总数', value: sorted.length, color: 'var(--color-text-primary)' },
          { label: '高风险', value: highRisk, color: '#DC3545' },
          { label: '中风险', value: midRisk, color: '#F59E0B' },
          { label: '低风险', value: lowRisk, color: '#10B981' },
        ].map(item => (
          <div key={item.label} className="card" style={{ padding: '16px 20px' }}>
            <div className="text-mono mb-1" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{item.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: item.color, fontFamily: 'SF Mono, Menlo, monospace' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-6" style={{ alignItems: 'flex-start' }}>
        <div
          className="card"
          style={{ width: '300px', flexShrink: 0, padding: '16px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}
        >
          <p className="text-mono mb-3" style={{ fontSize: '12px', color: 'var(--color-text-secondary)', padding: '0 4px' }}>
            按风险评分排序 · {sorted.length} 名受试者
          </p>
          {sorted.map(s => (
            <SubjectListItem
              key={s.subjectId}
              subject={s}
              selected={s.subjectId === (selectedId ?? sorted[0]?.subjectId)}
              onSelect={() => setSelectedId(s.subjectId)}
            />
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {selected && <DetailPanel subject={selected} />}
        </div>
      </div>
    </div>
  )
}
