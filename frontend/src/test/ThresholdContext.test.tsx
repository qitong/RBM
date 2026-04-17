import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ThresholdProvider, useThresholds } from '../context/ThresholdContext'

describe('useThresholds', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('provides default global warning threshold of 2.0', () => {
    const { result } = renderHook(() => useThresholds(), { wrapper: ThresholdProvider })
    expect(result.current.globalWarning).toBe(2.0)
  })

  it('provides default global action threshold of 3.0', () => {
    const { result } = renderHook(() => useThresholds(), { wrapper: ThresholdProvider })
    expect(result.current.globalAction).toBe(3.0)
  })

  it('provides 8 default categories', () => {
    const { result } = renderHook(() => useThresholds(), { wrapper: ThresholdProvider })
    expect(result.current.categories).toHaveLength(8)
  })

  it('updates a category weight', () => {
    const { result } = renderHook(() => useThresholds(), { wrapper: ThresholdProvider })
    act(() => {
      result.current.updateCategory('INFORMED CONSENT', { weight: 0.5 })
    })
    const cat = result.current.categories.find(c => c.id === 'INFORMED CONSENT')
    expect(cat?.weight).toBe(0.5)
  })

  it('checkOutlier uses category-specific thresholds when categoryId provided', () => {
    const { result } = renderHook(() => useThresholds(), { wrapper: ThresholdProvider })
    act(() => {
      result.current.updateCategory('INFORMED CONSENT', { warningThreshold: 1.0, actionThreshold: 2.0 })
    })
    expect(result.current.checkOutlier(1.5, 'INFORMED CONSENT')).toBe('warning')
  })

  it('checkOutlier falls back to global thresholds when no categoryId', () => {
    const { result } = renderHook(() => useThresholds(), { wrapper: ThresholdProvider })
    expect(result.current.checkOutlier(2.5)).toBe('warning')
    expect(result.current.checkOutlier(3.5)).toBe('action')
    expect(result.current.checkOutlier(1.0)).toBe('normal')
  })

  it('persists config to localStorage on saveConfigs', () => {
    const { result } = renderHook(() => useThresholds(), { wrapper: ThresholdProvider })
    act(() => { result.current.setGlobalWarning(1.5) })
    act(() => { result.current.saveConfigs() })
    const saved = JSON.parse(localStorage.getItem('rbm_threshold_configs') ?? '{}')
    expect(saved.globalWarning).toBe(1.5)
  })

  it('restores persisted config from localStorage on mount', () => {
    localStorage.setItem('rbm_threshold_configs', JSON.stringify({
      globalWarning: 1.5,
      globalAction: 2.5,
      categories: [],
    }))
    const { result } = renderHook(() => useThresholds(), { wrapper: ThresholdProvider })
    expect(result.current.globalWarning).toBe(1.5)
    expect(result.current.globalAction).toBe(2.5)
  })
})
