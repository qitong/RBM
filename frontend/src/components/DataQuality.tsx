import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import { AlertTriangle, CheckCircle2, FileX, Clock } from 'lucide-react'
import { useDataQuality } from '../api/hooks'
import type { SiteDataQuality } from '../api/hooks'

const DELAY_THRESHOLD = 5
const RESOLUTION_THRESHOLD = 5


function delayColor(days: number) {
  if (days > DELAY_THRESHOLD) return '#DC3545'
  if (days > 3) return '#F59E0B'
  return '#10B981'
}

function resolutionColor(days: number) {
  if (days > RESOLUTION_THRESHOLD) return '#DC3545'
  if (days > 3) return '#F59E0B'
  return '#10B981'
}

function KpiCard({ label, value, unit, icon: Icon, color }: {
  label: string; value: string | number; unit?: string
  icon: React.ComponentType<{ size?: number }>; color: string
}) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
        <span style={{ color }}><Icon size={13} /></span>
        <span className="text-mono">{label}</span>
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color, fontFamily: 'SF Mono, Menlo, monospace', lineHeight: 1 }}>
        {value}<span style={{ fontSize: '14px', fontWeight: 400, marginLeft: '4px', color: 'var(--color-text-secondary)' }}>{unit}</span>
      </div>
    </div>
  )
}

