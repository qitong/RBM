import { useState } from 'react'
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'
import { useRiskForecast } from '../api/hooks'
import type { SiteForecast } from '../api/hooks'

const PD_THRESHOLD = 3.0

type ChartPoint = {
  month: string
  value: number | null
  forecastValue: number | null
  ciLow: number | null
  ciDelta: number | null
}

function buildChartData(site: SiteForecast): ChartPoint[] {
  const historical: ChartPoint[] = site.historicalData.map(p => ({
    month: p.month,
    value: p.value,
    forecastValue: null,
    ciLow: null,
    ciDelta: null,
  }))
  const f = site.forecast
  const forecastPoint: ChartPoint = {
    month: f.nextMonth,
    value: null,
    forecastValue: f.predictedValue,
    ciLow: f.confidenceInterval[0],
    ciDelta: +(f.confidenceInterval[1] - f.confidenceInterval[0]).toFixed(2),
  }
  return [...historical, forecastPoint]
}

function trendIcon(site: SiteForecast) {
  const last = site.historicalData[site.historicalData.length - 1].value
  const pred = site.forecast.predictedValue
  const delta = pred - last
  if (delta > 0.2) return { icon: TrendingUp, color: '#DC3545', label: '上升趋势' }
  if (delta < -0.2) return { icon: TrendingDown, color: '#10B981', label: '下降趋势' }
  return { icon: Minus, color: '#6B7280', label: '趋势平稳' }
}

function SiteSelector({ sites, selected, onChange }: {
  sites: SiteForecast[]
  selected: string
  onChange: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {sites.map(s => (
        <button
          key={s.siteId}
          onClick={() => onChange(s.siteId)}
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'SF Mono, Menlo, monospace',
            border: `1.5px solid ${selected === s.siteId ? 'var(--color-brand)' : 'var(--color-border)'}`,
            background: selected === s.siteId ? 'var(--color-brand)' : 'transparent',
            color: selected === s.siteId ? '#fff' : 'var(--color-text-primary)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {s.siteId}
        </button>
      ))}
    </div>
  )
}

function KpiRow({ site }: { site: SiteForecast }) {
  const last6 = site.historicalData.slice(-6)
  const avg = (last6.reduce((s, p) => s + p.value, 0) / last6.length).toFixed(2)
  const pred = site.forecast.predictedValue
  const ci = site.forecast.confidenceInterval
  const exceedRisk = ci[1] > PD_THRESHOLD
  const { icon: Icon, color, label } = trendIcon(site)

  return (
    <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {[
        {
          label: '6月均值',
          value: `${avg}%`,
          color: Number(avg) > PD_THRESHOLD ? '#DC3545' : '#10B981',
          sub: '历史平均 PD 率',
        },
        {
          label: '下月预测值',
          value: `${pred.toFixed(2)}%`,
          color: pred > PD_THRESHOLD ? '#DC3545' : '#10B981',
          sub: `${site.forecast.nextMonth}`,
        },
        {
          label: '95% 置信区间',
          value: `[${ci[0].toFixed(1)}, ${ci[1].toFixed(1)}]%`,
          color: exceedRisk ? '#DC3545' : '#6B7280',
          sub: exceedRisk ? '上界超过阈值' : '在安全范围内',
        },
        {
          label: '趋势',
          value: label,
          color,
          sub: `较上月 ${pred > site.historicalData[site.historicalData.length - 1].value ? '+' : ''}${(pred - site.historicalData[site.historicalData.length - 1].value).toFixed(2)}%`,
        },
      ].map(k => (
        <div key={k.label} className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'SF Mono, Menlo, monospace', marginBottom: '8px' }}>
            {k.label === '趋势'
              ? <span style={{ color: k.color }}><Icon size={13} /></span>
              : null}
            {' '}{k.label}
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: k.color, fontFamily: 'SF Mono, Menlo, monospace', lineHeight: 1, marginBottom: '4px' }}>
            {k.value}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{k.sub}</div>
        </div>
      ))}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ name: string; value: number | null; color: string }>
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
      <div style={{ fontWeight: 600, marginBottom: '6px', fontFamily: 'SF Mono, Menlo, monospace' }}>{label}</div>
      {payload.map(p => p.value != null && (
        <div key={p.name} style={{ color: p.color, marginBottom: '2px' }}>
          {p.name}: {Number(p.value).toFixed(2)}%
        </div>
      ))}
    </div>
  )
}

