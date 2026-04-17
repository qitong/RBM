import React, { createContext, useContext, useState, useEffect } from 'react';

export interface CategoryConfig {
  id: string;
  label: string;
  weight: number;
  warningThreshold: number; // e.g. 2.0 SD
  actionThreshold: number;  // e.g. 3.0 SD
  enabled: boolean;
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

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('rbm_threshold_configs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.categories) setCategories(parsed.categories);
        if (parsed.globalWarning) setGlobalWarning(parsed.globalWarning);
        if (parsed.globalAction) setGlobalAction(parsed.globalAction);
      } catch (e) {
        console.error("Failed to parse saved thresholds", e);
      }
    }
  }, []);

  const updateCategory = (id: string, updates: Partial<CategoryConfig>) => {
    setCategories(prev => prev.map(cat => cat.id === id ? { ...cat, ...updates } : cat));
  };

  const saveConfigs = () => {
    localStorage.setItem('rbm_threshold_configs', JSON.stringify({
      categories,
      globalWarning,
      globalAction
    }));
    alert("配置已成功保存并应用！");
  };

  // Bidirectional outlier check: abs(value) >= threshold
  const checkOutlier = (value: number, categoryId?: string): 'action' | 'warning' | 'normal' => {
    const absVal = Math.abs(value);
    let action = globalAction;
    let warning = globalWarning;

    if (categoryId) {
      const cat = categories.find(c => c.id === categoryId);
      if (cat) {
        action = cat.actionThreshold;
        warning = cat.warningThreshold;
      }
    }

    if (absVal >= action) return 'action';
    if (absVal >= warning) return 'warning';
    return 'normal';
  };

  return (
    <ThresholdContext.Provider value={{ 
      categories, 
      updateCategory, 
      globalWarning, 
      globalAction, 
      setGlobalWarning, 
      setGlobalAction,
      saveConfigs,
      checkOutlier
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
