import { Link } from 'react-router-dom'
import { Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, Area, ComposedChart, ReferenceLine } from 'recharts'
import { useBenchmark } from '../api/hooks'

export default function Benchmark() {
  const q = useBenchmark()

  if (q.isLoading) return <div className="text-slate-500">加载中…</div>
  if (q.isError || !q.data) return <div className="text-red-600">无法加载基准数据</div>

  const { points, trend } = q.data

  // Create combined data for the chart
  const allXValues = [...new Set([...points.map(p => p.progressPct), ...trend.trendLine.map(t => t.x)])].sort((a, b) => a - b)
  const extendedData = allXValues.map(x => {
    const point = points.find(p => p.progressPct === x)
    const trendPoint = trend.trendLine.find(t => Math.abs(t.x - x) < 0.5)
    const upperPoint = trend.upperBand.find(t => Math.abs(t.x - x) < 0.5)
    const lowerPoint = trend.lowerBand.find(t => Math.abs(t.x - x) < 0.5)

    return {
      progressPct: x,
      pdZScore: point?.pdZScore || null,
      pdTotal: point?.pdTotal || null,
      siteId: point?.siteId || '',
      name: point?.name || '',
      queryTotal: point?.queryTotal || null,
      trendY: trendPoint?.y || null,
      upperBound: upperPoint?.y || null,
      lowerBound: lowerPoint?.y || null,
    }
  })

  return (
    <div className="grid-cards animate-in fade-in duration-300">
      <div className="card">
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-h3">入组进度 vs PD z-score</h2>
          <div className="text-small space-y-1">
            <div>R² = {trend.r_squared}</div>
            <div>斜率: {trend.slope > 0 ? '+' : ''}{trend.slope}</div>
          </div>
        </div>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer>
            <ComposedChart data={extendedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="progressPct"
                name="进度 %"
                tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
                label={{ value: '进度 %', position: 'insideBottom', offset: -10, style: { fontSize: 12, fill: 'var(--color-text-tertiary)' } }}
              />
              <YAxis
                dataKey="pdZScore"
                name="PD z-score"
                tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
                label={{ value: 'PD z-score', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: 'var(--color-text-tertiary)' } }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const data = payload[0].payload
                  if (!data.name) return null
                  return (
                    <div className="card-minimal shadow-lg text-small">
                      <p className="text-h3 mb-2">{data.name}</p>
                      <p className="text-body">进度: {data.progressPct}%</p>
                      <p className="text-body">PD z-score: {data.pdZScore?.toFixed(2)}</p>
                      <p className="text-body">PD 总数: {data.pdTotal}</p>
                    </div>
                  )
                }}
              />

              {/* Confidence interval area */}
              <Area
                dataKey="upperBound"
                stroke="none"
                fill="var(--color-brand-wash)"
                fillOpacity={0.8}
                connectNulls={false}
              />
              <Area
                dataKey="lowerBound"
                stroke="none"
                fill="var(--color-background)"
                fillOpacity={1}
                connectNulls={false}
              />

              {/* Trend line */}
              <Line
                dataKey="trendY"
                stroke="var(--color-error)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls={false}
              />

              {/* Data points */}
              <Scatter
                data={points}
                fill="var(--color-brand)"
                opacity={0.9}
              />

              {/* Reference lines for normal range */}
              <ReferenceLine y={-2} stroke="var(--color-brand)" strokeWidth={1} strokeOpacity={0.6} strokeDasharray="2 2" />
              <ReferenceLine y={2} stroke="var(--color-brand)" strokeWidth={1} strokeOpacity={0.6} strokeDasharray="2 2" />
              <ReferenceLine y={-1} stroke="var(--color-warning)" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="1 1" />
              <ReferenceLine y={1} stroke="var(--color-warning)" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="1 1" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6 flex gap-6 text-small">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-brand)' }}></div>
            <span>数据点</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1" style={{ backgroundColor: 'var(--color-error)', borderStyle: 'dashed', borderWidth: '1px 0' }}></div>
            <span>趋势线</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 opacity-60" style={{ backgroundColor: 'var(--color-brand-light)' }}></div>
            <span>预测区间 (95%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1" style={{ backgroundColor: 'var(--color-brand)', borderStyle: 'dashed', borderWidth: '1px 0' }}></div>
            <span>正常范围 (±2σ)</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-h3 mb-6">中心排名</h2>
        <table className="table">
          <thead>
            <tr>
              <th>中心</th>
              <th className="text-right">进度 %</th>
              <th className="text-right">PD 总数</th>
              <th className="text-right">PD z-score</th>
              <th className="text-right">Query 总数</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...points].sort((a, b) => b.pdZScore - a.pdZScore).map(r => (
              <tr key={r.siteId}>
                <td className="font-medium">{r.name}</td>
                <td className="text-right">{r.progressPct}</td>
                <td className="text-right">{r.pdTotal}</td>
                <td className={`text-right ${r.pdZScore >= 2 ? 'font-semibold' : r.pdZScore >= 1 ? 'text-[var(--color-warning)]' : ''}`} style={r.pdZScore >= 2 ? { color: 'var(--color-error)' } : {}}>{r.pdZScore.toFixed(2)}</td>
                <td className="text-right">{r.queryTotal}</td>
                <td className="text-right">
                  <Link
                    to={`/sites/${r.siteId}`}
                    className="nav-link"
                  >
                    详情
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}