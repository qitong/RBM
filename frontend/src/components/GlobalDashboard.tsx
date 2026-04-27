import { useState, useMemo } from 'react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { Filter, ChevronDown, Activity, AlertTriangle, AlertCircle } from 'lucide-react';
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
    '#54e98a', '#ffb4ab', '#59d8e5', '#f59e0b', 
    '#b9d4d5', '#87f3ff', '#ffdad6', '#bbcbbb', '#2ecc71'
  ]; // Updated to match Aurora dark theme where possible

  const systemHealth = 88.5; 

  const currentCategoryLabel = useMemo(() => {
    if (selectedCategory === 'Weighted_Overall') return '综合 PD 评分 (加权)';
    return categories.find(c => c.id === selectedCategory)?.label || selectedCategory;
  }, [selectedCategory, categories]);
  void currentCategoryLabel;

  // Threshold View logic
  const currentThreshold = useMemo(() => {
    if (selectedCategory === 'Weighted_Overall') return globalAction;
    const cat = categories.find(c => c.id === selectedCategory);
    return cat ? cat.actionThreshold : globalAction;
  }, [selectedCategory, categories, globalAction]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
       {/* Page Header */}
       <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
             <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Global Risk Dashboard</h1>
             <p className="font-body-md text-body-md text-on-surface-variant">Real-time aggregate monitoring of active clinical sites and protocol deviations.</p>
          </div>
          <div className="flex gap-4">
             <button className="bg-surface-container-high border border-outline-variant text-on-surface px-4 py-2 rounded-lg font-label-md text-label-md hover:bg-surface-bright transition-colors flex items-center gap-2">
                <Filter size={18} /> Filter Scope
             </button>
             <button className="bg-primary-container text-background px-4 py-2 rounded-lg font-label-md text-label-md font-bold hover:bg-primary transition-colors flex items-center gap-2 shadow-[0_0_12px_rgba(46,204,113,0.3)]">
                <Activity size={18} /> Export Report
             </button>
          </div>
       </header>

       {/* Top Metrics Banner */}
       <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="col-span-1 md:col-span-4 bg-surface-container-low rounded-xl relative p-6 flex flex-col justify-between shadow-lg overflow-hidden group border border-outline-variant">
             <div className="absolute top-0 left-0 w-full h-[2px] card-top-border opacity-50 group-hover:opacity-100 transition-opacity"></div>
             <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                   <div className="p-1.5 bg-error-container/20 rounded-lg text-error flex items-center justify-center">
                     <AlertCircle size={18} />
                   </div>
                   <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Critical Alerts</span>
                </div>
                <span className="font-label-sm text-label-sm text-error bg-error-container/10 border border-error/20 px-2 py-0.5 rounded">+12%</span>
             </div>
             <div>
                <div className="font-headline-xl text-headline-xl text-on-surface">18</div>
                <div className="font-label-md text-label-md text-on-surface-variant mt-1">Requires immediate action</div>
             </div>
          </div>
          
          <div className="col-span-1 md:col-span-4 bg-surface-container-low rounded-xl relative p-6 flex flex-col justify-between shadow-lg overflow-hidden group border border-outline-variant">
             <div className="absolute top-0 left-0 w-full h-[2px] card-top-border opacity-50 group-hover:opacity-100 transition-opacity"></div>
             <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                   <div className="p-1.5 bg-secondary-container/20 rounded-lg text-secondary flex items-center justify-center">
                     <AlertTriangle size={18} />
                   </div>
                   <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">Sites at Risk</span>
                </div>
                <span className="font-label-sm text-label-sm text-primary-container bg-primary-container/10 border border-primary-container/20 px-2 py-0.5 rounded">-3%</span>
             </div>
             <div>
                <div className="font-headline-xl text-headline-xl text-on-surface">3<span className="text-headline-md text-on-surface-variant">/4</span></div>
                <div className="font-label-md text-label-md text-on-surface-variant mt-1">Flagged for protocol deviation</div>
             </div>
          </div>

          <div className="col-span-1 md:col-span-4 bg-surface-container-low rounded-xl relative p-6 flex flex-col justify-between shadow-lg overflow-hidden group border border-outline-variant">
             <div className="absolute top-0 left-0 w-full h-[2px] card-top-border opacity-50 group-hover:opacity-100 transition-opacity"></div>
             <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                   <div className="p-1.5 bg-primary-container/20 rounded-lg text-primary-container flex items-center justify-center">
                     <Activity size={18} />
                   </div>
                   <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">System Health</span>
                </div>
             </div>
             <div className="flex items-center gap-6 mt-1">
                <div className="font-headline-xl text-headline-xl text-primary-container">{systemHealth}%</div>
                <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
                   <div className="h-full bg-primary-container rounded-full shadow-[0_0_10px_rgba(46,204,113,0.5)]" style={{ width: `${systemHealth}%` }}></div>
                </div>
             </div>
          </div>
       </div>

       {/* Row 2: Trend & Heatmap Matrix (Resizable) */}
       <ResizableLayout initialRatio={62} minRatio={40} maxRatio={80}>
          {/* Multi-PD Trend Chart */}
          <div className="bg-surface-container-low rounded-xl p-6 relative flex flex-col h-full overflow-hidden shadow-lg border border-outline-variant/30 group">
             <div className="absolute top-0 left-0 w-full h-[2px] card-top-border opacity-50 group-hover:opacity-100 transition-opacity"></div>
             <div className="mb-6 flex justify-between items-start">
               <div>
                 <h3 className="font-headline-md text-headline-md text-on-surface">多维度 PD 趋势双向分析</h3>
                 <p className="font-body-md text-sm text-on-surface-variant mt-1">监控标准化 NorPD 的异常波动 (高报与低报风险)。</p>
               </div>
               <button className="p-2 hover:bg-surface-container-high rounded-lg text-on-surface-variant transition-colors">
                  <Filter size={20} />
               </button>
             </div>

             <div className="flex-1 w-full min-h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={visitTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#353534" />
                      <XAxis dataKey="visit" tick={{fill: '#bbcbbb', fontSize: 12}} dy={10} axisLine={false} tickLine={false} />
                      <YAxis domain={[-3.5, 3.5]} tick={{fill: '#bbcbbb', fontSize: 12}} axisLine={false} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1c1b1b', borderRadius: '8px', border: '1px solid #3d4a3e', color: '#e5e2e1' }}
                      />
                      <Legend 
                        onClick={handleLegendClick} 
                        wrapperStyle={{ paddingTop: '20px', cursor: 'pointer', color: '#e5e2e1' }} 
                        iconType="circle"
                      />
                      {/* Bidirectional Control Limit Lines */}
                      <ReferenceLine y={globalAction} stroke="#ffb4ab" strokeDasharray="3 3" label={{ position: 'right', value: '+Action', fill: '#ffb4ab', fontSize: 10 }} />
                      <ReferenceLine y={globalWarning} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'right', value: '+Warn', fill: '#f59e0b', fontSize: 10 }} />
                      <ReferenceLine y={-globalWarning} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'right', value: '-Warn', fill: '#f59e0b', fontSize: 10 }} />
                      <ReferenceLine y={-globalAction} stroke="#ffb4ab" strokeDasharray="3 3" label={{ position: 'right', value: '-Action', fill: '#ffb4ab', fontSize: 10 }} />
                      
                      {categories.map((cat, idx) => (
                         <Line 
                            key={cat.id}
                            type="monotone" 
                            dataKey={cat.id} 
                            name={cat.label}
                            stroke={COLORS[idx % COLORS.length]} 
                            strokeWidth={hiddenSeries.has(cat.id) ? 0 : 2}
                            dot={false}
                            activeDot={{ r: 6, fill: COLORS[idx % COLORS.length], stroke: '#131313', strokeWidth: 2 }}
                            hide={hiddenSeries.has(cat.id)}
                         />
                      ))}
                      <Line 
                        type="monotone" 
                        dataKey="Weighted_Overall" 
                        name="综合 PD 评分 (加权)" 
                        stroke="#e5e2e1" 
                        strokeWidth={hiddenSeries.has('Weighted_Overall') ? 0 : 3} 
                        dot={false} 
                        hide={hiddenSeries.has('Weighted_Overall')}
                      />
                   </LineChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Visit Progress Risk Matrix */}
          <div className="bg-surface-container-low rounded-xl p-6 relative flex flex-col h-full overflow-hidden shadow-lg border border-outline-variant/30 group">
             <div className="absolute top-0 left-0 w-full h-[2px] card-top-border opacity-50 group-hover:opacity-100 transition-opacity"></div>
             <h3 className="font-headline-md text-headline-md text-on-surface mb-1">访视进程风险矩阵 (双向)</h3>
             <p className="font-body-md text-sm text-on-surface-variant mb-6">高发生率由正值表示，低发生率/漏报由负值表示。</p>

             <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse min-w-[300px]">
                   <thead>
                      <tr className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider border-b border-outline-variant/30">
                         <th className="pb-3 pr-2 italic font-label-md">NorPD</th>
                         {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => (
                            <th key={p} className="pb-3 text-center px-1">{p}%</th>
                         ))}
                      </tr>
                   </thead>
                   <tbody className="text-[11px] font-bold">
                      {categories.map(cat => (
                         <tr key={cat.id} className="border-b border-outline-variant/10 group/row hover:bg-surface-container-high transition-colors">
                            <td className="py-2.5 truncate max-w-[60px] text-on-surface" title={cat.label}>{cat.id.split(' ')[0]}...</td>
                            {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(p => {
                               const cell = progressMatrix.find(m => m.category === cat.id && m.progress === p);
                               const val = cell?.value || 0;
                               // Use checkOutlier for bidirectional coloring
                               const status = checkOutlier(val, cat.id);
                               const bgColor = status === 'action' ? 'bg-error text-on-error' : status === 'warning' ? 'bg-yellow-500 text-black' : 'bg-primary-container/20 text-primary-fixed';
                               const ring = status === 'action' ? 'ring-1 ring-error/50 shadow-[0_0_8px_rgba(255,180,171,0.4)]' : '';
                               
                               return (
                                  <td key={p} className="p-0.5">
                                     <div className={`${bgColor} ${ring} rounded-sm text-center py-1.5 transition-transform group-hover/row:scale-[1.02]`}>
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
             
             <div className="mt-4 pt-4 flex items-center justify-between text-[10px] text-on-surface-variant font-bold border-t border-outline-variant/30 italic">
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-primary-container/40 rounded-sm"></div> 正常</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-yellow-500 rounded-sm"></div> 警告</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-error rounded-sm"></div> 行动</span>
                </div>
             </div>
          </div>
       </ResizableLayout>

       {/* Row 3: Site Analysis & Single-PD Threshold View (Resizable) */}
       <ResizableLayout initialRatio={62} minRatio={40} maxRatio={80}>
          <SitePDAnalysis />

          {/* Single PD Threshold Analysis */}
          <div className="bg-surface-container-low rounded-xl p-6 relative flex flex-col h-full overflow-hidden shadow-lg border border-outline-variant/30 group">
             <div className="absolute top-0 left-0 w-full h-[2px] card-top-border opacity-50 group-hover:opacity-100 transition-opacity"></div>
             <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface">各中心 PD 总评指数</h3>
                  <p className="font-body-md text-xs text-on-surface-variant mt-1">监控双向离群值波动。</p>
                </div>
                <div className="relative">
                  <select 
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="appearance-none bg-surface-container-high border border-outline-variant text-on-surface text-sm rounded-lg px-3 py-1.5 focus:border-primary-container focus:ring-1 focus:ring-primary-container outline-none pr-8 cursor-pointer font-semibold transition-colors"
                  >
                     <option value="Weighted_Overall">加权总评</option>
                     {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" size={14} />
                </div>
             </div>

             <div className="flex-1 w-full min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={visitTrends} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPD" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#54e98a" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#54e98a" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#353534" />
                      <XAxis dataKey="visit" hide />
                      <YAxis domain={[-3, 3]} axisLine={false} tickLine={false} tick={{fill: '#bbcbbb', fontSize: 10}} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1c1b1b', borderRadius: '8px', border: '1px solid #3d4a3e', color: '#e5e2e1' }}
                      />
                      {/* Bidirectional Thresholds */}
                      <ReferenceLine y={currentThreshold} stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={2} />
                      <ReferenceLine y={-currentThreshold} stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={2} />
                      
                      <Area 
                        type="monotone" 
                        dataKey={selectedCategory} 
                        stroke="#54e98a" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorPD)" 
                      />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
             
             <div className="mt-4 bg-surface-container-high p-3 rounded-xl border border-outline-variant/50 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary-container rounded-full shrink-0 shadow-[0_0_8px_rgba(46,204,113,0.6)]"></div>
                <span className="text-[11px] text-on-surface-variant font-bold italic">
                   预警范围: &plusmn;{currentThreshold.toFixed(1)} SD
                </span>
             </div>
          </div>
       </ResizableLayout>
    </div>
  );
}

