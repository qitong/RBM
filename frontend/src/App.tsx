import { Activity, LayoutDashboard, Settings, Filter, AlertTriangle, BarChart3, GitCompareArrows, Users, ClipboardCheck } from 'lucide-react'
import { NavLink, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { ThresholdProvider } from './context/ThresholdContext'
import GlobalDashboard from './components/GlobalDashboard'
import AlertTracking from './components/AlertTracking'
import ThresholdConfig from './components/ThresholdConfig'
import SiteDeepDive from './components/SiteDeepDive'
import Benchmark from './components/Benchmark'
import CorrelationScatter from './components/CorrelationScatter'
import InvestigatorList from './components/InvestigatorList'
import InvestigatorProfile from './components/InvestigatorProfile'
import ForecastChart from './components/ForecastChart'
import CapaEfficiency from './components/CapaEfficiency'

const TAB_TITLES: Record<string, string> = {
  '/dashboard': '全局风险大屏',
  '/alerts': '预警跟踪与闭环',
  '/thresholds': '预警阈值配置',
  '/benchmark': '中心间横向对比',
  '/correlation': 'PD \u00D7 Query \u76F8\u5173\u6027',
  '/investigators': '\u7814\u7A76\u8005\u753B\u50CF',
  '/capa': 'CAPA \u6548\u7387\u5206\u6790',
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ComponentType<{ size?: number }>; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `nav-link flex items-center gap-3 w-full px-3 py-2 transition-all duration-200 ${
          isActive ? 'active' : ''
        }`
      }
    >
      <Icon size={18} />
      <span className="font-medium">{label}</span>
    </NavLink>
  )
}

function App() {
  const location = useLocation()
  const title = TAB_TITLES[location.pathname]
    ?? (location.pathname.startsWith('/sites/') ? '\u4E2D\u5FC3\u6DF1\u5EA6\u5206\u6790'
      : location.pathname.startsWith('/investigators/') ? '\u7814\u7A76\u8005\u8BE6\u60C5'
      : location.pathname.startsWith('/forecast/') ? '\u98CE\u9669\u9884\u6D4B'
      : 'RBM')

  return (
    <ThresholdProvider>
      <div className="flex h-screen bg-white overflow-hidden">
        <nav className="w-64 bg-white flex flex-col border-r" style={{ borderColor: 'var(--color-border)' }}>
          <div className="h-16 flex items-center px-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <Activity className="mr-3" style={{ color: 'var(--color-brand)' }} size={20} />
            <span className="text-h3">RBM</span>
          </div>
          <div className="flex-1 py-6 flex flex-col gap-1 px-4">
            <p className="text-mono px-3 mb-4">功能模块</p>
            <NavItem to="/dashboard" icon={LayoutDashboard} label="全局风险大屏" />
            <NavItem to="/alerts" icon={AlertTriangle} label="预警跟踪与闭环" />
            <NavItem to="/benchmark" icon={BarChart3} label="中心间横向对比" />
            <NavItem to="/correlation" icon={GitCompareArrows} label="PD × Query 相关性" />
            <NavItem to="/investigators" icon={Users} label="研究者画像" />
            <NavItem to="/capa" icon={ClipboardCheck} label="CAPA 效率分析" />
            <div className="mt-8">
              <p className="text-mono px-3 mb-4">系统设置</p>
              <NavItem to="/thresholds" icon={Settings} label="预警阈值配置" />
            </div>
          </div>
        </nav>

        <main className="flex-1 flex flex-col h-full bg-white overflow-hidden relative">
          <header className="h-16 bg-white border-b flex items-center justify-between px-8 sticky top-0 z-10" style={{ borderColor: 'var(--color-border)' }}>
            <h1 className="text-h2">{title}</h1>
            <div className="flex items-center gap-4">
              <button className="btn-primary">
                <Filter size={16} className="mr-2" />
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
              <Route path="/investigators" element={<InvestigatorList />} />
              <Route path="/investigators/:invId" element={<InvestigatorProfile />} />
              <Route path="/forecast/:siteId" element={<ForecastChart />} />
              <Route path="/capa" element={<CapaEfficiency />} />
            </Routes>
          </div>
        </main>
      </div>
    </ThresholdProvider>
  )
}

export default App
