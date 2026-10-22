import { useState, useRef } from 'react'
import {
  AlertCircle, Activity, Calendar, Building2, ChevronRight, ShieldAlert,
  Stethoscope, CalendarX, FlaskConical, Pill, Scissors, TrendingDown,
  LogIn, ClipboardCheck, XCircle, BedDouble, Syringe
} from 'lucide-react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { useSubjectList } from '../api/hooks'
import type { Subject, ClinicalEvent, TrialEvent, ClinicalEventType, TrialEventType, ProblemItem, Treatment } from '../api/hooks'

// ─── Clinical event config ───────────────────────────────────────────────────

const CLINICAL_CONFIG: Record<ClinicalEventType, { label: string; color: string; bg: string; Icon: React.ComponentType<{ size?: number }> }> = {
  AE:              { label: '不良事件',     color: '#DC3545', bg: '#FFF0F0', Icon: AlertCircle },
  SAE:             { label: '严重不良事件', color: '#8B0000', bg: '#FFF0F0', Icon: AlertCircle },
  Diagnosis:       { label: '诊断',         color: '#7C3AED', bg: '#F5F3FF', Icon: ClipboardCheck },
  LabFinding:      { label: '实验室发现',   color: '#2563EB', bg: '#EFF6FF', Icon: FlaskConical },
  TreatmentChange: { label: '用药调整',     color: '#0891B2', bg: '#ECFEFF', Icon: Pill },
  Surgery:         { label: '手术',         color: '#D97706', bg: '#FFFBEB', Icon: Scissors },
  Progression:     { label: '疾病进展',     color: '#B45309', bg: '#FEF3C7', Icon: TrendingDown },
  Hospitalization: { label: '住院',         color: '#BE123C', bg: '#FFF1F2', Icon: BedDouble },
}

// ─── Trial event config ───────────────────────────────────────────────────────

const TRIAL_CONFIG: Record<TrialEventType, { label: string; color: string; bg: string; Icon: React.ComponentType<{ size?: number }> }> = {
  Screening:      { label: '筛选',     color: '#6B7280', bg: '#F3F4F6', Icon: ClipboardCheck },
  Enrollment:     { label: '入组',     color: '#18E299', bg: '#D4FAE8', Icon: LogIn },
  Visit:          { label: '访视',     color: '#3B82F6', bg: '#EFF6FF', Icon: Calendar },
  PD:             { label: '方案违背', color: '#F59E0B', bg: '#FFFBEB', Icon: ShieldAlert },
  MissedVisit:    { label: '漏访',     color: '#9CA3AF', bg: '#F3F4F6', Icon: CalendarX },
  EarlyTermination: { label: '提前退出', color: '#DC3545', bg: '#FFF0F0', Icon: XCircle },
  StudyDrugHold:  { label: '用药暂停', color: '#D97706', bg: '#FFFBEB', Icon: Syringe },
}

// ─── Treatment type icon ──────────────────────────────────────────────────────

const TREATMENT_ICON: Record<Treatment['type'], React.ComponentType<{ size?: number }>> = {
  medication: Pill,
  surgery:    Scissors,
  procedure:  Stethoscope,
}