export default function RiskForecast() {
  const q = useRiskForecast()
  const [selectedSite, setSelectedSite] = useState<string>('')

  if (q.isLoading) return <div className="text-slate-500">加载中…</div>
  if (q.isError || !q.data) return <div className="text-red-600">无法加载风险预测数据</div>

  const sites = q.data
  const siteId = selectedSite || sites[0].siteId
  const site = sites.find(s => s.siteId === siteId) ?? sites[0]
  const chartData = buildChartData(site)
  const highRiskSites = sites.filter(s => s.forecast.predictedValue > PD_THRESHOLD)

  return (
    <div className="animate-in fade-in duration-300">
      {highRiskSites.length > 0 && (
        <div
          className="flex items-center gap-2 mb-6"
          style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#B91C1C' }}
        >
          <span><AlertTriangle size={15} /></span>
          <span>
            <strong>{highRiskSites.length} 个中心</strong>预测下月 PD 率将超过阈值 ({PD_THRESHOLD}%)：
            {highRiskSites.map(s => s.siteName).join('、')}
          </span>
        </div>
      )}

      <div className="card mb-6" style={{ padding: '20px 24px' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h3" style={{ fontSize: '14px' }}>选择研究中心</h2>
          <span className="text-mono" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            共 {sites.length} 个中心
          </span>
        </div>
        <SiteSelector sites={sites} selected={siteId} onChange={setSelectedSite} />
      </div>

      <KpiRow site={site} />

      <div className="card" style={{ padding: '20px 24px' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-h3" style={{ fontSize: '14px' }}>{site.siteName} — PD 率趋势预测</h2>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              {site.metricName} · 线性回归预测（含 95% 置信区间）
            </div>
          </div>
          <div className="flex gap-4 text-mono" style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            <span style={{ color: 'var(--color-brand)' }}>— 历史值</span>
            <span style={{ color: '#F59E0B' }}>- - 预测值</span>
            <span style={{ color: '#BAE6FD', border: '1px solid #7DD3FC', padding: '0 6px', borderRadius: '4px' }}>■ 置信区间</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 24, bottom: 0, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 'auto']} tickFormatter={(v) => `${v}%`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ display: 'none' }} />
            <ReferenceLine y={PD_THRESHOLD} stroke="#DC3545" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `阈值 ${PD_THRESHOLD}%`, position: 'right', fontSize: 11, fill: '#DC3545' }} />

            {/* CI band: transparent base + shaded delta on top */}
            <Area dataKey="ciLow" stackId="ci" stroke="none" fill="transparent" legendType="none" name="CI下界" />
            <Area dataKey="ciDelta" stackId="ci" stroke="none" fill="#BAE6FD" fillOpacity={0.6} legendType="none" name="置信区间" />

            <Line dataKey="value" stroke="var(--color-brand)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--color-brand)' }} name="历史值" connectNulls={false} />
            <Line dataKey="forecastValue" stroke="#F59E0B" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 6, fill: '#F59E0B', strokeWidth: 2, stroke: '#fff' }} name="预测值" connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="card mt-6" style={{ padding: '20px 24px' }}>
        <h2 className="text-h3 mb-4" style={{ fontSize: '14px' }}>各中心预测摘要</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['中心', '当前值 (2026-04)', '预测值 (2026-05)', '95% CI', '趋势'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: h === '中心' ? 'left' : 'right', fontSize: '11px', fontFamily: 'SF Mono, Menlo, monospace', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sites.map((s, i) => {
                const currentVal = s.historicalData[s.historicalData.length - 1].value
                const pred = s.forecast.predictedValue
                const ci = s.forecast.confidenceInterval
                const risky = pred > PD_THRESHOLD
                const { icon: Icon, color } = trendIcon(s)
                return (
                  <tr key={s.siteId} style={{ background: i % 2 === 0 ? '#F8FAFB' : '#FFFFFF', borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px', fontWeight: 500 }}>{s.siteName}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'SF Mono, Menlo, monospace' }}>{currentVal.toFixed(2)}%</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'SF Mono, Menlo, monospace', color: risky ? '#DC3545' : '#10B981', fontWeight: risky ? 700 : 400 }}>
                      {risky && <span><AlertTriangle size={11} style={{ marginRight: '4px', display: 'inline', verticalAlign: 'middle' }} /></span>}
                      {pred.toFixed(2)}%
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'SF Mono, Menlo, monospace', color: 'var(--color-text-secondary)' }}>
                      [{ci[0].toFixed(1)}, {ci[1].toFixed(1)}]%
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <span style={{ color }}><Icon size={14} /></span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
