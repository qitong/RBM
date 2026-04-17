import { Link } from 'react-router-dom'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts'
import { useBenchmark } from '../api/hooks'

export default function Benchmark() {
  const q = useBenchmark()

  if (q.isLoading) return <div className="text-slate-500">{'\u52A0\u8F7D\u4E2D\u2026'}</div>
  if (q.isError || !q.data) return <div className="text-red-600">{'\u65E0\u6CD5\u52A0\u8F7D\u57FA\u51C6\u6570\u636E'}</div>

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-3">{'\u5165\u7EC4\u8FDB\u5EA6 vs PD z-score'}</p>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <ScatterChart>
              <CartesianGrid />
              <XAxis dataKey="progressPct" name={'\u8FDB\u5EA6 %'} tick={{ fontSize: 11 }} />
              <YAxis dataKey="pdZScore" name="PD z-score" tick={{ fontSize: 11 }} />
              <ZAxis dataKey="pdTotal" range={[60, 400]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={q.data} fill="#3b82f6" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-3">{'\u4E2D\u5FC3\u6392\u540D'}</p>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left py-2">{'\u4E2D\u5FC3'}</th>
              <th className="text-right">{'\u8FDB\u5EA6 %'}</th>
              <th className="text-right">PD {'\u603B\u6570'}</th>
              <th className="text-right">PD z-score</th>
              <th className="text-right">Query {'\u603B\u6570'}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...q.data].sort((a, b) => b.pdZScore - a.pdZScore).map(r => (
              <tr key={r.siteId} className="border-t border-slate-100">
                <td className="py-2 font-medium">{r.name}</td>
                <td className="text-right">{r.progressPct}</td>
                <td className="text-right">{r.pdTotal}</td>
                <td className={`text-right ${r.pdZScore >= 2 ? 'text-red-600 font-semibold' : r.pdZScore >= 1 ? 'text-amber-600' : ''}`}>{r.pdZScore.toFixed(2)}</td>
                <td className="text-right">{r.queryTotal}</td>
                <td className="text-right"><Link to={`/sites/${r.siteId}`} className="text-primary-600 hover:underline">{'\u8BE6\u60C5'}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