const STATUS_COLOR: Record<Treatment['status'], string> = {
  ongoing:      '#10B981',
  discontinued: '#9CA3AF',
  completed:    '#3B82F6',
}
const STATUS_LABEL: Record<Treatment['status'], string> = {
  ongoing:      '持续中',
  discontinued: '已停用',
  completed:    '已完成',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function riskLevel(score: number) {
  if (score >= 75) return { label: '高风险', color: '#DC3545', bg: '#FFF0F0' }
  if (score >= 45) return { label: '中风险', color: '#F59E0B', bg: '#FFFBEB' }
  return { label: '低风险', color: '#10B981', bg: '#ECFDF5' }
}

function fmtDate(d: string) {
  return d.slice(0, 10)
}

function RiskBar({ score }: { score: number }) {
  const color = score >= 75 ? '#DC3545' : score >= 45 ? '#F59E0B' : '#10B981'
  return (
    <div style={{ width: '100%', height: '4px', background: '#E5E7EB', borderRadius: '2px', overflow: 'hidden' }}>
      <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
    </div>
  )
}

// ─── Subject list item ────────────────────────────────────────────────────────

function SubjectListItem({ subject, selected, onSelect }: { subject: Subject; selected: boolean; onSelect: () => void }) {
  const lvl = riskLevel(subject.riskScore)
  return (
    <button
      onClick={onSelect}
      className="w-full text-left"
      style={{
        padding: '12px 16px', borderRadius: '8px',
        background: selected ? '#EEF4F9' : 'transparent',
        border: selected ? '1px solid var(--color-brand)' : '1px solid transparent',
        cursor: 'pointer', transition: 'all 0.15s', marginBottom: '4px', display: 'block',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#F8FAFB' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-mono" style={{ fontSize: '13px', fontWeight: 600 }}>{subject.subjectId}</span>
        <div className="flex items-center gap-2">
          <span className="text-mono" style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: lvl.bg, color: lvl.color, fontWeight: 600 }}>
            {lvl.label}
          </span>
          <span style={{ fontFamily: 'SF Mono, Menlo, monospace', fontSize: '14px', fontWeight: 700, color: lvl.color, minWidth: '28px', textAlign: 'right' }}>
            {subject.riskScore}
          </span>
          <span style={{ color: 'var(--color-text-secondary)' }}><ChevronRight size={14} /></span>
        </div>
      </div>
      <RiskBar score={subject.riskScore} />
      <div className="flex items-center gap-1 mt-2" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}><Building2 size={11} />{subject.siteName}</span>
        <span style={{ marginLeft: '8px' }}>AE {subject.aeCount} · PD {subject.pdCount} · 漏访 {subject.missedVisitCount}</span>
      </div>
    </button>
  )
}

// ─── Category colors (used in ClinicalDetailPanel) ───────────────────────────

const CATEGORY_COLOR: Record<string, string> = {
  '内分泌与代谢': '#7C3AED',
  '心血管':       '#DC3545',
  '肌肉骨骼':     '#D97706',
  '呼吸系统':     '#2563EB',
  '泌尿系统':     '#0891B2',
  '免疫系统':     '#BE123C',
}

// ─── Horizontal dual-lane timeline ───────────────────────────────────────────

interface TooltipState {
  text: string
  severity: string
  date: string
  label: string
  color: string
  x: number
  y: number
}

const MONTH_WIDTH = 240
const LANE_LABEL_W = 90
const LANE_H = 160
const AXIS_H = 40

// ─── Clinical detail panel (Problem List style) ──────────────────────────────

