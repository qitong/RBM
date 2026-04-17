import { useState } from 'react';
import { Activity, LayoutDashboard, Settings, Filter, AlertTriangle } from 'lucide-react';
import GlobalDashboard from './components/GlobalDashboard';
import AlertTracking from './components/AlertTracking';
import ThresholdConfig from './components/ThresholdConfig';
import { ThresholdProvider } from './context/ThresholdContext';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const TAB_TITLES: Record<string, string> = {
    dashboard: '全局风险大屏',
    alerts: '预警跟踪与闭环',
    config: '预警阈值配置'
  };

  return (
    <ThresholdProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
        {/* Sidebar Navigation */}
        <nav className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-20">
          <div className="h-16 flex items-center px-6 font-bold text-xl text-white border-b border-slate-800 tracking-tight">
            <Activity className="mr-3 text-primary-500" />
            RBM 风险监控系统
          </div>
          <div className="flex-1 py-8 flex flex-col gap-2 px-4">
            <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">功能模块</p>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200 ${
                activeTab === 'dashboard' 
                  ? 'bg-primary-600 text-white shadow-md' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <LayoutDashboard size={20} />
              <span className="font-medium">全局风险大屏</span>
            </button>
            <button 
              onClick={() => setActiveTab('alerts')}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200 ${
                activeTab === 'alerts' 
                  ? 'bg-primary-600 text-white shadow-md' 
                  : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <AlertTriangle size={20} />
              <span className="font-medium">预警跟踪与闭环</span>
            </button>
            
            <div className="mt-8">
              <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">系统设置</p>
              <button 
                onClick={() => setActiveTab('config')}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === 'config' 
                    ? 'bg-primary-600 text-white shadow-md' 
                    : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Settings size={20} />
                <span className="font-medium">预警阈值配置</span>
              </button>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-full bg-[#f4f7f9] overflow-hidden relative">
          {/* Header */}
          <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10 sticky top-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-800 capitalize flex items-center gap-2">
              {TAB_TITLES[activeTab]}
            </h1>
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 rounded-lg text-sm font-semibold shadow-sm transition-all focus:ring-2 focus:ring-primary-500/20">
                <Filter size={16} />
                全局筛选
              </button>
            </div>
          </header>

          {/* Dynamic View Panel */}
          <div className="flex-1 overflow-auto p-8 relative">
            {activeTab === 'dashboard' && <GlobalDashboard />}
            {activeTab === 'alerts' && <AlertTracking />}
            {activeTab === 'config' && <ThresholdConfig />}
          </div>
        </main>
      </div>
    </ThresholdProvider>
  );
}

export default App;
