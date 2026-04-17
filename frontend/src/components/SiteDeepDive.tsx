import { useParams, Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useSite, useSiteMetrics } from '../api/hooks'
import SiteKpiCards from './site-deep-dive/SiteKpiCards'

export default function SiteDeepDive() {
  const { siteId = '' } = useParams()
  const site = useSite(siteId)
  const metrics = useSiteMetrics(siteId)

  if (site.isLoading || metrics.isLoading) {
    return <div className="text-slate-500">加载中…</div>
  }
  if (site.isError || !site.data) {
    return <div className="text-red-600">无法加载中心信息</div>
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft size={16} /> 返回大屏
      </Link>
      <h2 className="text-2xl font-bold">{site.data.name}</h2>
      <p className="text-slate-500 text-sm">PI: {site.data.pi} · 区域: {site.data.region}</p>
      <SiteKpiCards
        enrolled={site.data.enrolled}
        target={site.data.target}
        pdTotal={metrics.data?.pd.reduce((a, b) => a + b, 0) ?? 0}
        aeTotal={metrics.data?.ae.reduce((a, b) => a + b, 0) ?? 0}
        openQueries={metrics.data?.query.at(-1) ?? 0}
      />
    </div>
  )
}
