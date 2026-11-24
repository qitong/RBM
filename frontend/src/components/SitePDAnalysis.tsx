import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { ChevronLeft, ArrowRight, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useThresholds } from '../context/ThresholdContext';
import { useRbqmSiteComparison } from '../api/hooks';
import SyntheticNote from '../rbqm/SyntheticNote';

export default function SitePDAnalysis() {
  const { categories, checkOutlier } = useThresholds();
  const comparison = useRbqmSiteComparison();
  const navigate = useNavigate();
  const [selectedSite, setSelectedSite] = useState<string | null>(null);

  const siteComparisonData = useMemo(() => {
    return (comparison.data?.points ?? []).map((point) => ({
      site: point.siteId,
      rawSite: point.siteId,
      ...point.counts,
    }));
  }, [comparison.data]);

  const siteMatrixData = useMemo(() => {
    if (!selectedSite || !comparison.data) return [];
    return comparison.data.visits[selectedSite] ?? [];
  }, [selectedSite, comparison.data]);

  const COLORS = [
    '#54e98a', '#ffb4ab', '#59d8e5', '#f59e0b', 
    '#b9d4d5', '#87f3ff', '#ffdad6', '#bbcbbb'
  ];

  const handleBarClick = (data: any) => {
    // Recharts onClick on BarChart provides activePayload when a bar is clicked
    if (data && data.activePayload && data.activePayload.length > 0) {
      const payload = data.activePayload[0].payload;
      setSelectedSite(payload.rawSite);
      navigate(`/sites/${payload.rawSite}`);
    }
  };

  if (comparison.isLoading) {
    return <div className="text-slate-500">加载中…</div>
  }
  if (comparison.isError || !comparison.data) {
    return <div role="alert">中心对比接口不可用，未用随机数填补。</div>
  }

  return (
    <div data-synthetic="true" className="bg-surface-container-low rounded-xl p-6 relative flex flex-col h-full overflow-hidden shadow-lg border border-outline-variant/30 group animate-in fade-in duration-300">
       <div className="absolute top-0 left-0 w-full h-[2px] card-top-border opacity-50 group-hover:opacity-100 transition-opacity"></div>
       <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
               {selectedSite ? (
                 <>
                   <button 
                     onClick={() => setSelectedSite(null)}
                     className="p-1 hover:bg-surface-container-high rounded-lg text-on-surface-variant transition-colors"
                   >
                      <ChevronLeft size={20} />
                   </button>
                   中心 {selectedSite} 访视详情 (NorPD Heatmap)
                 </>
               ) : '各中心 PD 发生构成 (Site Comparison)'}
            </h3>
            <SyntheticNote />
            <ul>
              {(comparison.data?.points ?? []).map((point) => (
                <li key={point.siteId}>{point.siteId}</li>
              ))}
            </ul>
            <p className="font-body-md text-sm text-on-surface-variant mt-1">
               {selectedSite 
                 ? `查看该中心在各个访视上的多维度 PD 偏离度 (双向预警)。` 
                 : '对比不同中心在各维度的 PD 堆叠分布，点击中心柱状图可下钻。'}
            </p>
          </div>
          <div className="bg-surface-container-high p-1 rounded-lg flex gap-1 border border-outline-variant/50">
             <div className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-colors ${!selectedSite ? 'bg-primary-container text-on-primary-container shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}>
                <LayoutGrid size={14} /> 堆叠对比
             </div>
             {selectedSite && (
               <div className="px-3 py-1 bg-primary-container shadow-sm rounded-md text-xs font-bold text-on-primary-container flex items-center gap-1">
                  <TableIcon size={14} /> 访视矩阵
               </div>
             )}
          </div>
       </div>

       <div className="flex-1 w-full overflow-hidden flex flex-col">
          {selectedSite ? (
            <div className="flex-1 overflow-auto border border-outline-variant/30 rounded-xl">
               <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead className="sticky top-0 bg-surface-container-highest z-10 shadow-sm">
                     <tr className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
                        <th className="p-3 border-b border-outline-variant/30">访视 (Visit)</th>
                        {categories.map(cat => (
                          <th key={cat.id} className="p-3 border-b border-outline-variant/30 text-center" title={cat.label}>
                             {cat.id.split(' ')[0]}...
                          </th>
                        ))}
                     </tr>
                  </thead>
                  <tbody className="text-[11px] font-medium">
                     {siteMatrixData.map((row) => (
                       <tr key={String(row.visit)} className="border-b border-outline-variant/10 hover:bg-surface-container-high/50 transition-colors group/row">
                          <td className="p-3 font-bold text-on-surface bg-surface-container-low group-hover/row:bg-surface-container-high/50 sticky left-0 shadow-[2px_0_5px_rgba(0,0,0,0.2)] transition-colors">
                             {row.visit}
                          </td>
                          {categories.map(cat => {
                             const val = Number(row[cat.id] ?? 0);
                             const status = checkOutlier(val, cat.id);
                             const bgColor = status === 'action' ? 'bg-error text-on-error' : status === 'warning' ? 'bg-yellow-500 text-black' : 'bg-primary-container/20 text-primary-fixed';
                             const ring = status === 'action' ? 'ring-1 ring-error/50 shadow-[0_0_8px_rgba(255,180,171,0.4)]' : '';
                             
                             return (
                               <td key={cat.id} className="p-1">
                                  <div className={`${bgColor} ${ring} text-center py-1.5 rounded-sm font-bold shadow-sm transition-transform hover:scale-105 cursor-help`} title={`${cat.label}: ${val.toFixed(2)} SD`}>
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
          ) : (
            <div className="h-full w-full min-h-[350px]">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                     data={siteComparisonData}
                     margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                     onClick={handleBarClick}
                  >
                     <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#353534" />
                     <XAxis 
                       dataKey="site" 
                       tick={{ fill: '#bbcbbb', fontSize: 12, fontWeight: 500 }} 
                       axisLine={false} 
                       tickLine={false}
                     />
                     <YAxis hide />
                     <Tooltip 
                       cursor={{ fill: '#353534', opacity: 0.4 }}
                       contentStyle={{ backgroundColor: '#1c1b1b', borderRadius: '8px', border: '1px solid #3d4a3e', color: '#e5e2e1' }}
                       formatter={(value) => [`${value} 次`, '发生次数']}
                     />
                     <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', color: '#e5e2e1' }} />
                     {categories.map((cat, idx) => (
                        <Bar 
                          key={cat.id} 
                          dataKey={cat.label} 
                          stackId="a" 
                          fill={COLORS[idx % COLORS.length]} 
                          radius={idx === categories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                          className="cursor-pointer hover:opacity-80 transition-opacity"
                        />
                     ))}
                  </BarChart>
               </ResponsiveContainer>
            </div>
          )}
       </div>

       {selectedSite && (
          <div className="mt-4 pt-4 border-t border-outline-variant/30 flex justify-end gap-3">
             <div className="flex items-center gap-4 mr-auto text-[10px] font-bold text-on-surface-variant italic">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-error rounded-sm"></div> 高偏离危险 (High/Low)</span>
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-yellow-500 rounded-sm"></div> 关注预警</span>
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 bg-primary-container/40 rounded-sm"></div> 统计正常</span>
             </div>
             <button 
               onClick={() => setSelectedSite(null)}
               className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-primary-fixed hover:bg-primary-container/20 rounded-xl transition-colors"
             >
                返回全局对比 <ArrowRight size={16} />
             </button>
          </div>
       )}
    </div>
  );
}
