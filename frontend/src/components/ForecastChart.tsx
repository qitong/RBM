import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, TrendingUp, TrendingDown } from 'lucide-react'
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
         Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useForecast } from '../api/hooks'
import type { ForecastSeries } from '../api/hooks'

function buildChartData(
  historical: { timeline: string[]; values: number[] },
  forecastTimeline: string[],
  fc: ForecastSeries,
) {
  const data = historical.timeline.map((t, i) => ({
    t,
    actual: historical.values[i],
    forecast: null as number | null,
    lower: null as number | null,
    upper: null as number | null,
  }))
  forecastTimeline.forEach((t, i) => {
    data.push({
      t,
      actual: null as number | null,
      forecast: fc.forecast[i],
      lower: fc.lower[i],
      upper: fc.upper[i],
    } as any)
  })
  return data
}

export default function ForecastChart() {
  const { siteId = '' } = useParams()
  const q = useForecast(siteId)

  if (q.isLoading) return <div className="text-slate-500">{'\u52A0\u8F7D\u4E2D\u2026'}</div>
  if (q.isError || !q.data) return <div className="text-red-600">{'\u65E0\u6CD5\u52A0\u8F7D\u9884\u6D4B\u6570\u636E'}</div>

  const { historical, forecastTimeline, pd, ae } = q.data

  const pdData = buildChartData({ timeline: historical.timeline, values: historical.pd }, forecastTimeline, pd)
  const aeData = buildChartData({ timeline: historical.timeline, values: historical.ae }, forecastTimeline, ae)

  const panels = [
    { title: 'PD \u9884\u6D4B', data: pdData, color: '#ef4444', fc: pd },
    { title: 'AE \u9884\u6D4B', data: aeData, color: '#f59e0b', fc: ae },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link to={`/sites/${siteId}`} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft size={16} /> {'\u8FD4\u56DE\u4E2D\u5FC3\u8BE6\u60C5'}
      </Link>

      {panels.map(p => (
        <div key={p.title} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm font-semibold text-slate-700">{p.title}</p>
            {p.fc.slope > 0
              ? <TrendingUp size={16} className="text-red-500" />
              : <TrendingDown size={16} className="text-emerald-500" />}
            <span className="text-xs text-slate-500">
              {'\u659C\u7387: '}{p.fc.slope.toFixed(2)}
            </span>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <ComposedChart data={p.data}>
                <CartesianGrid />
                <XAxis dataKey="t" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="actual" stroke={p.color} strokeWidth={2} dot={false} name={'\u5B9E\u9645'} />
                <Line type="monotone" dataKey="forecast" stroke={p.color} strokeWidth={2} strokeDasharray="6 3" dot={false} name={'\u9884\u6D4B'} />
                <Area type="monotone" dataKey="upper" stroke="none" fill={p.color} fillOpacity={0.1} name={'\u4E0A\u754C'} />
                <Area type="monotone" dataKey="lower" stroke="none" fill={p.color} fillOpacity={0.05} name={'\u4E0B\u754C'} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  )
}
