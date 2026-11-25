import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useActiveMonitoringPlan } from '../api/hooks';
import { adaptApprovedPlan, applyApprovedPresets } from '../ctq/adaptApprovedPlan';
import { SYNTHETIC_OVERDUE_CONSENT } from '../ctq/syntheticOverdueConsent';

export interface CategoryConfig {
  id: string;
  label: string;
  weight: number;
  warningThreshold: number; // e.g. 2.0 SD
  actionThreshold: number;  // e.g. 3.0 SD
  enabled: boolean;
  presetFromPlan?: boolean;
}

interface ThresholdContextType {
  categories: CategoryConfig[];
  updateCategory: (id: string, updates: Partial<CategoryConfig>) => void;
  globalWarning: number;
  globalAction: number;
  setGlobalWarning: (val: number) => void;
  setGlobalAction: (val: number) => void;
  saveConfigs: () => void;
  checkOutlier: (value: number, categoryId?: string) => 'action' | 'warning' | 'normal';
  checkApprovedMetric: (value: number, candidateId: string) => 'action' | 'warning' | 'normal' | null;
}

const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { id: 'INFORMED CONSENT', label: '知情同意', weight: 0.25, warningThreshold: 2.0, actionThreshold: 3.0, enabled: true },
  { id: 'INCLUSION EXCLUSION', label: '入排标准', weight: 0.15, warningThreshold: 2.0, actionThreshold: 3.0, enabled: true },
  { id: 'INVESTIGATIONAL PRODUCT', label: '试验用药', weight: 0.15, warningThreshold: 2.0, actionThreshold: 3.0, enabled: true },
  { id: 'SAFETY REPORTING', label: '安全性报告', weight: 0.25, warningThreshold: 2.0, actionThreshold: 3.0, enabled: true },
  { id: 'PROCEDURES TESTS', label: '访视与检查', weight: 0.05, warningThreshold: 2.0, actionThreshold: 3.0, enabled: true },
  { id: 'VISIT SCHEDULE', label: '访视计划', weight: 0.05, warningThreshold: 2.0, actionThreshold: 3.0, enabled: true },
  { id: 'CCMEDS', label: '合并用药', weight: 0.05, warningThreshold: 2.0, actionThreshold: 3.0, enabled: true },
  { id: 'OTHER', label: '其他', weight: 0.05, warningThreshold: 2.0, actionThreshold: 3.0, enabled: true }
];

const ThresholdContext = createContext<ThresholdContextType | undefined>(undefined);

export const ThresholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<CategoryConfig[]>(DEFAULT_CATEGORIES);
  const [globalWarning, setGlobalWarning] = useState(2.0);
  const [globalAction, setGlobalAction] = useState(3.0);
  const planQuery = useActiveMonitoringPlan();
  const approvedPlan = planQuery.data?.active ?? null;

  // Non-approved fields may still come from this browser. Approved warning and
  // action values are applied afterwards from the local plan file.
  useEffect(() => {
    const saved = localStorage.getItem('rbm_threshold_configs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.categories?.length) setCategories(parsed.categories);
        if (parsed.globalWarning) setGlobalWarning(parsed.globalWarning);
        if (parsed.globalAction) setGlobalAction(parsed.globalAction);
      } catch (e) {
        console.error("Failed to parse saved thresholds", e);
      }
    }
  }, []);

  const resolvedCategories = useMemo(
    () => applyApprovedPresets(categories, approvedPlan, DEFAULT_CATEGORIES),
    [categories, approvedPlan],
  );
  const approvedMetrics = useMemo(() => adaptApprovedPlan(approvedPlan), [approvedPlan]);

  const updateCategory = (id: string, updates: Partial<CategoryConfig>) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id !== id) return cat;
      const next = { ...updates };
      if (approvedPlan && applyApprovedPresets([cat], approvedPlan)[0].presetFromPlan) {
        delete next.warningThreshold;
        delete next.actionThreshold;
      }
      return { ...cat, ...next };
    }));
  };

  const saveConfigs = () => {
    localStorage.setItem('rbm_threshold_configs', JSON.stringify({
      categories,
      globalWarning,
      globalAction,
    }));
    alert("配置已成功保存并应用！");
  };

  // Bidirectional outlier check: abs(value) >= threshold
  const checkOutlier = (value: number, categoryId?: string): 'action' | 'warning' | 'normal' => {
    const absVal = Math.abs(value);
    let action = globalAction;
    let warning = globalWarning;

    if (categoryId) {
      const cat = resolvedCategories.find(c => c.id === categoryId);
      if (cat) {
        action = cat.actionThreshold;
        warning = cat.warningThreshold;
      }
    }

    if (absVal >= action) return 'action';
    if (absVal >= warning) return 'warning';
    return 'normal';
  };

  // Grades one approved rule. The overdue-consent card does not call this
  // function, and this is not that percentage rule's entry point.
  const checkApprovedMetric = (value: number, candidateId: string): 'action' | 'warning' | 'normal' | null => {
    if (!approvedPlan || approvedPlan.approvalStatus !== 'approved' || approvedPlan.status !== 'approved') {
      return null;
    }
    if (approvedPlan.studyCode !== SYNTHETIC_OVERDUE_CONSENT.studyCode) return null;
    const rule = approvedMetrics.find((item) => item.candidateId === candidateId);
    if (!rule || rule.unit == null || rule.unit === '') return null;

    if (rule.unit === SYNTHETIC_OVERDUE_CONSENT.unit) {
      if (!Number.isFinite(value) || value < 0) return null;
      if (!Number.isFinite(rule.warningThreshold) || !Number.isFinite(rule.actionThreshold)) return null;
      if (rule.warningThreshold < 0 || rule.actionThreshold < 0 || rule.warningThreshold >= rule.actionThreshold) {
        return null;
      }
      const sdCategory = resolvedCategories.find((category) => category.id === rule.id);
      if (
        sdCategory
        && rule.warningThreshold === sdCategory.warningThreshold
        && rule.actionThreshold === sdCategory.actionThreshold
      ) {
        return null;
      }
      if (value >= rule.actionThreshold) return 'action';
      if (value >= rule.warningThreshold) return 'warning';
      return 'normal';
    }

    if (rule.unit === 'SD') {
      const absVal = Math.abs(value);
      if (absVal >= rule.actionThreshold) return 'action';
      if (absVal >= rule.warningThreshold) return 'warning';
      return 'normal';
    }

    return null;
  };

  return (
    <ThresholdContext.Provider value={{ 
      categories: resolvedCategories, 
      updateCategory, 
      globalWarning, 
      globalAction, 
      setGlobalWarning, 
      setGlobalAction,
      saveConfigs,
      checkOutlier,
      checkApprovedMetric,
    }}>
      {children}
    </ThresholdContext.Provider>
  );
};


export const useThresholds = () => {
  const context = useContext(ThresholdContext);
  if (!context) throw new Error("useThresholds must be used within a ThresholdProvider");
  return context;
};
