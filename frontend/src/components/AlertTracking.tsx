import { useMemo, useState } from 'react';
import { AlertTriangle, Clock, CheckCircle, Search, ThumbsUp, X, TrendingDown, TrendingUp } from 'lucide-react';
import { alerts as initialAlerts } from '../data.json';
import { useThresholds } from '../context/ThresholdContext';

const DIMENSION_LABELS: Record<string, string> = {
  'INFORMED CONSENT': '知情同意',
  'INCLUSION EXCLUSION': '入排标准',
  'INVESTIGATIONAL PRODUCT': '试验用药',
  'SAFETY REPORTING': '安全性报告',
  'PROCEDURES TESTS': '访视与检查',
  'VISIT SCHEDULE': '访视计划',
  'CCMEDS': '合并用药',
  'OTHER': '其他'
};

const HYPOTHESES_TEMPLATES: Record<string, any> = {
  'HIGH': {
    'INFORMED CONSENT': [
      "签署日期晚于筛选期检查日期，可能存在流程先后顺序误解。",
      "使用了旧版知情同意书，中心版本管理可能存在疏漏。",
      "由于修订补录，签署时间与实际访视时间不匹配。"
    ],
    'SAFETY REPORTING': [
      "SAE 报告延迟超过 24h，可能由于 CRC 与研究者沟通断层。",
      "AE 描述不规范，缺乏严重度分级，需加强方案培训。",
      "SAE 随访信息更新不及，存在数据积压。"
    ],
    'default': [
      "由于近期入组速度过快，中心操作趋于草率，产生系统性偏差。",
      "方案理解存在歧义，需进行全局 FAQ 答疑。",
      "录入延迟导致的逻辑验证错误。"
    ]
  },
  'LOW': {
    'SAFETY REPORTING': [
      "AE 发生率显著低于平均水平，可能由于研究者漏报或对非预期 AE 的判定标准过严。",
      "患者汇报系统 (ePRO) 同步故障，导致安全性数据缺失。",
      "中心存在恶意筛选或瞒报情况，需重点核查。"
    ],
    'INVESTIGATIONAL PRODUCT': [
      "用药偏差极低，需确认是否存在空配记录或录入造假风险。",
      "药物回收清点数据异常吻合，可能由于 CRC 代替研究者操作。"
    ],
    'default': [
      "数据上报频率异常偏低，怀疑中心监控频率缩减。",
      "原始记录可能缺失，数据采集不完整。",
      "瞒报/漏报高风险中心，建议启动现场审计。"
    ]
  }
};

