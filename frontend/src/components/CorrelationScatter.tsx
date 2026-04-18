import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
         ResponsiveContainer } from 'recharts'
import { useCorrelation } from '../api/hooks'

export default function CorrelationScatter() {
  const q = useCorrelation()

  if (q.isLoading) return <div className="text-slate-500">{'\u52A0\u8F7D\u4E2D\u2026'}</div>
  if (q.isError || !q.data) return <div className="text-red-600">{'\u65E0\u6CD5\u52A0\u8F7D\u76F8\u5173\u6027\u6570\u636E'}</div>

  const { points, pearson, spearman, slope, intercept } = q.data
  const merged = points.map(p => ({
    ...p,
    regrY: slope * p.pdTotal + intercept,
  }))

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-medium text-slate-500 uppercase">Pearson r</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{pearson.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
          <p className="text-xs font-medium text-slate-500 uppercase">Spearman {'\u03C1'}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{spearman.toFixed(2)}</p>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-3">{'PD \u603B\u6570 vs Query \u603B\u6570'}</p>
        <div style={{ width: '100%', height: 360 }}>
          <ResponsiveContainer>
            <ScatterChart>
              <CartesianGrid />
              <XAxis dataKey="pdTotal" name={'PD \u603B\u6570'} tick={{ fontSize: 11 }} />
              <YAxis dataKey="queryTotal" name={'Query \u603B\u6570'} tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="bg-white p-2 rounded shadow text-xs border">
                      <p className="font-bold">{d.name}</p>
                      <p>PD: {d.pdTotal} / Query: {d.queryTotal}</p>
                    </div>
                  )
                }}
              />
              <Scatter data={merged} fill="#3b82f6" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-slate-500 mt-2 italic">
          {'\u56DE\u5F52\u7EBF: y = '}{slope.toFixed(2)}x + {intercept.toFixed(2)}
        </p>
      </div>
    </div>
  )
}
