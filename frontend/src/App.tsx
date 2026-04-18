import { Activity, LayoutDashboard, Settings, Filter, AlertTriangle, BarChart3, GitCompareArrows } from 'lucide-react'
import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { ThresholdProvider } from './context/ThresholdContext'
import GlobalDashboard from './components/GlobalDashboard'
import AlertTracking from './components/AlertTracking'
import ThresholdConfig from './components/ThresholdConfig'
import SiteDeepDive from './components/SiteDeepDive'
import Benchmark from './components/Benchmark'
import CorrelationScatter from './components/CorrelationScatter'

const TAB_TITLES: Record<string, string> = {
  '/dashboard': '全局风险大屏',
  '/alerts': '预警跟踪与闭环',
  '/thresholds': '预警阈值配置',
  '/benchmark': '中心间横向对比',
  '/correlation': 'PD \u00D7 Query \u76F8\u5173\u6027',
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ size?: number }>; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200 ${
          isActive ? 'bg-primary-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'
        }`
      }
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </NavLink>
  )
}

function App() {
  const location = useLocation()
  const title = TAB_TITLES[location.pathname] ?? (location.pathname.startsWith('/sites/') ? '中心深度分析' : 'RBM')

  return (
    <ThresholdProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
        <nav className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20">
          <div className="h-16 flex items-center px-6 font-bold text-xl text-white border-b border-slate-800 tracking-tight">
            <Activity className="mr-3 text-primary-500" />
            RBM 风险监控系统
          </div>
          <div className="flex-1 py-8 flex flex-col gap-2 px-4">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">功能模块</p>
            <NavItem to="/dashboard" icon={LayoutDashboard} label="全局风险大屏" />
            <NavItem to="/alerts" icon={AlertTriangle} label="预警跟踪与闭环" />
            <NavItem to="/benchmark" icon={BarChart3} label="中心间横向对比" />
            <NavItem to="/correlation" icon={GitCompareArrows} label="PD × Query 相关性" />
            <div className="mt-8">
              <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">系统设置</p>
              <NavItem to="/thresholds" icon={Settings} label="预警阈值配置" />
            </div>
          </div>
        </nav>

        <main className="flex-1 flex flex-col h-full bg-[#f4f7f9] overflow-hidden relative">
          <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 sticky top-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-800 capitalize flex items-center gap-2">{title}</h1>
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-lg text-sm font-semibold shadow-sm transition-all focus:ring-2 focus:ring-primary-500/20">
                <Filter size={16} />
                全局筛选
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-8 relative">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<GlobalDashboard />} />
              <Route path="/alerts" element={<AlertTracking />} />
              <Route path="/thresholds" element={<ThresholdConfig />} />
              <Route path="/sites/:siteId" element={<SiteDeepDive />} />
              <Route path="/benchmark" element={<Benchmark />} />
              <Route path="/correlation" element={<CorrelationScatter />} />
            </Routes>
          </div>
        </main>
      </div>
    </ThresholdProvider>
  )
}

export default App
