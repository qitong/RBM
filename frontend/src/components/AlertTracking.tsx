import { useState } from 'react';
import { Clock, CheckCircle, Search, ThumbsUp, X, TrendingDown, TrendingUp, MoreVertical, Building2 } from 'lucide-react';
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
    try {
      const typeTemplates = HYPOTHESES_TEMPLATES[alert?.type] || HYPOTHESES_TEMPLATES['HIGH'];
      const templates = typeTemplates[alert?.dimension] || typeTemplates['default'];
      const hypothesis = templates[Math.floor(Math.random() * templates.length)];
      setActiveRCA({ ...alert, hypothesis });
    } catch (error) {
      console.error('Error in handleStartRCA:', error);
      // Fallback
      setActiveRCA({
        ...alert,
        hypothesis: "系统正在分析此偏差的潜在根因，请稍候查看详细分析结果。"
      });
    }
  };

  const handleConfirmHypothesis = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'In Review' } : a));
    setActiveRCA(null);
  };

  const handleCompleteCAPA = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'Closed' } : a));
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-8">
        <div className="flex justify-between items-end">
          <div className="max-w-3xl">
            <h1 className="text-h1 mb-4">预警跟踪与闭环管理</h1>
            <p className="text-large leading-relaxed">
              监控、调查并解决所有活跃临床站点的安全信号。系统持续接入结构化和非结构化源数据。
            </p>
          </div>
          <div className="flex gap-4 flex-shrink-0">
            <button className="btn-secondary">
              导出PDF审计记录
            </button>
          </div>
        </div>
      </header>

      {/* Kanban Board Area - Mintlify clean grid */}
      <div className="grid-cards grid-cols-1 xl:grid-cols-3">
        {/* Column 1: 待评估 (Open) */}
        <div className="card">
          <div className="flex justify-between items-center pb-4 border-b mb-6" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="text-h3 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-error)' }}></span>
              待评估
            </h3>
            <span className="badge badge-error">
              {alerts.filter((i:any) => i.status === 'Open').length}
            </span>
          </div>
          <div className="space-y-6">
            {alerts.filter((i:any) => i.status === 'Open').map((item: any) => (
              <article key={item.id} className="card-minimal border-l-4" style={{ borderLeftColor: 'var(--color-error)' }}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2">
                    <span className={`badge ${item.type === 'HIGH' ? 'badge-error' : 'badge-warning'} flex items-center gap-1`}>
                      {item.type === 'HIGH' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {item.type === 'HIGH' ? 'High Risk' : 'Low Reporting'}
                    </span>
                    <span className="badge badge-neutral">
                      {item.id}
                    </span>
                  </div>
                  <button className="p-1 hover:bg-gray-50 rounded transition-colors">
                    <MoreVertical size={16} />
                  </button>
                </div>
                <h4 className="text-h3 mb-3">
                  {DIMENSION_LABELS[item.dimension as keyof typeof DIMENSION_LABELS]} 偏差
                </h4>
                <div className="flex items-center gap-2 mb-4 text-small">
                  <span className="flex items-center gap-1"><Building2 size={16} /> 中心 {item.site}</span>
                  <span>•</span>
                  <span>{item.project}</span>
                </div>
                <div className="mb-6 text-small">
                  偏差值:
                  <span className={`ml-1 font-semibold text-mono`} style={{ color: item.type === 'HIGH' ? 'var(--color-error)' : 'var(--color-warning)' }}>
                    {item.metricValue.toFixed(2)} SD
                  </span>
                </div>
                <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <button
                    onClick={() => {
                      console.log('Button clicked, item:', item);
                      handleStartRCA(item);
                    }}
                    className="btn-primary flex items-center gap-2"
                    type="button"
                  >
                    <Search size={18} /> 开始AI分析
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Column 2: CAPA执行 (In Review) */}
        <div className="card">
          <div className="flex justify-between items-center pb-4 border-b mb-6" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="text-h3 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-warning)' }}></span>
              CAPA执行
            </h3>
            <span className="badge badge-warning">
              {alerts.filter((i:any) => i.status === 'In Review').length}
            </span>
          </div>
          <div className="space-y-6">
            {alerts.filter((i:any) => i.status === 'In Review').map((item: any) => (
              <article key={item.id} className="card-minimal border-l-4 relative" style={{ borderLeftColor: 'var(--color-warning)' }}>
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ background: 'linear-gradient(135deg, var(--color-brand), transparent)' }}></div>
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="flex gap-2">
                    <span className="badge badge-warning flex items-center gap-1">
                      <Clock size={12} /> 进行中
                    </span>
                    <span className="badge badge-neutral">
                      {item.id}
                    </span>
                  </div>
                </div>
                <h4 className="text-h3 mb-3 relative z-10">
                  {DIMENSION_LABELS[item.dimension as keyof typeof DIMENSION_LABELS]} 解决方案
                </h4>
                <div className="flex items-center gap-2 mb-4 text-small relative z-10">
                  <span className="flex items-center gap-1"><Building2 size={16} /> 中心 {item.site}</span>
                </div>
                <div className="card-minimal text-small italic mb-6 border-l-2 relative z-10" style={{ borderLeftColor: 'var(--color-warning)' }}>
                  "{item.hypothesis}"
                </div>
                <div className="flex justify-end pt-4 border-t relative z-10" style={{ borderColor: 'var(--color-border)' }}>
                  <button
                    onClick={() => handleCompleteCAPA(item.id)}
                    className="btn-brand w-full flex justify-center items-center gap-2"
                  >
                    确认CAPA闭环
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Column 3: 审计闭环 (Closed) */}
        <div className="card opacity-80 hover:opacity-100 transition-opacity">
          <div className="flex justify-between items-center pb-4 border-b mb-6" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="text-h3 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--color-brand)' }}></span>
              审计闭环
            </h3>
            <span className="badge badge-success">
              {alerts.filter((i:any) => i.status === 'Closed').length}
            </span>
          </div>
          <div className="space-y-6">
            {alerts.filter((i:any) => i.status === 'Closed').map((item: any) => (
              <article key={item.id} className="card-minimal border-l-4 opacity-80" style={{ borderLeftColor: 'var(--color-brand)' }}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2">
                    <span className="badge badge-success flex items-center gap-1">
                      <CheckCircle size={14} /> 已解决
                    </span>
                  </div>
                  <span className="text-mono text-xs">{item.id}</span>
                </div>
                <h4 className="text-h3 mb-3 line-through opacity-60" style={{ textDecorationColor: 'var(--color-border)' }}>
                  {DIMENSION_LABELS[item.dimension as keyof typeof DIMENSION_LABELS]} 问题
                </h4>
                <div className="flex items-center gap-2 text-small opacity-60">
                  <span className="flex items-center gap-1"><Building2 size={16} /> 中心 {item.site}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* RCA Modal */}
      {activeRCA && (
        <div className="fixed inset-0 bg-black bg-opacity-20 z-50 flex items-center justify-center p-8">
          <div className="card-featured shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b flex justify-between items-start" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h3 className="text-h2 flex items-center gap-3">
                  <div className="p-2 rounded-lg shadow-lg rotate-3" style={{ backgroundColor: 'var(--color-brand)', color: 'var(--color-primary)' }}>
                    <Search size={20} />
                  </div>
                  根因分析
                </h3>
                <p className="text-mono mt-2">
                  事件 ID: {activeRCA.id} | 类型: {activeRCA.type} 异常值
                </p>
              </div>
              <button
                onClick={() => setActiveRCA(null)}
                className="p-2 rounded-full transition-colors"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-8">
              <div className="card-minimal relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: 'var(--color-brand)' }}></div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-brand)' }}></div>
                  <h4 className="text-mono" style={{ color: 'var(--color-brand)' }}>
                    AI预测引擎生成
                  </h4>
                </div>
                <p className="text-large font-medium leading-relaxed italic">
                  "{activeRCA.hypothesis}"
                </p>
              </div>

              <div className="space-y-6">
                <h4 className="text-mono">
                  下一步行动 (风险缓解)
                </h4>
                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={() => handleConfirmHypothesis(activeRCA.id)}
                    className="flex items-center gap-4 p-6 card-minimal border hover:border-gray-200 transition-all text-left group"
                  >
                    <div className="p-3 rounded-xl shadow-lg group-hover:scale-110 transition-transform" style={{ backgroundColor: 'var(--color-brand)', color: 'var(--color-primary)' }}>
                      <ThumbsUp size={20} />
                    </div>
                    <div>
                      <div className="text-h3">接受假设并启动CAPA</div>
                      <div className="text-small mt-1">
                        自动分派任务到CRM/CRC门户并进入闭环跟踪。
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-4" style={{ borderColor: 'var(--color-border)' }}>
              <button
                onClick={() => setActiveRCA(null)}
                className="btn-secondary"
              >
                忽略预测
              </button>
              <button
                onClick={() => handleConfirmHypothesis(activeRCA.id)}
                className="btn-primary active:scale-95"
              >
                确认并发出指令
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

