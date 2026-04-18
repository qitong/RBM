import { useParams, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
         Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useInvestigator, useInvestigatorMetrics } from '../api/hooks'

const CATEGORY_COLORS: Record<string, string> = {
  '\u77E5\u60C5\u540C\u610F': '#3b82f6',
  '\u5165\u6392\u6807\u51C6': '#ef4444',
  '\u8BD5\u9A8C\u7528\u836F': '#10b981',
  '\u5B89\u5168\u6027\u62A5\u544A': '#f59e0b',
  '\u8BBF\u89C6\u4E0E\u68C0\u67E5': '#8b5cf6',
}

export default function InvestigatorProfile() {
  const { invId = '' } = useParams()
  const inv = useInvestigator(invId)
  const metrics = useInvestigatorMetrics(invId)

  if (inv.isLoading || metrics.isLoading) {
    return <div className="text-slate-500">{'\u52A0\u8F7D\u4E2D\u2026'}</div>
  }
  if (inv.isError || !inv.data) {
    return <div className="text-red-600">{'\u65E0\u6CD5\u52A0\u8F7D\u7814\u7A76\u8005\u4FE1\u606F'}</div>
  }

  const categoryData = metrics.data
    ? metrics.data.timeline.map((t, i) => {
        const row: Record<string, string | number> = { t }
        for (const [cat, vals] of Object.entries(metrics.data!.pdByCategory)) {
          row[cat] = vals[i]
        }
        return row
      })
    : []

  const trendData = metrics.data
    ? metrics.data.timeline.map((t, i) => ({ t, pd: metrics.data!.pdTotal[i], ae: metrics.data!.aeCounts[i] }))
    : []

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link to="/investigators" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft size={16} /> {'\u8FD4\u56DE\u5217\u8868'}
      </Link>
      <h2 className="text-2xl font-bold">{inv.data.name}</h2>
      <p className="text-slate-500 text-sm">
        {'\u7ECF\u9A8C: '}{inv.data.experience} · {'\u8D1F\u8D23\u4E2D\u5FC3: '}{inv.data.siteIds.join(', ')}
      </p>

      {metrics.data && (
        <>
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <p className="text-sm font-semibold text-slate-700 mb-3">{'PD \u5206\u7C7B\u5806\u53E0\u8D8B\u52BF'}</p>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={categoryData}>
                  <CartesianGrid />
                  <XAxis dataKey="t" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  {Object.keys(metrics.data.pdByCategory).map(cat => (
                    <Bar key={cat} dataKey={cat} stackId="pd" fill={CATEGORY_COLORS[cat] ?? '#94a3b8'} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <p className="text-sm font-semibold text-slate-700 mb-3">{'PD / AE \u6708\u5EA6\u8D8B\u52BF'}</p>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={trendData}>
                  <CartesianGrid />
                  <XAxis dataKey="t" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="pd" stroke="#ef4444" strokeWidth={2} dot={false} name="PD" />
                  <Line type="monotone" dataKey="ae" stroke="#f59e0b" strokeWidth={2} dot={false} name="AE" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