function ClinicalDetailPanel({
  problemList,
  treatments,
  clinicalEvents,
  onClose,
}: {
  problemList: ProblemItem[]
  treatments: Treatment[]
  clinicalEvents: ClinicalEvent[]
  onClose: () => void
}) {
  const grouped: Record<string, ProblemItem[]> = {}
  for (const p of problemList) {
    if (!grouped[p.category]) grouped[p.category] = []
    grouped[p.category].push(p)
  }
  const sorted = [...clinicalEvents].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div style={{ marginTop: '12px', border: '1px solid var(--color-border-medium)', borderRadius: '12px', overflow: 'hidden', background: '#FAFAFA' }}>
      {/* Panel header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'white', borderBottom: '1px solid var(--color-border)' }}>
        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-text-primary)' }}>临床事件详情 — Problem List</span>
        <button
          onClick={onClose}
          style={{ fontSize: '18px', lineHeight: 1, color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
        >×</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {/* Left: Problem List + Treatments */}
        <div style={{ borderRight: '1px solid var(--color-border)', padding: '14px 16px' }}>
          {/* Problem List */}
          {problemList.length > 0 && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: '8px' }}>
                Problem List
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: '11px', color: '#6B7280', fontWeight: 500, borderBottom: '1px solid var(--color-border-medium)' }}>诊断</th>
                    <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: '11px', color: '#6B7280', fontWeight: 500, borderBottom: '1px solid var(--color-border-medium)', whiteSpace: 'nowrap' }}>起病日期</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped).map(([cat, items]) => (
                    <>
                      <tr key={`cat-${cat}`}>
                        <td colSpan={2} style={{ padding: '8px 8px 4px', fontSize: '11px', fontWeight: 700, color: CATEGORY_COLOR[cat] ?? '#6B7280' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: CATEGORY_COLOR[cat] ?? '#6B7280', display: 'inline-block' }} />
                            {cat} ({items.length})
                          </span>
                        </td>
                      </tr>
                      {items.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '6px 8px 6px 20px', fontSize: '12px', color: 'var(--color-text-primary)' }}>{p.diagnosis}</td>
                          <td style={{ padding: '6px 8px', fontSize: '11px', color: '#9CA3AF', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{p.onsetDate}</td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Treatments */}
          {treatments.length > 0 && (
            <>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: '8px' }}>
                主要治疗方案
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: '11px', color: '#6B7280', fontWeight: 500, borderBottom: '1px solid var(--color-border-medium)' }}>用药 / 手术</th>
                    <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: '11px', color: '#6B7280', fontWeight: 500, borderBottom: '1px solid var(--color-border-medium)', whiteSpace: 'nowrap' }}>开始日期</th>
                    <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: '11px', color: '#6B7280', fontWeight: 500, borderBottom: '1px solid var(--color-border-medium)' }}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {treatments.map((t, i) => {
                    const sColor = STATUS_COLOR[t.status]
                    const TIcon = TREATMENT_ICON[t.type]
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '6px 8px', fontSize: '12px', color: 'var(--color-text-primary)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ color: '#9CA3AF', display: 'flex' }}><TIcon size={11} /></span>
                            {t.name}
                          </span>
                        </td>
                        <td style={{ padding: '6px 8px', fontSize: '11px', color: '#9CA3AF', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{t.startDate.slice(0, 10)}</td>
                        <td style={{ padding: '6px 8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: sColor + '18', color: sColor, whiteSpace: 'nowrap' }}>
                            {STATUS_LABEL[t.status]}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}

          {problemList.length === 0 && treatments.length === 0 && (
            <div style={{ fontSize: '12px', color: '#9CA3AF', padding: '16px 0' }}>暂无既往病史记录</div>
          )}
        </div>

        {/* Right: Clinical event log */}
        <div style={{ padding: '14px 16px', overflowX: 'auto' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: '8px' }}>
            临床事件记录（按时间）
          </div>
          {sorted.length === 0 ? (
            <div style={{ fontSize: '12px', color: '#9CA3AF', padding: '16px 0' }}>暂无临床事件</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: '11px', color: '#6B7280', fontWeight: 500, borderBottom: '1px solid var(--color-border-medium)', whiteSpace: 'nowrap' }}>日期</th>
                  <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: '11px', color: '#6B7280', fontWeight: 500, borderBottom: '1px solid var(--color-border-medium)', whiteSpace: 'nowrap' }}>类型</th>
                  <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: '11px', color: '#6B7280', fontWeight: 500, borderBottom: '1px solid var(--color-border-medium)' }}>描述</th>
                  <th style={{ textAlign: 'left', padding: '5px 8px', fontSize: '11px', color: '#6B7280', fontWeight: 500, borderBottom: '1px solid var(--color-border-medium)', whiteSpace: 'nowrap' }}>严重程度</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((ev, i) => {
                  const cfg = CLINICAL_CONFIG[ev.type]
                  const Ico = cfg.Icon
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                      <td style={{ padding: '6px 8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{ev.date.slice(0, 10)}</td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: cfg.bg, color: cfg.color }}>
                          <span style={{ display: 'flex' }}><Ico size={10} /></span>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '6px 8px', fontSize: '12px', color: 'var(--color-text-primary)', maxWidth: '320px' }}>{ev.description}</td>
                      <td style={{ padding: '6px 8px', fontSize: '11px', color: ev.severity === '—' ? '#D1D5DB' : cfg.color, fontWeight: ev.severity === '—' ? 400 : 600, whiteSpace: 'nowrap' }}>
                        {ev.severity === '—' ? '—' : ev.severity}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function HorizontalTimeline({
  clinicalEvents,
  trialEvents,
  enrollmentDate,
  problemList,
  treatments,
}: {
  clinicalEvents: ClinicalEvent[]
  trialEvents: TrialEvent[]
  enrollmentDate: string
  problemList: ProblemItem[]
  treatments: Treatment[]
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const allDates = [
    ...clinicalEvents.map(e => e.date),
    ...trialEvents.map(e => e.date),
    enrollmentDate,
  ].map(d => new Date(d))

  const rawMin = new Date(Math.min(...allDates.map(d => d.getTime())))
  const rawMax = new Date(Math.max(...allDates.map(d => d.getTime())))

  const minDate = new Date(rawMin.getFullYear(), rawMin.getMonth(), 1)
  const maxDate = new Date(rawMax.getFullYear(), rawMax.getMonth() + 1, 0)

  const months: { label: string; date: Date }[] = []
  const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
  while (cur <= maxDate) {
    months.push({ label: `${cur.getFullYear()}/${cur.getMonth() + 1}月`, date: new Date(cur) })
    cur.setMonth(cur.getMonth() + 1)
  }

  const totalMs = maxDate.getTime() - minDate.getTime()
  const totalPx = months.length * MONTH_WIDTH

  function getX(dateStr: string) {
    return ((new Date(dateStr).getTime() - minDate.getTime()) / totalMs) * totalPx
  }

  function showTooltip(e: React.MouseEvent, label: string, description: string, severity: string, date: string, color: string) {
    setTooltip({ text: description, severity, date, label, color, x: e.clientX + 12, y: e.clientY - 8 })
  }

  if (clinicalEvents.length === 0 && trialEvents.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: '80px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
        暂无时间轴事件
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Scrollable container */}
      <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: '4px' }}>
        <div style={{ display: 'flex', minWidth: `${LANE_LABEL_W + totalPx + 32}px` }}>

          {/* Lane labels column */}
          <div style={{ width: LANE_LABEL_W, flexShrink: 0 }}>
            <button
              onClick={() => setShowDetail(v => !v)}
              style={{
                height: LANE_H, width: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'flex-end', justifyContent: 'center', paddingRight: '12px',
                background: showDetail ? '#FFF5F5' : '#FFF8F8',
                border: 'none', borderRight: showDetail ? '3px solid #DC3545' : '3px solid #FCA5A5',
                cursor: 'pointer', transition: 'all 0.15s', gap: '4px',
              }}
              title="点击展开临床事件详情"
            >
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#DC3545', textAlign: 'right', lineHeight: 1.4 }}>临床<br />事件</span>
              <span style={{ fontSize: '10px', color: showDetail ? '#DC3545' : '#F87171', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                {showDetail ? '收起 ▲' : '详情 ▼'}
              </span>
            </button>
            <div style={{ height: '1px' }} />
            <div style={{ height: LANE_H, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '12px', background: '#F5F8FF', borderRight: '3px solid #93C5FD' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563EB', textAlign: 'right', lineHeight: 1.4 }}>临床<br />研究</span>
            </div>
            <div style={{ height: AXIS_H }} />
          </div>

          {/* Timeline body */}
          <div style={{ flex: 1, position: 'relative', paddingRight: '24px' }}>

            {/* Month gridlines + labels */}
            {months.map((_, i) => (
              <div key={i} style={{ position: 'absolute', left: i * MONTH_WIDTH, top: 0, height: LANE_H * 2 + 1, width: '1px', background: 'var(--color-border)', pointerEvents: 'none' }} />
            ))}

            {/* Clinical lane */}
            <div style={{ position: 'relative', height: LANE_H, borderBottom: '2px solid #F3F4F6' }}>
              {/* Center track */}
              <div style={{ position: 'absolute', left: 0, right: 0, top: '62%', height: '2px', background: '#FEE2E2' }} />

              {clinicalEvents.map((ev, i) => {
                const cfg = CLINICAL_CONFIG[ev.type]
                const x = getX(ev.date)
                const Ico = cfg.Icon
                const above = i % 2 === 0
                return (
                  <div
                    key={i}
                    style={{ position: 'absolute', left: x, top: 0, height: '100%', transform: 'translateX(-50%)', width: '1px' }}
                  >
                    {/* Connector line */}
                    <div style={{ position: 'absolute', left: '50%', top: above ? '8px' : '70%', bottom: above ? '38%' : '8px', width: '1px', background: cfg.color, opacity: 0.4 }} />

                    {/* Marker circle */}
                    <div
                      style={{
                        position: 'absolute', left: '50%', top: '62%', transform: 'translate(-50%, -50%)',
                        width: '18px', height: '18px', borderRadius: '50%',
                        background: cfg.bg, border: `2px solid ${cfg.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', zIndex: 2, transition: 'transform 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.3)'; showTooltip(e, cfg.label, ev.description, ev.severity, fmtDate(ev.date), cfg.color) }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'; setTooltip(null) }}
                    >
                      <span style={{ color: cfg.color, display: 'flex' }}><Ico size={9} /></span>
                    </div>

                    {/* Label (alternating above/below marker) */}
                    <div style={{
                      position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                      ...(above ? { top: '2px', bottom: '42%' } : { top: '68%', bottom: '2px' }),
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      width: '120px', marginLeft: '-60px',
                    }}>
                      <span style={{ fontSize: '9px', fontWeight: 600, color: cfg.color, textAlign: 'center', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{cfg.label}</span>
                      <span style={{ fontSize: '9px', color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.2, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.description}
                      </span>
                      <span style={{ fontSize: '9px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{fmtDate(ev.date)}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'var(--color-border)' }} />

            {/* Trial lane */}
            <div style={{ position: 'relative', height: LANE_H }}>
              {/* Center track */}
              <div style={{ position: 'absolute', left: 0, right: 0, top: '38%', height: '2px', background: '#DBEAFE' }} />

              {trialEvents.map((ev, i) => {
                const cfg = TRIAL_CONFIG[ev.type]
                const x = getX(ev.date)
                const Ico = cfg.Icon
                const above = i % 2 === 0
                return (
                  <div
                    key={i}
                    style={{ position: 'absolute', left: x, top: 0, height: '100%', transform: 'translateX(-50%)', width: '1px' }}
                  >
                    {/* Connector line */}
                    <div style={{ position: 'absolute', left: '50%', top: above ? '8px' : '46%', bottom: above ? '62%' : '8px', width: '1px', background: cfg.color, opacity: 0.4 }} />

                    {/* Marker */}
                    <div
                      style={{
                        position: 'absolute', left: '50%', top: '38%', transform: 'translate(-50%, -50%)',
                        width: '18px', height: '18px', borderRadius: ev.type === 'Enrollment' ? '4px' : '50%',
                        background: cfg.bg, border: `2px solid ${cfg.color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', zIndex: 2, transition: 'transform 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.3)'; showTooltip(e, cfg.label, ev.description, ev.severity !== '—' ? ev.severity : '', fmtDate(ev.date), cfg.color) }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'; setTooltip(null) }}
                    >
                      <span style={{ color: cfg.color, display: 'flex' }}><Ico size={9} /></span>
                    </div>

                    {/* Label */}
                    <div style={{
                      position: 'absolute', left: '50%', transform: 'translateX(-50%)',
                      ...(above ? { top: '2px', bottom: '64%' } : { top: '46%', bottom: '2px' }),
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      width: '120px', marginLeft: '-60px',
                    }}>
                      <span style={{ fontSize: '9px', fontWeight: 600, color: cfg.color, textAlign: 'center', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{cfg.label}</span>
                      <span style={{ fontSize: '9px', color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.2, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.description}
                      </span>
                      <span style={{ fontSize: '9px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{fmtDate(ev.date)}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Time axis */}
            <div style={{ height: AXIS_H, position: 'relative', borderTop: '1px solid var(--color-border-medium)' }}>
              {months.map((m, i) => (
                <div key={i} style={{ position: 'absolute', left: i * MONTH_WIDTH, top: 0, height: '100%', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', paddingLeft: '6px', whiteSpace: 'nowrap' }}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip (fixed position) */}
      {tooltip && (
        <div
          style={{
            position: 'fixed', left: tooltip.x, top: tooltip.y, zIndex: 9999,
            background: 'white', border: `1px solid ${tooltip.color}40`,
            borderLeft: `3px solid ${tooltip.color}`,
            borderRadius: '8px', padding: '10px 14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            maxWidth: '260px', pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: tooltip.color, marginBottom: '4px' }}>{tooltip.label}{tooltip.severity ? ` · ${tooltip.severity}` : ''}</div>
          <div style={{ fontSize: '12px', color: '#374151', lineHeight: 1.4 }}>{tooltip.text}</div>
          <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '5px', fontFamily: 'var(--font-mono)' }}>{tooltip.date}</div>
        </div>
      )}

      {/* Clinical detail panel (expands below timeline) */}
      {showDetail && (
        <ClinicalDetailPanel
          problemList={problemList}
          treatments={treatments}
          clinicalEvents={clinicalEvents}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  )
}

// ─── Radar chart ──────────────────────────────────────────────────────────────

function SubjectRadar({ subject }: { subject: Subject }) {
  const data = [
    { metric: '不良事件', value: Math.min(subject.aeCount / 5, 1) * 100, fullMark: 100 },
    { metric: '方案违背', value: Math.min(subject.pdCount / 4, 1) * 100, fullMark: 100 },
    { metric: '漏访次数', value: Math.min(subject.missedVisitCount / 3, 1) * 100, fullMark: 100 },
    { metric: '综合风险', value: subject.riskScore, fullMark: 100 },
  ]
  const lvl = riskLevel(subject.riskScore)
  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart data={data} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
        <PolarGrid stroke="#E5E7EB" />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#6B7280' }} />
        <Radar name={subject.subjectId} dataKey="value" stroke={lvl.color} fill={lvl.color} fillOpacity={0.2} strokeWidth={2} />
        <Tooltip formatter={(v) => [Number(v).toFixed(0), '']} contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E5E7EB' }} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ subject }: { subject: Subject }) {
  const lvl = riskLevel(subject.riskScore)
  return (
    <div>
      {/* Header card: subject info + KPIs (left) + radar (right) */}
      <div className="card mb-4" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '24px', alignItems: 'start' }}>
          {/* Left: identity + KPIs */}
          <div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-h3">{subject.subjectId}</span>
                  <span className="text-mono" style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '6px', background: lvl.bg, color: lvl.color, fontWeight: 600 }}>
                    {lvl.label}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-small" style={{ color: 'var(--color-text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Building2 size={12} />{subject.siteName}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} />入组 {fmtDate(subject.enrollmentDate)}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '40px', fontWeight: 700, color: lvl.color, fontFamily: 'SF Mono, Menlo, monospace', lineHeight: 1 }}>
                  {subject.riskScore}
                </div>
                <div className="text-small" style={{ color: 'var(--color-text-secondary)' }}>风险评分</div>
              </div>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {[
                { label: '不良事件', value: subject.aeCount, color: '#DC3545', Icon: AlertCircle },
                { label: '方案违背', value: subject.pdCount, color: '#F59E0B', Icon: ShieldAlert },
                { label: '漏访次数', value: subject.missedVisitCount, color: '#6B7280', Icon: CalendarX },
              ].map(item => (
                <div key={item.label} style={{ background: '#F8FAFB', borderRadius: '8px', padding: '10px 14px' }}>
                  <div className="flex items-center gap-1 mb-1" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                    <span style={{ color: item.color }}><item.Icon size={12} /></span>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: item.color, fontFamily: 'SF Mono, Menlo, monospace' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: radar chart */}
          <div style={{ width: '220px' }}>
            <div className="flex items-center gap-2 mb-1">
              <span style={{ color: 'var(--color-brand)' }}><Stethoscope size={13} /></span>
              <span className="text-h3" style={{ fontSize: '13px' }}>风险雷达图</span>
            </div>
            <SubjectRadar subject={subject} />
          </div>
        </div>
      </div>

      {/* Full-width prominent timeline */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div className="flex items-center gap-2 mb-4">
          <span style={{ color: 'var(--color-brand)' }}><Activity size={14} /></span>
          <span className="text-h3" style={{ fontSize: '14px' }}>事件时间轴</span>
          <div className="flex items-center gap-3 flex-wrap" style={{ marginLeft: 'auto' }}>
            {[
              { color: '#DC3545', label: '临床事件（点击泳道查看详情）' },
              { color: '#2563EB', label: '临床研究事件' },
              { color: '#F59E0B', label: '方案违背' },
              { color: '#10B981', label: '入组' },
            ].map(leg => (
              <div key={leg.label} className="flex items-center gap-1" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: leg.color }} />
                {leg.label}
              </div>
            ))}
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginLeft: '4px' }}>悬停查看事件详情</span>
          </div>
        </div>
        <HorizontalTimeline
          clinicalEvents={subject.clinicalEvents}
          trialEvents={subject.trialEvents}
          enrollmentDate={subject.enrollmentDate}
          problemList={subject.problemList}
          treatments={subject.treatments}
        />
      </div>
    </div>
  )
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function SubjectProfiles() {
  const q = useSubjectList()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(true)

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
          { label: '高风险',     value: highRisk,       color: '#DC3545' },
          { label: '中风险',     value: midRisk,        color: '#F59E0B' },
          { label: '低风险',     value: lowRisk,        color: '#10B981' },
        ].map(item => (
          <div key={item.label} className="card" style={{ padding: '16px 20px' }}>
            <div className="text-mono mb-1" style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{item.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: item.color, fontFamily: 'SF Mono, Menlo, monospace' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>
        {/* Collapsible subject list */}
        <div
          className="card"
          style={{
            flexShrink: 0,
            width: listOpen ? '288px' : '40px',
            transition: 'width 0.2s ease',
            overflow: 'hidden',
            padding: 0,
            maxHeight: 'calc(100vh - 280px)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Sidebar header with toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: listOpen ? 'space-between' : 'center',
              padding: listOpen ? '10px 14px 8px' : '10px 0',
              borderBottom: listOpen ? '1px solid var(--color-border)' : 'none',
              flexShrink: 0,
            }}
          >
            {listOpen && (
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                受试者列表 · {sorted.length}人
              </span>
            )}
            <button
              onClick={() => setListOpen(v => !v)}
              title={listOpen ? '收起列表' : '展开列表'}
              style={{
                width: '26px', height: '26px', borderRadius: '6px',
                background: 'var(--color-bg-subtle)', border: '1px solid var(--color-border)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--color-text-secondary)', flexShrink: 0, fontSize: '13px', lineHeight: 1,
              }}
            >
              {listOpen ? '←' : '→'}
            </button>
          </div>

          {/* Subject list (hidden when collapsed) */}
          {listOpen && (
            <div style={{ overflowY: 'auto', padding: '8px 12px 12px', flex: 1 }}>
              {sorted.map(s => (
                <SubjectListItem
                  key={s.subjectId}
                  subject={s}
                  selected={s.subjectId === (selectedId ?? sorted[0]?.subjectId)}
                  onSelect={() => setSelectedId(s.subjectId)}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {selected && <DetailPanel subject={selected} />}
        </div>
      </div>
    </div>
  )
}
