import { Link } from 'react-router-dom'
import { useInvestigators } from '../api/hooks'

const EXP_BADGE: Record<string, string> = {
  senior: 'bg-emerald-100 text-emerald-700',
  mid: 'bg-blue-100 text-blue-700',
  junior: 'bg-amber-100 text-amber-700',
}

export default function InvestigatorList() {
  const q = useInvestigators()

  if (q.isLoading) return <div className="text-slate-500">{'\u52A0\u8F7D\u4E2D\u2026'}</div>
  if (q.isError || !q.data) return <div className="text-red-600">{'\u65E0\u6CD5\u52A0\u8F7D\u7814\u7A76\u8005\u6570\u636E'}</div>

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <p className="text-sm font-semibold text-slate-700 mb-3">{'\u7814\u7A76\u8005\u5217\u8868'}</p>
        <table className="w-full text-sm">
          <thead className="text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left py-2">ID</th>
              <th className="text-left">{'\u59D3\u540D'}</th>
              <th className="text-left">{'\u7ECF\u9A8C'}</th>
              <th className="text-left">{'\u8D1F\u8D23\u4E2D\u5FC3'}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {q.data.map(inv => (
              <tr key={inv.id} className="border-t border-slate-100">
                <td className="py-2 font-mono text-xs">{inv.id}</td>
                <td className="py-2 font-medium">{inv.name}</td>
                <td className="py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EXP_BADGE[inv.experience] ?? 'bg-slate-100 text-slate-600'}`}>
                    {inv.experience}
                  </span>
                </td>
                <td className="py-2 text-slate-600">{inv.siteIds.join(', ')}</td>
                <td className="py-2 text-right">
                  <Link to={`/investigators/${inv.id}`} className="text-primary-600 hover:underline">{'\u8BE6\u60C5'}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
