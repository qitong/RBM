import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts';
import { ChevronLeft, ArrowRight, LayoutGrid, Table as TableIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useThresholds } from '../context/ThresholdContext';

const SITES = ['101', '102', '105', '201', '203', '302', '305', '401', '402', '501'];

export default function SitePDAnalysis() {
  const { categories, checkOutlier } = useThresholds();
  const navigate = useNavigate();
  const [selectedSite, setSelectedSite] = useState<string | null>(null);

  // Comparison View Data (Current Site Comparison)
  const siteComparisonData = useMemo(() => {
    return SITES.map(s => {
      const entry: any = { site: `中心 ${s}`, rawSite: s };
      categories.forEach(cat => {
        // Occurrence counts should always be positive
        entry[cat.label] = Math.max(1, Math.floor(Math.random() * 25));
      });
      return entry;
    });
  }, [categories]);

  // Site Matrix Data (Visit 1-20 x Dimension) for selected site
  const siteMatrixData = useMemo(() => {
    if (!selectedSite) return [];
    return Array.from({ length: 20 }, (_, i) => {
      const visit = i + 1;
      const entry: any = { visit: `Visit ${visit}` };
      categories.forEach(cat => {
        // Mocking NorPD values (-3.0 to 3.0)
        let base = Math.random() * 2.5;
        if (Math.random() > 0.85) base = Math.random() * 4; // Outlier
        if (Math.random() > 0.9) base = -base; // Negative outlier
        entry[cat.id] = base;
      });
      return entry;
    });
  }, [selectedSite, categories]);

  const COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
    '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'
  ];

  const handleBarClick = (data: any) => {
    // Recharts onClick on BarChart provides activePayload when a bar is clicked
    if (data && data.activePayload && data.activePayload.length > 0) {
      const payload = data.activePayload[0].payload;
      setSelectedSite(payload.rawSite);
      navigate(`/sites/${payload.rawSite}`);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm h-full flex flex-col overflow-hidden animate-in fade-in duration-300">
       <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               {selectedSite ? (
                 <>
                   <button 
                     onClick={() => setSelectedSite(null)}
                     className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition"
                   >
                      <ChevronLeft size={20} />
                   </button>
                   中心 {selectedSite} 访视详情 (NorPD Heatmap)
                 </>
               ) : '各中心 PD 发生构成 (Site Comparison)'}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
               {selectedSite 
                 ? `查看该中心在各个访视上的多维度 PD 偏离度 (双向预警)。` 
                 : '对比不同中心在各维度的 PD 堆叠分布，点击中心柱状图可下钻。'}
            </p>
          </div>
          <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
             <div className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition ${!selectedSite ? 'bg-white shadow-sm text-primary-600' : 'text-slate-400'}`}>
                <LayoutGrid size={14} /> 堆叠对比
             </div>
             {selectedSite && (
               <div className="px-3 py-1 bg-white shadow-sm rounded-md text-xs font-bold text-primary-600 flex items-center gap-1">
                  <TableIcon size={14} /> 访视矩阵
               </div>
             )}
          </div>
       </div>

       <div className="flex-1 w-full overflow-hidden flex flex-col">
          {selectedSite ? (
            <div className="flex-1 overflow-auto border border-slate-100 rounded-xl">
               <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                     <tr className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        <th className="p-3 border-b border-slate-100">访视 (Visit)</th>
                        {categories.map(cat => (
                          <th key={cat.id} className="p-3 border-b border-slate-100 text-center" title={cat.label}>
                             {cat.id.split(' ')[0]}...
                          </th>
                        ))}
                     </tr>
                  </thead>
                  <tbody className="text-[11px] font-medium">
                     {siteMatrixData.map((row) => (
                       <tr key={row.visit} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                          <td className="p-3 font-bold text-slate-600 bg-white sticky left-0 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                             {row.visit}
                          </td>
                          {categories.map(cat => {
                             const val = row[cat.id];
                             const status = checkOutlier(val, cat.id);
                             const bgColor = status === 'action' ? 'bg-red-500' : status === 'warning' ? 'bg-yellow-500' : 'bg-green-500/10';
                             const textColor = (status === 'action' || status === 'warning') ? 'text-white' : 'text-green-700';
                             
                             return (
                               <td key={cat.id} className="p-1">
                                  <div className={`${bgColor} ${textColor} text-center py-1.5 rounded-sm font-bold shadow-sm transition-transform hover:scale-105 cursor-help`} title={`${cat.label}: ${val.toFixed(2)} SD`}>
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
                     <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                     <XAxis 
                       dataKey="site" 
                       tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} 
                       axisLine={false} 
                       tickLine={false}
                     />
                     <YAxis hide />
                     <Tooltip 
                       cursor={{ fill: 'transparent' }}
                       contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                       formatter={(value) => [`${value} 次`, '发生次数']}
                     />
                     <Legend iconType="circle" />
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
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end gap-3">
             <div className="flex items-center gap-4 mr-auto text-[10px] font-bold text-slate-400 italic">
                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-sm"></div> 高偏离危险 (High/Low)</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-yellow-500 rounded-sm"></div> 关注预警</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500/20"></div> 统计正常</span>
             </div>
             <button 
               onClick={() => setSelectedSite(null)}
               className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-primary-600 hover:bg-primary-50 rounded-xl transition"
             >
                返回全局对比 <ArrowRight size={16} />
             </button>
          </div>
       )}
    </div>
  );
}