export default function AlertTracking() {
  const { checkOutlier } = useThresholds();
  const [alerts, setAlerts] = useState(() => 
    initialAlerts.map((a: any) => {
      const type = a.metricValue < 0 ? 'LOW' : 'HIGH';
      const status = checkOutlier(a.metricValue, a.dimension);
      return {
        ...a,
        type,
        severity: status === 'action' ? 'Red' : 'Yellow'
      };
    })
  );

  const [activeRCA, setActiveRCA] = useState<any>(null);

  const handleStartRCA = (alert: any) => {
    const typeTemplates = HYPOTHESES_TEMPLATES[alert.type] || HYPOTHESES_TEMPLATES['HIGH'];
    const templates = typeTemplates[alert.dimension] || typeTemplates['default'];
    const hypothesis = templates[Math.floor(Math.random() * templates.length)];
    setActiveRCA({ ...alert, hypothesis });
  };

  const handleConfirmHypothesis = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'In Review' } : a));
    setActiveRCA(null);
  };

  const handleCompleteCAPA = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'Closed' } : a));
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col relative">
       <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight italic">预警跟踪与根因分析 (RCA / CAPA)</h2>
          <button className="bg-primary-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:shadow-xl transition active:scale-95">
             导出 PDF 审计日志
          </button>
       </div>

       {/* Kanban Board Layout */}
       <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
          {/* Column 1: Open */}
          <div className="bg-slate-100 rounded-2xl p-4 flex flex-col max-h-full">
             <h3 className="font-bold text-slate-700 mb-4 flex items-center justify-between">
               <span className="flex items-center gap-2"><div className="w-2 h-2 bg-red-500 rounded-full"></div> 待评估预警</span>
               <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                 {alerts.filter((i:any) => i.status === 'Open').length} EVENTS
               </span>
             </h3>
             <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                {alerts.filter((i:any) => i.status === 'Open').map((item: any) => (
                  <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/60 cursor-pointer hover:border-red-300 hover:shadow-md transition group">
                     <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-slate-400 font-mono tracking-tighter">{item.id}</span>
                        <span className={`${item.type === 'HIGH' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'} border px-2 py-0.5 rounded text-[10px] font-black flex items-center gap-1`}>
                           {item.type === 'HIGH' ? <TrendingUp size={10} /> : <TrendingDown size={10} />} 
                           {item.type === 'HIGH' ? '异常升高' : '低报/漏报风险'}
                        </span>
                     </div>
                     <h4 className="font-bold text-slate-800 text-sm mb-1">{item.project} • 中心 {item.site}</h4>
                     <p className="text-slate-500 text-[11px] mb-4">
                        {DIMENSION_LABELS[item.dimension as keyof typeof DIMENSION_LABELS]} 维度偏差: 
                        <span className={`ml-1 font-bold ${item.type === 'HIGH' ? 'text-red-500' : 'text-indigo-500'}`}>
                           {item.metricValue.toFixed(2)} SD
                        </span>
                     </p>
                     <button 
                       onClick={() => handleStartRCA(item)}
                       className="w-full py-2 bg-primary-50 hover:bg-primary-500 hover:text-white text-primary-700 text-xs font-black rounded-lg border border-primary-100 flex items-center justify-center gap-2 transition"
                     >
                       <Search size={14} /> 启动 AI 根因推演
                     </button>
                  </div>
                ))}
             </div>
          </div>

          {/* Column 2: In Review */}
          <div className="bg-slate-100 rounded-2xl p-4 flex flex-col max-h-full">
             <h3 className="font-bold text-slate-700 mb-4 flex items-center justify-between">
               <span className="flex items-center gap-2"><div className="w-2 h-2 bg-yellow-500 rounded-full"></div> CAPA 执行与干预</span>
               <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[10px] font-black">
                 {alerts.filter((i:any) => i.status === 'In Review').length} IN PROGRESS
               </span>
             </h3>
             <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                {alerts.filter((i:any) => i.status === 'In Review').map((item: any) => (
                  <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/60 cursor-pointer hover:border-yellow-300 hover:shadow-md transition">
                     <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-slate-400 font-mono italic">{item.id}</span>
                        <div className="flex gap-1">
                          <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded text-[10px] font-black flex items-center gap-1 border border-yellow-100">
                             <Clock size={10} /> 任务追踪中
                          </span>
                        </div>
                     </div>
                     <h4 className="font-bold text-slate-800 text-sm mb-1">{item.project} • 中心 {item.site}</h4>
                     <p className="text-slate-500 text-xs mb-4">{DIMENSION_LABELS[item.dimension as keyof typeof DIMENSION_LABELS]} ({item.metricValue.toFixed(1)} SD)</p>
                     <div className="bg-slate-100 p-2 rounded text-[10px] text-slate-600 italic mb-4 border-l-2 border-primary-400">
                        "{item.hypothesis?.substring(0, 40)}..."
                     </div>
                     <button 
                       onClick={() => handleCompleteCAPA(item.id)}
                       className="w-full py-2 bg-slate-900 text-white hover:bg-black text-[10px] font-black rounded-lg transition"
                     >
                       确认 CAPA 整改闭环
                     </button>
                  </div>
                ))}
             </div>
          </div>

          {/* Column 3: Closed */}
          <div className="bg-slate-200/50 rounded-2xl p-4 flex flex-col max-h-full">
             <h3 className="font-bold text-slate-400 mb-4 flex items-center justify-between">
               <span className="flex items-center gap-2"><div className="w-2 h-2 bg-slate-300 rounded-full"></div> 审计闭环</span>
             </h3>
             <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                {alerts.filter((i:any) => i.status === 'Closed').map((item: any) => (
                  <div key={item.id} className="bg-white/60 p-4 rounded-xl border border-dashed border-slate-200 grayscale">
                     <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-slate-300 font-mono tracking-tighter">{item.id}</span>
                        <span className="bg-slate-50 text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-slate-100">
                           <CheckCircle size={10} /> 已审计
                        </span>
                     </div>
                     <h4 className="font-bold text-slate-400 text-sm mb-1">{item.project} • {item.site}</h4>
                     <p className="text-slate-400 text-[10px] italic">数据已录入偏差日志并归档</p>
                  </div>
                ))}
             </div>
          </div>
       </div>

       {/* RCA Modal */}
       {activeRCA && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in slide-in-from-top-4 duration-300">
                <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                   <div>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
                         <div className="p-3 bg-primary-600 text-white rounded-2xl shadow-lg rotate-3"><Search size={28} /></div>
                         根因推演分析
                      </h3>
                      <p className="text-slate-500 mt-2 font-bold uppercase text-xs tracking-widest">
                         EVENT ID: {activeRCA.id} | TYPE: {activeRCA.type} OUTLIER
                      </p>
                   </div>
                   <button onClick={() => setActiveRCA(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition">
                      <X size={28} />
                   </button>
                </div>
                
                <div className="p-10 space-y-8">
                   <div className="bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-inner">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-ping"></div>
                        <h4 className="text-[10px] font-black text-primary-500 uppercase tracking-[0.2em]">智能假设模型生成中 (Prediction Engine)</h4>
                      </div>
                      <p className="text-xl font-bold text-slate-800 leading-snug italic">
                        "{activeRCA.hypothesis}"
                      </p>
                   </div>

                   <div className="space-y-6">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">下一步风险缓解动作 (Next Actions)</h4>
                      <div className="grid grid-cols-1 gap-4">
                         <button 
                           onClick={() => handleConfirmHypothesis(activeRCA.id)}
                           className="flex items-center gap-6 p-6 rounded-2xl border-2 border-primary-50 bg-primary-50/30 hover:bg-primary-50 hover:border-primary-200 transition text-left group elevation-hover"
                         >
                            <div className="p-4 bg-primary-600 text-white rounded-2xl shadow-xl group-hover:rotate-12 transition duration-300">
                               <ThumbsUp size={24} />
                            </div>
                            <div>
                               <div className="text-lg font-black text-primary-900">采纳推演并启动 CAPA</div>
                               <div className="text-xs text-primary-700 font-bold opacity-70">自动分发任务至 CRM/CRC 终端，进入闭环跟踪。</div>
                            </div>
                         </button>
                      </div>
                   </div>
                </div>

                <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
                   <button 
                     onClick={() => setActiveRCA(null)}
                     className="px-8 py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition"
                   >
                     忽略推断
                   </button>
                   <button 
                     onClick={() => handleConfirmHypothesis(activeRCA.id)}
                     className="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black shadow-2xl hover:bg-black transition active:scale-95 text-xs uppercase tracking-widest"
                   >
                     确认并下发指令
                   </button>
                </div>
             </div>
          </div>
       )}
    </div>
  );
}
