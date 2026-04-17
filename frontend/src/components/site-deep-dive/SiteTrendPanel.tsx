import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import type { SiteMetrics } from '../../api/hooks'

const PANELS: { key: keyof Pick<SiteMetrics, 'pd' | 'ae' | 'enrollment' | 'query'>; title: string; color: string }[] = [
  { key: 'pd', title: 'PD \u6708\u5EA6\u8D8B\u52BF', color: '#ef4444' },
  { key: 'ae', title: 'AE \u7D2F\u8BA1', color: '#f59e0b' },
  { key: 'enrollment', title: '\u5165\u7EC4\u66F2\u7EBF', color: '#10b981' },
  { key: 'query', title: 'Query \u54CD\u5E94', color: '#3b82f6' },
]

export default function SiteTrendPanel({ metrics }: { metrics: SiteMetrics }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {PANELS.map(p => {
        const data = metrics.timeline.map((t, i) => ({ t, v: metrics[p.key][i] }))
        return (
          <div key={p.key} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <p className="text-sm font-semibold text-slate-700 mb-3">{p.title}</p>
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer>
                <LineChart data={data}>
                  <XAxis dataKey="t" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="v" stroke={p.color} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      })}
    </div>
  )
}
