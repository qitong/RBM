import { useState, useMemo } from 'react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { Filter, ChevronDown } from 'lucide-react';
import { progressMatrix, visitTrends } from '../data.json';
import { useThresholds } from '../context/ThresholdContext';
import SitePDAnalysis from './SitePDAnalysis';
import ResizableLayout from './ResizableLayout';

export default function GlobalDashboard() {
  const { categories, globalWarning, globalAction, checkOutlier } = useThresholds();
  const [selectedCategory, setSelectedCategory] = useState('Weighted_Overall');
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  // Interactivity: Toggle line visibility on legend click
  const handleLegendClick = (o: any) => {
    const { dataKey } = o;
    setHiddenSeries(prev => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  };

  const COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
    '#8b5cf6', '#06b6d4', '#ec4899', '#64748b', '#2563eb'
  ];

  const systemHealth = 88.5; 

  const currentCategoryLabel = useMemo(() => {
    if (selectedCategory === 'Weighted_Overall') return '综合 PD 评分 (加权)';
    return categories.find(c => c.id === selectedCategory)?.label || selectedCategory;
  }, [selectedCategory, categories]);

  // Threshold View logic
  const currentThreshold = useMemo(() => {
    if (selectedCategory === 'Weighted_Overall') return globalAction;
    const cat = categories.find(c => c.id === selectedCategory);
    return cat ? cat.actionThreshold : globalAction;
  }, [selectedCategory, categories, globalAction]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
       {/* Top Metrics Banner */}
       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
             <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">活跃项目 / 中心</span>
             <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-slate-800">4</span>
                <span className="text-2xl font-bold text-slate-300">/</span>
                <span className="text-3xl font-black text-slate-600">3</span>
             </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
             <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-2">标准化 PD 总预警</span>
             <div className="flex items-center gap-3">
                <span className="text-4xl font-black text-red-600">18</span>
                <div className="bg-red-50 text-red-600 px-2 py-1 rounded text-xs font-bold animate-pulse">需即刻干预</div>
             </div>
          </div>

          <div className="col-span-2 bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 flex items-center gap-8">
             <div className="flex-1">
                <span className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-2">系统运行健康度</span>
                <div className="text-4xl font-black text-primary-400 tracking-tighter">{systemHealth}%</div>
             </div>
             <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" style={{ width: `${systemHealth}%` }}></div>
             </div>
          </div>
       </div>

       {/* Row 2: Trend & Heatmap Matrix (Resizable) */}
       <ResizableLayout initialRatio={62} minRatio={40} maxRatio={80}>
          {/* Multi-PD Trend Chart */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
             <div className="mb-6 flex justify-between items-start">
               <div>
                 <h3 className="text-lg font-bold text-slate-800">多维度 PD 趋势双向分析</h3>
                 <p className="text-sm text-slate-500">监控标准化 NorPD 的异常波动 (高报与低报风险)。</p>
               </div>
               <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-400">
                  <Filter size={20} />
               </button>
             </div>

             <div className="flex-1 w-full min-h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={visitTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="visit" tick={{fill: '#64748b', fontSize: 12}} dy={10} axisLine={false} tickLine={false} />
                      <YAxis domain={[-3.5, 3.5]} tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend 
                        onClick={handleLegendClick} 
                        wrapperStyle={{ paddingTop: '20px', cursor: 'pointer' }} 
                        iconType="circle"
                      />
                      {/* Bidirectional Control Limit Lines */}
                      <ReferenceLine y={globalAction} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: '+Action', fill: '#ef4444', fontSize: 10 }} />
                      <ReferenceLine y={globalWarning} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'right', value: '+Warn', fill: '#f59e0b', fontSize: 10 }} />
                      <ReferenceLine y={-globalWarning} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'right', value: '-Warn', fill: '#f59e0b', fontSize: 10 }} />
                      <ReferenceLine y={-globalAction} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: '-Action', fill: '#ef4444', fontSize: 10 }} />
                      
                      {categories.map((cat, idx) => (
                         <Line 
                            key={cat.id}
                            type="monotone" 
                            dataKey={cat.id} 
                            name={cat.label}
                            stroke={COLORS[idx % COLORS.length]} 
                            strokeWidth={hiddenSeries.has(cat.id) ? 0 : 2}
                            dot={false}
                            activeDot={{ r: 6 }}
                            hide={hiddenSeries.has(cat.id)}
                         />
                      ))}
                      <Line 
                        type="monotone" 
                        dataKey="Weighted_Overall" 
                        name="综合 PD 评分 (加权)" 
                        stroke="#111827" 
                        strokeWidth={hiddenSeries.has('Weighted_Overall') ? 0 : 3} 
                        dot={false} 
                        hide={hiddenSeries.has('Weighted_Overall')}
                      />
                   </LineChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Visit Progress Risk Matrix */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
             <h3 className="text-lg font-bold text-slate-800 mb-1">访视进程风险矩阵 (双向)</h3>
             <p className="text-sm text-slate-500 mb-6">高发生率由正值表示，低发生率/漏报由负值表示。</p>

             <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse min-w-[300px]">
                   <thead>
                      <tr className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                         <th className="pb-3 pr-2 italic">NorPD</th>
                         {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => (
                            <th key={p} className="pb-3 text-center px-1">{p}%</th>
                         ))}
                      </tr>
                   </thead>
                   <tbody className="text-[11px] font-bold">
                      {categories.map(cat => (
                         <tr key={cat.id} className="border-t border-slate-50 group hover:bg-slate-50 transition">
                            <td className="py-2.5 truncate max-w-[60px]" title={cat.label}>{cat.id.split(' ')[0]}...</td>
                            {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => {
                               const cell = progressMatrix.find(m => m.category === cat.id && m.progress === p);
                               const val = cell?.value || 0;
                               // Use checkOutlier for bidirectional coloring
                               const status = checkOutlier(val, cat.id);
                               const bgColor = status === 'action' ? 'bg-red-500' : status === 'warning' ? 'bg-yellow-500' : 'bg-green-500/80';
                               
                               return (
                                  <td key={p} className="p-0.5">
                                     <div className={`${bgColor} text-white rounded-sm text-center py-1 transition-transform group-hover:scale-105 shadow-sm`}>
                                        {val.toFixed(1)}
                                     </div>
                                  </td>
                               );
                            })}
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
             
             <div className="mt-4 pt-4 flex items-center justify-between text-[10px] text-slate-400 font-bold border-t border-slate-100 italic">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-sm"></div> 正常</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-500 rounded-sm"></div> 警告</span>
                  <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-sm"></div> 行动</span>
                </div>
             </div>
          </div>
       </ResizableLayout>

       {/* Row 3: Site Analysis & Single-PD Threshold View (Resizable) */}
       <ResizableLayout initialRatio={62} minRatio={40} maxRatio={80}>
          <SitePDAnalysis />

          {/* Single PD Threshold Analysis */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
             <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight">各中心 PD 总评指数</h3>
                  <p className="text-xs text-slate-500 mt-1">监控双向离群值波动。</p>
                </div>
                <div className="relative group">
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="appearance-none bg-slate-100 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-1 focus:ring-2 focus:ring-primary-500/20 outline-none pr-7 cursor-pointer font-semibold"
                  >
                     <option value="Weighted_Overall">加权总评</option>
                     {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
             </div>

             <div className="flex-1 w-full min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={visitTrends} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPD" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="visit" hide />
                      <YAxis domain={[-3, 3]} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      {/* Bidirectional Thresholds */}
                      <ReferenceLine y={currentThreshold} stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={2} />
                      <ReferenceLine y={-currentThreshold} stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={2} />
                      
                      <Area 
                        type="monotone" 
                        dataKey={selectedCategory} 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorPD)" 
                      />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
             
             <div className="mt-4 bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary-500 rounded-full shrink-0"></div>
                <span className="text-[11px] text-slate-600 font-bold italic">
                   预警范围: &plusmn;{currentThreshold.toFixed(1)} SD
                </span>
             </div>
          </div>
       </ResizableLayout>
    </div>
  );
}
