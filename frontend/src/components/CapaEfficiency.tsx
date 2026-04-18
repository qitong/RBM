import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useCapaEfficiency } from '../api/hooks'

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm text-center">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  )
}

export default function CapaEfficiency() {
  const q = useCapaEfficiency()

  if (q.isLoading) return <div className="text-slate-500">{'\u52A0\u8F7D\u4E2D\u2026'}</div>
  if (q.isError || !q.data) return <div className="text-red-600">{'\u65E0\u6CD5\u52A0\u8F7D CAPA \u6570\u636E'}</div>

  const { avgCycleTimeDays, medianCycleTimeDays, closureRate, bySite, byCategory } = q.data

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label={'\u5E73\u5747\u5468\u671F (\u5929)'} value={avgCycleTimeDays} />
        <KpiCard label={'\u4E2D\u4F4D\u6570\u5468\u671F (\u5929)'} value={medianCycleTimeDays} />
        <KpiCard label={'\u5173\u95ED\u7387'} value={`${Math.round(closureRate * 100)}%`} />
      </div>

      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-3">{'\u5404\u4E2D\u5FC3 CAPA \u5E73\u5747\u5468\u671F'}</p>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={bySite} layout="vertical">
              <CartesianGrid />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="siteId" type="category" tick={{ fontSize: 11 }} width={50} />
              <Tooltip />
              <Bar dataKey="avgCycleTimeDays" fill="#3b82f6" name={'\u5E73\u5747\u5468\u671F'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-3">{'\u5404\u7C7B\u522B CAPA \u7EDF\u8BA1'}</p>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={byCategory}>
              <CartesianGrid />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="avgCycleTimeDays" fill="#f59e0b" name={'\u5E73\u5747\u5468\u671F'} />
              <Bar dataKey="count" fill="#10b981" name={'\u6570\u91CF'} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-3">{'\u4E2D\u5FC3 CAPA \u660E\u7EC6'}</p>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left py-2">{'\u4E2D\u5FC3'}</th>
              <th className="text-right">{'\u6570\u91CF'}</th>
              <th className="text-right">{'\u5E73\u5747\u5468\u671F'}</th>
              <th className="text-right">{'\u5173\u95ED\u7387'}</th>
            </tr>
          </thead>
          <tbody>
            {bySite.map(s => (
              <tr key={s.siteId} className="border-t border-slate-100">
                <td className="py-2 font-medium">{s.siteId}</td>
                <td className="text-right">{s.count}</td>
                <td className="text-right">{s.avgCycleTimeDays}</td>
                <td className={`text-right ${s.closureRate < 0.6 ? 'text-red-600 font-semibold' : s.closureRate < 0.8 ? 'text-amber-600' : ''}`}>
                  {Math.round(s.closureRate * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
