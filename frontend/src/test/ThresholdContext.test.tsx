import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { ThresholdProvider, useThresholds } from '../context/ThresholdContext'

describe('useThresholds', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
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

  it('does not let an unapproved candidate replace the preset', async () => {
    localStorage.setItem('rbm_threshold_configs', JSON.stringify({
      categories: [
        { id: 'INFORMED CONSENT', label: '知情同意', weight: 0.25, warningThreshold: 1.2, actionThreshold: 2.2, enabled: true },
      ],
    }))
    vi.mocked(fetch).mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      ok: true,
      active: null,
      candidates: [{ id: 'KRI-99', approvalStatus: 'candidate', warningThreshold: 8, actionThreshold: 10 }],
    }), { status: 200 })))
    const { result } = renderHook(() => useThresholds(), { wrapper: ThresholdProvider })
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    const cat = result.current.categories.find(item => item.id === 'INFORMED CONSENT')
    expect(cat?.warningThreshold).toBe(1.2)
    expect(cat?.actionThreshold).toBe(2.2)
    expect(cat?.presetFromPlan).toBe(false)
    expect(result.current.checkOutlier(1.5, 'INFORMED CONSENT')).toBe('warning')
  })

  it('uses the approved plan as the category preset even when localStorage differs', async () => {
    localStorage.setItem('rbm_threshold_configs', JSON.stringify({
      categories: [
        { id: 'INFORMED CONSENT', label: '知情同意', weight: 0.25, warningThreshold: 1.2, actionThreshold: 2.2, enabled: true },
      ],
    }))
    vi.mocked(fetch).mockImplementation(() => Promise.resolve(new Response(JSON.stringify({
      ok: true,
      active: {
        versionId: 'MP-0007',
        status: 'approved',
        approvalStatus: 'approved',
        approvedBy: '审阅员-合成甲',
        legacyThresholdMap: [{
          rbmCategoryId: 'INFORMED CONSENT',
          warningThreshold: 4,
          actionThreshold: 9,
          monitoringMethod: 'CENTRAL_REVIEW',
          candidateId: 'KRI-01',
          source: 'approved_kri',
        }],
      },
    }), { status: 200 })))
    const { result } = renderHook(() => useThresholds(), { wrapper: ThresholdProvider })
    await waitFor(() => {
      const cat = result.current.categories.find(item => item.id === 'INFORMED CONSENT')
      expect(cat?.actionThreshold).toBe(9)
    })
    const cat = result.current.categories.find(item => item.id === 'INFORMED CONSENT')
    expect(cat?.warningThreshold).toBe(4)
    expect(cat?.presetFromPlan).toBe(true)
    expect(result.current.checkOutlier(3.5, 'INFORMED CONSENT')).toBe('normal')
    expect(result.current.checkOutlier(4, 'INFORMED CONSENT')).toBe('warning')
    expect(result.current.checkOutlier(9, 'INFORMED CONSENT')).toBe('action')
    act(() => {
      result.current.updateCategory('INFORMED CONSENT', { warningThreshold: 0.5, actionThreshold: 0.6 })
    })
    expect(result.current.checkOutlier(3.5, 'INFORMED CONSENT')).toBe('normal')
    const saved = JSON.parse(localStorage.getItem('rbm_threshold_configs') ?? '{}')
    expect(saved.categories[0].actionThreshold).toBe(2.2)
  })
})
