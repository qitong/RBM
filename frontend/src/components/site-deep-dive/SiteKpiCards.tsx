interface Props {
  enrolled: number
  target: number
  pdTotal: number
  aeTotal: number
  openQueries: number
}

function Card({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'warn' | 'danger' }) {
  const toneCls = tone === 'danger' ? 'text-red-600' : tone === 'warn' ? 'text-amber-600' : 'text-slate-900'
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${toneCls}`}>{value}</p>
    </div>
  )
}

export default function SiteKpiCards({ enrolled, target, pdTotal, aeTotal, openQueries }: Props) {
  const pct = target > 0 ? Math.round((enrolled / target) * 100) : 0
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card label="入组进度" value={`${pct}%`} />
      <Card label="PD 总数" value={pdTotal} tone={pdTotal > 5 ? 'warn' : 'default'} />
      <Card label="AE 累计" value={aeTotal} />
      <Card label="未关闭 Query" value={openQueries} tone={openQueries > 5 ? 'danger' : 'default'} />
    </div>
  )
}