function SiteTable({ data, sortKey, onSort }: {
  data: SiteDataQuality[]
  sortKey: keyof SiteDataQuality
  onSort: (k: keyof SiteDataQuality) => void
}) {
  const cols: { key: keyof SiteDataQuality; label: string; align?: string }[] = [
    { key: 'siteName',               label: '中心名称' },
    { key: 'avgEntryDelayDays',      label: '平均录入滞后 (天)', align: 'right' },
    { key: 'totalQueriesIssued',     label: '质疑总数',           align: 'right' },
    { key: 'openQueries',            label: '未解决质疑',          align: 'right' },
    { key: 'avgQueryResolutionDays', label: '平均解决时长 (天)',   align: 'right' },
    { key: 'missingPagesCount',      label: '缺失页数',           align: 'right' },
  ]

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            {cols.map(c => (
              <th
                key={c.key}
                onClick={() => onSort(c.key)}
                style={{
                  padding: '10px 12px',
                  textAlign: (c.align as 'right' | 'left') ?? 'left',
                  fontSize: '11px',
                  fontFamily: 'SF Mono, Menlo, monospace',
                  color: sortKey === c.key ? 'var(--color-brand)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.label} {sortKey === c.key ? '↓' : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((s, i) => {
            const delayBad = s.avgEntryDelayDays > DELAY_THRESHOLD
            const resBad   = s.avgQueryResolutionDays > RESOLUTION_THRESHOLD
            return (
              <tr
                key={s.siteId}
                style={{
                  background: i % 2 === 0 ? '#F8FAFB' : '#FFFFFF',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <td style={{ padding: '12px', fontWeight: 500 }}>{s.siteName}</td>
                <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'SF Mono, Menlo, monospace', color: delayColor(s.avgEntryDelayDays), fontWeight: delayBad ? 700 : 400 }}>
                  {delayBad && <AlertTriangle size={11} style={{ marginRight: '4px', display: 'inline', verticalAlign: 'middle' }} />}
                  {s.avgEntryDelayDays.toFixed(1)}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'SF Mono, Menlo, monospace' }}>{s.totalQueriesIssued}</td>
                <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'SF Mono, Menlo, monospace', color: s.openQueries > 20 ? '#DC3545' : 'var(--color-text-primary)', fontWeight: s.openQueries > 20 ? 700 : 400 }}>
                  {s.openQueries}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'SF Mono, Menlo, monospace', color: resolutionColor(s.avgQueryResolutionDays), fontWeight: resBad ? 700 : 400 }}>
                  {resBad && <AlertTriangle size={11} style={{ marginRight: '4px', display: 'inline', verticalAlign: 'middle' }} />}
                  {s.avgQueryResolutionDays.toFixed(1)}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'SF Mono, Menlo, monospace', color: s.missingPagesCount > 0 ? '#F59E0B' : '#10B981' }}>
                  {s.missingPagesCount}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function DataQuality() {
  const q = useDataQuality()
  const [sortKey, setSortKey] = useState<keyof SiteDataQuality>('avgEntryDelayDays')

  if (q.isLoading) return <div className="text-slate-500">加载中…</div>
  if (q.isError || !q.data) return <div className="text-red-600">无法加载数据质量</div>

  const data = q.data
  const sorted = [...data].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number))

  const avgDelay = (data.reduce((s, d) => s + d.avgEntryDelayDays, 0) / data.length).toFixed(1)
  const totalOpen = data.reduce((s, d) => s + d.openQueries, 0)
  const totalIssued = data.reduce((s, d) => s + d.totalQueriesIssued, 0)
  const overallRate = Math.round((data.reduce((s, d) => s + d.resolvedQueries, 0) / totalIssued) * 100)
  const totalMissing = data.reduce((s, d) => s + d.missingPagesCount, 0)

  const delayChartData = [...data].sort((a, b) => b.avgEntryDelayDays - a.avgEntryDelayDays)
  const queryChartData = [...data].sort((a, b) => b.totalQueriesIssued - a.totalQueriesIssued)

  return (
    <div className="animate-in fade-in duration-300">
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <KpiCard label="平均录入滞后" value={avgDelay} unit="天" icon={Clock} color={Number(avgDelay) > DELAY_THRESHOLD ? '#DC3545' : '#10B981'} />
        <KpiCard label="未解决质疑" value={totalOpen} icon={AlertTriangle} color={totalOpen > 50 ? '#DC3545' : '#F59E0B'} />
        <KpiCard label="质疑解决率" value={overallRate} unit="%" icon={CheckCircle2} color={overallRate >= 90 ? '#10B981' : '#F59E0B'} />
        <KpiCard label="缺失页总数" value={totalMissing} icon={FileX} color={totalMissing > 10 ? '#DC3545' : totalMissing > 0 ? '#F59E0B' : '#10B981'} />
      </div>

      <div className="grid gap-6 mb-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h3" style={{ fontSize: '14px' }}>各中心 EDC 录入滞后天数</h2>
            <span className="text-mono" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>红线 = {DELAY_THRESHOLD}天阈值</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={delayChartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
              <XAxis dataKey="siteId" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v) => [`${Number(v).toFixed(1)} 天`, '滞后天数']}
                labelFormatter={(l) => delayChartData.find(d => d.siteId === l)?.siteName ?? l}
                contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}
              />
              <ReferenceLine y={DELAY_THRESHOLD} stroke="#DC3545" strokeDasharray="4 4" strokeWidth={1.5} />
              <Bar dataKey="avgEntryDelayDays" radius={[4, 4, 0, 0]}>
                {delayChartData.map(d => (
                  <Cell key={d.siteId} fill={delayColor(d.avgEntryDelayDays)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-h3" style={{ fontSize: '14px' }}>各中心质疑情况（已解决 vs 未解决）</h2>
            <div className="flex gap-3 text-mono" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
              <span style={{ color: '#10B981' }}>■ 已解决</span>
              <span style={{ color: '#F59E0B' }}>■ 未解决</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={queryChartData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
              <XAxis dataKey="siteId" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(l) => queryChartData.find(d => d.siteId === l)?.siteName ?? l}
                contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E5E7EB' }}
              />
              <Bar dataKey="resolvedQueries" name="已解决" stackId="q" fill="#10B981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="openQueries"     name="未解决" stackId="q" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ padding: '20px 24px' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h3" style={{ fontSize: '14px' }}>各中心数据质量明细</h2>
          <div className="flex gap-4 text-mono" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            <span style={{ color: '#DC3545' }}>■ 超阈值预警</span>
            <span style={{ color: '#F59E0B' }}>■ 需关注</span>
            <span style={{ color: '#10B981' }}>■ 正常</span>
          </div>
        </div>
        <SiteTable data={sorted} sortKey={sortKey} onSort={k => setSortKey(k)} />
      </div>
    </div>
  )
}
