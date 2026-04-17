import { ShieldCheck, Info, Save, RotateCcw } from 'lucide-react';
import { useThresholds } from '../context/ThresholdContext';

export default function ThresholdConfig() {
  const { 
    categories, 
    updateCategory, 
    globalWarning, 
    globalAction, 
    setGlobalWarning, 
    setGlobalAction,
    saveConfigs 
  } = useThresholds();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto space-y-8 pb-12">
       {/* Global Strategy Header */}
       <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
             <h2 className="text-2xl font-bold text-slate-800">预警阈值与变异性配置</h2>
             <p className="text-slate-500">定义临床试验风险监控的统计边界与加权逻辑</p>
          </div>
          <div className="flex gap-3">
             <button 
               onClick={() => window.location.reload()}
               className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg font-semibold hover:bg-slate-50 transition"
             >
                <RotateCcw size={18} /> 重置
             </button>
             <button 
               onClick={saveConfigs}
               className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg font-bold shadow-md hover:bg-primary-700 transition"
             >
                <Save size={18} /> 保存并应用配置
             </button>
          </div>
       </header>

       {/* Global Default Section */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <section className="col-span-1 md:col-span-2 bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
             <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <ShieldCheck size={16} /> 全局默认判定策略
             </h3>
             
             <div className="space-y-8">
                {/* Warning Level */}
                <div className="flex flex-col md:flex-row md:items-center gap-6 p-4 rounded-xl bg-yellow-50/50 border border-yellow-100">
                   <div className="flex-1">
                      <h4 className="font-bold text-slate-800 flex items-center gap-2">
                         关注等级 (黄灯) <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded">Low Risk</span>
                      </h4>
                      <p className="text-sm text-slate-500 mt-1">当偏离中心均值超过此标准差时，系统将触发警告并要求现场核查原因。</p>
                   </div>
                   <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        step="0.1" 
                        value={globalWarning}
                        onChange={(e) => setGlobalWarning(parseFloat(e.target.value))}
                        className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold text-slate-700 focus:ring-2 focus:ring-primary-500/20" 
                      />
                      <span className="font-mono text-slate-400 font-bold">SD</span>
                   </div>
                </div>

                {/* Action Level */}
                <div className="flex flex-col md:flex-row md:items-center gap-6 p-4 rounded-xl bg-red-50/50 border border-red-100">
                   <div className="flex-1">
                      <h4 className="font-bold text-slate-800 flex items-center gap-2">
                         行动提示 (红灯) <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded">High Risk</span>
                      </h4>
                      <p className="text-sm text-slate-500 mt-1">严重偏离。触发该阈值需在 48 小时内提交 RCA 分析及 CAPA 整改计划。</p>
                   </div>
                   <div className="flex items-center gap-3">
                      <input 
                        type="number" 
                        step="0.1" 
                        value={globalAction}
                        onChange={(e) => setGlobalAction(parseFloat(e.target.value))}
                        className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold text-slate-700 focus:ring-2 focus:ring-primary-500/20" 
                      />
                      <span className="font-mono text-slate-400 font-bold">SD</span>
                   </div>
                </div>
             </div>
          </section>

          <aside className="bg-slate-900 rounded-2xl p-8 text-slate-300">
             <div className="p-3 bg-slate-800 rounded-xl mb-6 inline-block">
                <Info className="text-primary-400" />
             </div>
             <h3 className="text-lg font-bold text-white mb-4">统计学定义</h3>
             <p className="text-sm leading-relaxed text-slate-400 mb-6">
                基于标准化 PD 发生率 (Normalized PD Rate)，我们使用 Z-Score 计算每个站点相对于项目平均水平的偏离度。
             </p>
             <ul className="space-y-4 text-sm">
                <li className="flex gap-3">
                   <span className="text-primary-500 font-bold">•</span>
                   <span>1.0 SD: 正常波动范围</span>
                </li>
                <li className="flex gap-3">
                   <span className="text-yellow-500 font-bold">•</span>
                   <span>2.0 SD: 约 95% 置信区间外</span>
                </li>
                <li className="flex gap-3">
                   <span className="text-red-500 font-bold">•</span>
                   <span>3.0 SD: 极度显著变异</span>
                </li>
             </ul>
          </aside>
       </div>

       {/* Dimension Overrides */}
       <section>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
             <ShieldCheck size={16} /> 维度级独立配置
          </h3>
          <p className="text-sm text-slate-500 mb-6 max-w-2xl leading-relaxed">
             试验方案违背 (PD) 的各个维度具有不同的临床意义。您可以在下方调整每个维度的权重及独立阈值。
          </p>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             {categories.map(cat => (
               <div key={cat.id} className="bg-white border text-sm border-slate-200 rounded-xl p-5 shadow-sm hover:border-primary-300 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <h4 className="font-bold text-slate-800 text-base">{cat.label} ({cat.id.split(' ')[0]})</h4>
                        <p className="text-slate-400 text-xs mt-0.5">内部标识符: {cat.id}</p>
                     </div>
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={cat.enabled}
                          onChange={(e) => updateCategory(cat.id, { enabled: e.target.checked })}
                          className="sr-only peer" 
                        />
                        <div className="w-9 h-5 bg-slate-200 rounded-full peer-checked:bg-primary-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                     </label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4 py-4 border-t border-slate-50">
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-500">综合评分权重</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          step="0.01" 
                          value={cat.weight}
                          onChange={(e) => updateCategory(cat.id, { weight: parseFloat(e.target.value) })}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm font-bold text-slate-700" 
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-500">行动阈值 (SD)</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          step="0.1" 
                          value={cat.actionThreshold}
                          onChange={(e) => updateCategory(cat.id, { actionThreshold: parseFloat(e.target.value) })}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm font-bold text-red-600" 
                        />
                      </div>
                    </div>
                  </div>
               </div>
             ))}
          </div>
       </section>
    </div>
  );
}
