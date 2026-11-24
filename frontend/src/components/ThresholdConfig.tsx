import { ShieldCheck, Info, Save, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { ApiError } from '../api/client';
import { postThresholdVersion, useActiveMonitoringPlan, useRbqmThresholds } from '../api/hooks';
import { useThresholds } from '../context/ThresholdContext';
import { thresholdsForReadEntry } from '../ctq/adaptApprovedPlan';
import OverdueConsentJudgment from './OverdueConsentJudgment';
import SyntheticNote from '../rbqm/SyntheticNote';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

function readError(error: unknown): string {
  if (error instanceof ApiError) {
    try {
      const parsed = JSON.parse(error.body) as { code?: string; message?: string }
      if (parsed.code) return `${parsed.code}：${parsed.message ?? ''}`.trim()
    } catch {
      return error.message
    }
    return error.message
  }
  return error instanceof Error ? error.message : '请求失败'
}

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
  const plan = useActiveMonitoringPlan();
  const versions = useRbqmThresholds();
  const queryClient = useQueryClient();
  const [versionMessage, setVersionMessage] = useState('');
  const effective = thresholdsForReadEntry(plan.data);
  const pending = plan.data?.pendingCapabilities ?? [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-[1440px] mx-auto space-y-6 relative z-10 pb-12">
       {/* Ambient background glow */}
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] pointer-events-none rounded-full"></div>

       {/* Header Section */}
       <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pb-6 border-b border-outline-variant relative z-10">
          <div className="flex items-center gap-6">
             <div>
                <h2 className="text-3xl font-bold text-on-surface">Threshold Configuration</h2>
                <p className="text-on-surface-variant mt-1">Manage global risk tolerance and define statistical boundaries for signal detection.</p>
             </div>
          </div>
          <div className="flex gap-4">
             <button 
               onClick={() => window.location.reload()}
               className="flex items-center gap-2 px-6 py-2 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container transition-colors font-medium text-sm"
             >
                <RotateCcw size={18} /> Discard Changes
             </button>
             <button 
               onClick={saveConfigs}
               className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-fixed-dim transition-colors font-medium text-sm shadow-[0_0_15px_rgba(84,233,138,0.3)]"
             >
                <Save size={18} /> Apply Configuration
             </button>
          </div>
       </header>

       <section aria-label="已生效监测计划" className="bg-surface-container-high rounded-xl p-6 border border-outline-variant/50 relative z-10">
          <div className="flex items-center gap-3 mb-3">
             <Info className="text-secondary" size={20} />
             <h2 className="text-xl font-bold text-on-surface">已生效监测计划</h2>
          </div>
             <p className="text-sm text-on-surface-variant mb-4">
             单位为 SD 的已批准规则写入对应类别的超限判断。逾期签署比例按百分比界限单独判断，不改 SD 滑块。未批准候选不改变预设。
          </p>
          {plan.isLoading && <p className="text-sm text-on-surface">正在读取已批准监测计划</p>}
          {plan.isError && (
             <p className="text-sm text-on-surface" role="alert">生效计划读取失败：{readError(plan.error)}。未显示为已生效规则。</p>
          )}
          {plan.isSuccess && effective.length === 0 && (
             <p className="text-sm text-on-surface">尚无已批准监测计划</p>
          )}
          {effective.map((row) => (
             <p key={`${row.versionId}-${row.id}`} className="text-sm text-on-surface">
                {row.id} 已生效预警 {row.warningThreshold} / 行动 {row.actionThreshold} {row.unit ?? ''} · {row.monitoringMethod} · {row.versionId} · {row.approvedBy}
                {row.appliesToSdPreset ? ' · 已写入 SD 预设' : ' · 不写入 SD 滑块'}
             </p>
          ))}
          {pending.map((item) => (
             <p key={item.id} className="text-sm text-on-surface-variant mt-3">
                独立待决能力：{item.id}（{item.status}）。{item.reason}
             </p>
          ))}
       </section>

       <OverdueConsentJudgment />

       <section aria-label="研究级与中心级阈值版本" className="bg-surface-container-high rounded-xl p-6 border border-outline-variant/50 relative z-10">
          <h2 className="text-xl font-bold text-on-surface mb-2">研究级与中心级阈值版本</h2>
          <SyntheticNote />
          <p className="text-sm text-on-surface-variant mt-2 mb-4">
             研究级 QTL 管全研究容忍限，中心级 KRI 管单个合成中心。预警阈必须小于行动阈，权重不能为负。不合格的版本不会保存。
          </p>
          {versions.data?.rules.map((rule) => (
             <p key={rule.thresholdId ?? `${rule.scope}-${rule.metric}`} className="text-sm text-on-surface">
                {rule.scope === 'study_qtl' ? '研究级 QTL' : '中心级 KRI'} · {rule.metric} · 预警 {rule.warningThreshold} / 行动 {rule.actionThreshold} {rule.unit} · {rule.configVersion}
             </p>
          ))}
          {!versions.data && <p className="text-sm text-on-surface">未读到阈值版本契约，浏览器滑块不会被当成已批准版本。</p>}
          {versionMessage && <p role="alert" className="text-sm text-on-surface mt-3">{versionMessage}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-outline-variant text-sm"
              onClick={async () => {
                try {
                  await postThresholdVersion({
                    operator: '合成质量员甲',
                    rules: [{
                      scope: 'site_kri',
                      ctqId: 'CTQ-ICF',
                      metric: 'informed_consent_sd',
                      dimension: 'INFORMED CONSENT',
                      unit: 'SD',
                      warningThreshold: 2,
                      actionThreshold: 3,
                      weight: 0.25,
                      rationale: '合成中心级 KRI，预警阈低于行动阈。',
                    }],
                  })
                  await queryClient.invalidateQueries({ queryKey: ['rbqm-thresholds'] })
                  setVersionMessage('版本已保存')
                } catch (error) {
                  setVersionMessage(readError(error))
                }
              }}
            >
              提交中心级 KRI 版本
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-outline-variant text-sm"
              onClick={async () => {
                try {
                  await postThresholdVersion({
                    operator: '合成质量员甲',
                    rules: [{
                      scope: 'site_kri',
                      ctqId: 'CTQ-ICF',
                      metric: 'informed_consent_sd',
                      dimension: 'INFORMED CONSENT',
                      unit: 'SD',
                      warningThreshold: 4,
                      actionThreshold: 3,
                      weight: -1,
                      rationale: '合成反例',
                    }],
                  })
                  setVersionMessage('版本已保存')
                } catch (error) {
                  setVersionMessage(readError(error))
                }
              }}
            >
              提交一个不合格的阈值版本
            </button>
          </div>
       </section>

       {/* Bento Grid Layout */}
       <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 relative z-10">
          {/* Global Strategy (Spans 4 cols on large screens) */}
          <section className="xl:col-span-4 flex flex-col gap-6">
             <div className="bg-surface-container-high rounded-xl p-6 border border-outline-variant/50 border-t-primary/30 relative overflow-hidden flex-1 shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full pointer-events-none"></div>
                <div className="flex items-center gap-3 mb-6 relative z-10">
                   <ShieldCheck className="text-secondary" size={24} />
                   <h2 className="text-xl font-bold text-on-surface">Global Strategy</h2>
                </div>
                
                <div className="space-y-6 relative z-10">
                   {/* Warning Level */}
                   <div className="flex flex-col gap-3 p-4 bg-surface-container rounded-lg border border-outline-variant/30">
                      <div className="flex justify-between items-start">
                         <div>
                            <div className="font-medium text-on-surface flex items-center gap-2">
                               Warning Trigger 
                               <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded font-bold">Low Risk</span>
                            </div>
                            <div className="text-sm text-on-surface-variant mt-1">Deviations exceeding this trigger warnings.</div>
                         </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                         <input 
                           type="range" min="0.5" max="3" step="0.1"
                           value={globalWarning} onChange={(e) => setGlobalWarning(parseFloat(e.target.value))}
                           className="flex-1 accent-primary" 
                         />
                         <div className="flex items-center gap-2">
                            <input 
                              type="number" step="0.1" 
                              value={globalWarning} onChange={(e) => setGlobalWarning(parseFloat(e.target.value))}
                              className="w-16 bg-surface border border-outline-variant rounded p-1 text-center text-on-surface font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm h-8" 
                            />
                            <span className="text-on-surface-variant font-medium text-sm">SD</span>
                         </div>
                      </div>
                   </div>

                   {/* Action Level */}
                   <div className="flex flex-col gap-3 p-4 bg-surface-container rounded-lg border border-outline-variant/30">
                      <div className="flex justify-between items-start">
                         <div>
                            <div className="font-medium text-on-surface flex items-center gap-2">
                               Action Trigger
                               <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded font-bold">High Risk</span>
                            </div>
                            <div className="text-sm text-on-surface-variant mt-1">Requires RCA within 48 hours.</div>
                         </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                         <input 
                           type="range" min="1.5" max="5" step="0.1"
                           value={globalAction} onChange={(e) => setGlobalAction(parseFloat(e.target.value))}
                           className="flex-1 accent-primary" 
                         />
                         <div className="flex items-center gap-2">
                            <input 
                              type="number" step="0.1" 
                              value={globalAction} onChange={(e) => setGlobalAction(parseFloat(e.target.value))}
                              className="w-16 bg-surface border border-outline-variant rounded p-1 text-center text-on-surface font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm h-8" 
                            />
                            <span className="text-on-surface-variant font-medium text-sm">SD</span>
                         </div>
                      </div>
                   </div>
                </div>
             </div>

             {/* Info Aside */}
             <div className="bg-surface-container rounded-xl p-5 border border-outline-variant/50 flex items-start gap-4 shadow-lg">
                <Info className="text-secondary shrink-0 mt-0.5" size={20} />
                <div>
                    <h3 className="text-sm font-bold text-on-surface mb-2">Statistical Definition</h3>
                    <p className="text-sm text-on-surface-variant mb-3 leading-relaxed">
                       Based on the Normalized PD Rate, we use Z-Scores to calculate the deviation of each site relative to the project average.
                    </p>
                    <ul className="space-y-2 text-xs text-on-surface-variant">
                       <li className="flex gap-2 items-center"><span className="text-primary">•</span> 1.0 SD: Normal fluctuation</li>
                       <li className="flex gap-2 items-center"><span className="text-yellow-400">•</span> 2.0 SD: Outside 95% CI</li>
                       <li className="flex gap-2 items-center"><span className="text-red-400">•</span> 3.0 SD: Extreme deviation</li>
                    </ul>
                </div>
             </div>
          </section>

          {/* Metric-Specific Thresholds (Spans 8 cols) */}
          <section className="xl:col-span-8 bg-surface-container-high rounded-xl p-6 border border-outline-variant/50 border-t-secondary/30 relative overflow-hidden shadow-lg">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                   <SlidersHorizontal className="text-secondary" size={24} />
                   <h2 className="text-xl font-bold text-on-surface">Metric-Specific Thresholds</h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                   <span className="w-2 h-2 rounded-full bg-primary inline-block"></span> Standard deviation limits
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map(cat => {
                   let badgeClass = "bg-surface-variant text-on-surface-variant border border-outline-variant";
                   let badgeText = "MODERATE";
                   if (cat.weight >= 0.8) {
                      badgeClass = "bg-error-container text-on-error-container";
                      badgeText = "CRITICAL";
                   } else if (cat.weight >= 0.6) {
                      badgeClass = "bg-tertiary-container text-on-tertiary-container";
                      badgeText = "HIGH";
                   }

                   return (
                     <div key={cat.id} className={`bg-surface-container rounded-lg p-5 border ${cat.enabled ? 'border-outline-variant hover:border-outline' : 'border-outline-variant/30 opacity-60'} transition-colors group`}>
                        <div className="flex justify-between items-start mb-4">
                           <div>
                              <div className="text-lg font-medium text-on-surface">{cat.label}</div>
                              <span className="text-xs text-on-surface-variant mt-1 inline-block">{cat.id}</span>
                           </div>
                           <div className="flex items-center gap-3">
                              <span className={`text-[10px] px-2 py-1 rounded font-bold tracking-wide ${badgeClass}`}>
                                 {badgeText}
                              </span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                 <input 
                                   type="checkbox" 
                                   checked={cat.enabled}
                                   onChange={(e) => updateCategory(cat.id, { enabled: e.target.checked })}
                                   className="sr-only peer" 
                                 />
                                 <div className="w-9 h-5 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                              </label>
                           </div>
                        </div>
                        
                        <div className="space-y-5">
                           <div>
                              <div className="flex justify-between mb-2">
                                 <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Impact Weight</label>
                                 <span className="text-sm font-medium text-on-surface">{(cat.weight * 100).toFixed(0)}%</span>
                              </div>
                              <input 
                                type="range" 
                                min="0" max="1" step="0.05"
                                value={cat.weight}
                                onChange={(e) => updateCategory(cat.id, { weight: parseFloat(e.target.value) })}
                                disabled={!cat.enabled}
                                className="w-full accent-primary" 
                              />
                           </div>
                           <div>
                              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">Deviation Trigger (SD)</label>
                              <div className="flex items-center gap-2">
                                 <button 
                                   disabled={!cat.enabled || cat.presetFromPlan}
                                   onClick={() => updateCategory(cat.id, { actionThreshold: Math.max(0, parseFloat((cat.actionThreshold - 0.1).toFixed(1))) })}
                                   className="w-8 h-8 rounded bg-surface border border-outline-variant flex items-center justify-center text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-50"
                                 >-</button>
                                 <input 
                                   type="number" step="0.1" 
                                   value={cat.actionThreshold}
                                   disabled={!cat.enabled || cat.presetFromPlan}
                                   onChange={(e) => updateCategory(cat.id, { actionThreshold: parseFloat(e.target.value) })}
                                   className="flex-1 bg-surface border border-outline-variant rounded p-2 text-center text-on-surface font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-8 disabled:opacity-50" 
                                 />
                                 <button 
                                   disabled={!cat.enabled || cat.presetFromPlan}
                                   onClick={() => updateCategory(cat.id, { actionThreshold: parseFloat((cat.actionThreshold + 0.1).toFixed(1)) })}
                                   className="w-8 h-8 rounded bg-surface border border-outline-variant flex items-center justify-center text-on-surface hover:bg-surface-variant transition-colors disabled:opacity-50"
                                 >+</button>
                              </div>
                           </div>
                        </div>
                     </div>
                   );
                })}
             </div>
          </section>
       </div>
    </div>
  );
}
