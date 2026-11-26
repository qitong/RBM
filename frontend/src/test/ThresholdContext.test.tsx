import { useState, type ReactNode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThresholdProvider, useThresholds } from '../context/ThresholdContext'

let queryClient: QueryClient

function Harness({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const created = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient = created
    return created
  })
  return (
    <QueryClientProvider client={client}>
      <ThresholdProvider>{children}</ThresholdProvider>
    </QueryClientProvider>
  )
}

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

describe('useThresholds', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
  })

  it('provides default global warning threshold of 2.0', () => {
    const { result } = renderHook(() => useThresholds(), { wrapper: Harness })
    expect(result.current.globalWarning).toBe(2.0)
  })

  it('provides default global action threshold of 3.0', () => {
    const { result } = renderHook(() => useThresholds(), { wrapper: Harness })
    expect(result.current.globalAction).toBe(3.0)
  })

  it('provides 8 default categories', () => {
    const { result } = renderHook(() => useThresholds(), { wrapper: Harness })
    expect(result.current.categories).toHaveLength(8)
  })

  it('updates a category weight', () => {
    const { result } = renderHook(() => useThresholds(), { wrapper: Harness })
    act(() => {
      result.current.updateCategory('INFORMED CONSENT', { weight: 0.5 })
    })
    const cat = result.current.categories.find(c => c.id === 'INFORMED CONSENT')
    expect(cat?.weight).toBe(0.5)
  })

  it('checkOutlier uses category-specific thresholds when categoryId provided', () => {
    const { result } = renderHook(() => useThresholds(), { wrapper: Harness })
    act(() => {
      result.current.updateCategory('INFORMED CONSENT', { warningThreshold: 1.0, actionThreshold: 2.0 })
    })
    expect(result.current.checkOutlier(1.5, 'INFORMED CONSENT')).toBe('warning')
  })

  it('checkOutlier falls back to global thresholds when no categoryId', () => {
    const { result } = renderHook(() => useThresholds(), { wrapper: Harness })
    expect(result.current.checkOutlier(2.5)).toBe('warning')
    expect(result.current.checkOutlier(3.5)).toBe('action')
    expect(result.current.checkOutlier(1.0)).toBe('normal')
  })

  it('persists config to localStorage on saveConfigs', () => {
    const { result } = renderHook(() => useThresholds(), { wrapper: Harness })
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
    const { result } = renderHook(() => useThresholds(), { wrapper: Harness })
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
    const { result } = renderHook(() => useThresholds(), { wrapper: Harness })
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
          unit: 'SD',
          source: 'approved_kri',
        }],
      },
    }), { status: 200 })))
    const { result } = renderHook(() => useThresholds(), { wrapper: Harness })
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

  it('keeps a percentage rule off the sd preset and judges that metric in its own unit', async () => {
    localStorage.setItem('rbm_threshold_configs', JSON.stringify({
      categories: [
        { id: 'INFORMED CONSENT', label: '知情同意', weight: 0.25, warningThreshold: 1.2, actionThreshold: 2.2, enabled: true },
      ],
    }))
    vi.mocked(fetch).mockImplementation(() => jsonResponse({
      ok: true,
      active: {
        versionId: 'MP-0001',
        status: 'approved',
        approvalStatus: 'approved',
        approvedBy: '审阅员-合成甲',
        studyCode: 'SYN-FICTION-MIST-001',
        legacyThresholdMap: [{
          rbmCategoryId: 'INFORMED CONSENT',
          warningThreshold: 4,
          actionThreshold: 9,
          monitoringMethod: 'CENTRAL_REVIEW',
          candidateId: 'KRI-01',
          unit: '百分比',
          source: 'approved_kri',
        }],
      },
    }))
    const { result } = renderHook(() => useThresholds(), { wrapper: Harness })
    await waitFor(() => expect(result.current.checkApprovedMetric(3, 'KRI-01')).toBe('normal'))
    const cat = result.current.categories.find(item => item.id === 'INFORMED CONSENT')
    expect(cat?.warningThreshold).toBe(1.2)
    expect(cat?.actionThreshold).toBe(2.2)
    expect(cat?.presetFromPlan).toBe(false)
    expect(result.current.checkOutlier(3.5, 'INFORMED CONSENT')).toBe('action')
    expect(result.current.checkApprovedMetric(3, 'KRI-01')).toBe('normal')
    expect(result.current.checkApprovedMetric(3.9, 'KRI-01')).toBe('normal')
    expect(result.current.checkApprovedMetric(4, 'KRI-01')).toBe('warning')
    expect(result.current.checkApprovedMetric(5, 'KRI-01')).toBe('warning')
    expect(result.current.checkApprovedMetric(9, 'KRI-01')).toBe('action')
    expect(result.current.checkApprovedMetric(-4, 'KRI-01')).toBeNull()
    expect(result.current.checkApprovedMetric(-9, 'KRI-01')).toBeNull()
  })

  it('fails closed when the percentage rule has no unit, reuses SD bounds, mismatches the study, or has no approved version', async () => {
    const approved = {
      versionId: 'MP-0002',
      status: 'approved',
      approvalStatus: 'approved',
      approvedBy: '审阅员-合成甲',
      studyCode: 'SYN-FICTION-MIST-001',
      legacyThresholdMap: [{
        rbmCategoryId: 'INFORMED CONSENT',
        warningThreshold: 4,
        actionThreshold: 9,
        monitoringMethod: 'CENTRAL_REVIEW',
        candidateId: 'KRI-01',
        source: 'approved_kri',
      }],
    }
    vi.mocked(fetch).mockImplementation(() => jsonResponse({ ok: true, active: approved }))
    const missingUnit = renderHook(() => useThresholds(), { wrapper: Harness })
    await waitFor(() => {
      const data = queryClient.getQueryData<{ active: { versionId: string } }>(['ctq-active'])
      expect(data?.active.versionId).toBe('MP-0002')
    })
    expect(missingUnit.result.current.checkApprovedMetric(9, 'KRI-01')).toBeNull()

    vi.mocked(fetch).mockImplementation(() => jsonResponse({
      ok: true,
      active: {
        ...approved,
        legacyThresholdMap: [{
          ...approved.legacyThresholdMap[0],
          unit: '百分比',
          warningThreshold: 2,
          actionThreshold: 3,
        }],
      },
    }))
    const reusedSd = renderHook(() => useThresholds(), { wrapper: Harness })
    await waitFor(() => {
      const data = queryClient.getQueryData<{ active: { legacyThresholdMap: Array<{ actionThreshold: number }> } }>(['ctq-active'])
      expect(data?.active.legacyThresholdMap[0].actionThreshold).toBe(3)
    })
    expect(reusedSd.result.current.checkApprovedMetric(9, 'KRI-01')).toBeNull()
    expect(reusedSd.result.current.checkApprovedMetric(3, 'KRI-01')).toBeNull()
    expect(reusedSd.result.current.checkOutlier(3, 'INFORMED CONSENT')).toBe('action')

    vi.mocked(fetch).mockImplementation(() => jsonResponse({
      ok: true,
      active: { ...approved, studyCode: 'SYN-OTHER', legacyThresholdMap: [{ ...approved.legacyThresholdMap[0], unit: '百分比' }] },
    }))
    const wrongStudy = renderHook(() => useThresholds(), { wrapper: Harness })
    await waitFor(() => {
      const data = queryClient.getQueryData<{ active: { studyCode: string } }>(['ctq-active'])
      expect(data?.active.studyCode).toBe('SYN-OTHER')
    })
    expect(wrongStudy.result.current.checkApprovedMetric(9, 'KRI-01')).toBeNull()

    vi.mocked(fetch).mockImplementation(() => jsonResponse({ ok: true, active: null }))
    const noVersion = renderHook(() => useThresholds(), { wrapper: Harness })
    await waitFor(() => {
      const data = queryClient.getQueryData<{ active: null }>(['ctq-active'])
      expect(data?.active).toBeNull()
    })
    expect(noVersion.result.current.checkApprovedMetric(9, 'KRI-01')).toBeNull()
  })

  it('fails closed when a percentage rule copies default SD bounds for a category missing from the list', async () => {
    localStorage.setItem('rbm_threshold_configs', JSON.stringify({
      categories: [
        { id: 'INCLUSION EXCLUSION', label: '入排标准', weight: 0.15, warningThreshold: 1.1, actionThreshold: 1.6, enabled: true },
      ],
    }))
    vi.mocked(fetch).mockImplementation(() => jsonResponse({
      ok: true,
      active: {
        versionId: 'MP-0006',
        status: 'approved',
        approvalStatus: 'approved',
        approvedBy: '审阅员-合成甲',
        studyCode: 'SYN-FICTION-MIST-001',
        legacyThresholdMap: [{
          rbmCategoryId: 'INFORMED CONSENT',
          warningThreshold: 2,
          actionThreshold: 3,
          monitoringMethod: 'CENTRAL_REVIEW',
          candidateId: 'KRI-01',
          unit: '百分比',
          source: 'approved_kri',
        }],
      },
    }))
    const copied = renderHook(() => useThresholds(), { wrapper: Harness })
    await waitFor(() => {
      const data = queryClient.getQueryData<{ active: { versionId: string } }>(['ctq-active'])
      expect(data?.active.versionId).toBe('MP-0006')
    })
    expect(copied.result.current.categories.some((item) => item.id === 'INFORMED CONSENT')).toBe(false)
    expect(copied.result.current.checkApprovedMetric(3, 'KRI-01')).toBeNull()
    expect(copied.result.current.checkApprovedMetric(9, 'KRI-01')).toBeNull()

    vi.mocked(fetch).mockImplementation(() => jsonResponse({
      ok: true,
      active: {
        versionId: 'MP-0006',
        status: 'approved',
        approvalStatus: 'approved',
        approvedBy: '审阅员-合成甲',
        studyCode: 'SYN-FICTION-MIST-001',
        legacyThresholdMap: [{
          rbmCategoryId: 'INFORMED CONSENT',
          warningThreshold: 4,
          actionThreshold: 9,
          monitoringMethod: 'CENTRAL_REVIEW',
          candidateId: 'KRI-01',
          unit: '百分比',
          source: 'approved_kri',
        }],
      },
    }))
    const distinct = renderHook(() => useThresholds(), { wrapper: Harness })
    await waitFor(() => expect(distinct.result.current.checkApprovedMetric(3.9, 'KRI-01')).toBe('normal'))
    expect(distinct.result.current.checkApprovedMetric(4, 'KRI-01')).toBe('warning')
    expect(distinct.result.current.checkApprovedMetric(9, 'KRI-01')).toBe('action')
  })

  it('keeps the previous absolute grades for an approved SD rule', async () => {
    vi.mocked(fetch).mockImplementation(() => jsonResponse({
      ok: true,
      active: {
        versionId: 'MP-0004',
        status: 'approved',
        approvalStatus: 'approved',
        approvedBy: '审阅员-合成甲',
        studyCode: 'SYN-FICTION-MIST-001',
        legacyThresholdMap: [{
          rbmCategoryId: 'SAFETY REPORTING',
          warningThreshold: 2,
          actionThreshold: 3,
          monitoringMethod: 'CENTRAL_REVIEW',
          candidateId: 'KRI-04',
          unit: 'SD',
          source: 'approved_kri',
        }],
      },
    }))
    const { result } = renderHook(() => useThresholds(), { wrapper: Harness })
    await waitFor(() => expect(result.current.checkApprovedMetric(1.5, 'KRI-04')).toBe('normal'))
    expect(result.current.checkApprovedMetric(-1.5, 'KRI-04')).toBe('normal')
    expect(result.current.checkApprovedMetric(2, 'KRI-04')).toBe('warning')
    expect(result.current.checkApprovedMetric(-2, 'KRI-04')).toBe('warning')
    expect(result.current.checkApprovedMetric(3, 'KRI-04')).toBe('action')
    expect(result.current.checkApprovedMetric(-3, 'KRI-04')).toBe('action')
  })

  it('keeps absolute SD grades for an approved rule from another study', async () => {
    vi.mocked(fetch).mockImplementation(() => jsonResponse({
      ok: true,
      active: {
        versionId: 'MP-0011',
        status: 'approved',
        approvalStatus: 'approved',
        approvedBy: '审阅员-合成甲',
        studyCode: 'SYN-OTHER',
        legacyThresholdMap: [{
          rbmCategoryId: 'SAFETY REPORTING',
          warningThreshold: 2,
          actionThreshold: 3,
          monitoringMethod: 'CENTRAL_REVIEW',
          candidateId: 'KRI-11',
          unit: 'SD',
          source: 'approved_kri',
        }],
      },
    }))
    const { result } = renderHook(() => useThresholds(), { wrapper: Harness })
    await waitFor(() => expect(result.current.checkApprovedMetric(-2, 'KRI-11')).toBe('warning'))
    expect(result.current.checkApprovedMetric(2, 'KRI-11')).toBe('warning')
    expect(result.current.checkApprovedMetric(1.5, 'KRI-11')).toBe('normal')
    expect(result.current.checkApprovedMetric(-1.5, 'KRI-11')).toBe('normal')
    expect(result.current.checkApprovedMetric(3, 'KRI-11')).toBe('action')
    expect(result.current.checkApprovedMetric(-3, 'KRI-11')).toBe('action')
  })

  it('still applies an approved sd preset when that category is missing from localStorage', async () => {
    localStorage.setItem('rbm_threshold_configs', JSON.stringify({
      categories: [
        { id: 'INCLUSION EXCLUSION', label: '入排标准', weight: 0.15, warningThreshold: 1.1, actionThreshold: 1.6, enabled: true },
      ],
    }))
    vi.mocked(fetch).mockImplementation(() => jsonResponse({
      ok: true,
      active: {
        versionId: 'MP-0003',
        status: 'approved',
        approvalStatus: 'approved',
        approvedBy: '审阅员-合成甲',
        legacyThresholdMap: [{
          rbmCategoryId: 'INFORMED CONSENT',
          warningThreshold: 1.2,
          actionThreshold: 1.4,
          monitoringMethod: 'SDV',
          candidateId: 'KRI-03',
          unit: 'SD',
          source: 'approved_kri',
        }],
      },
    }))
    const { result } = renderHook(() => useThresholds(), { wrapper: Harness })
    await waitFor(() => {
      const cat = result.current.categories.find(item => item.id === 'INFORMED CONSENT')
      expect(cat?.actionThreshold).toBe(1.4)
    })
    expect(result.current.checkOutlier(1.3, 'INFORMED CONSENT')).toBe('warning')
    expect(result.current.checkOutlier(1.3)).toBe('normal')
  })

  it('follows a newly approved or rolled-back version without remounting', async () => {
    let active: unknown = null
    vi.mocked(fetch).mockImplementation(() => jsonResponse({ ok: true, active }))
    const { result } = renderHook(() => useThresholds(), { wrapper: Harness })
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(result.current.checkOutlier(3.5, 'INFORMED CONSENT')).toBe('action')

    active = {
      versionId: 'MP-0008',
      status: 'approved',
      approvalStatus: 'approved',
      approvedBy: '审阅员-合成甲',
      legacyThresholdMap: [{
        rbmCategoryId: 'INFORMED CONSENT',
        warningThreshold: 4,
        actionThreshold: 9,
        monitoringMethod: 'CENTRAL_REVIEW',
        candidateId: 'KRI-08',
        unit: 'SD',
        source: 'approved_kri',
      }],
    }
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['ctq-active'] }) })
    await waitFor(() => expect(result.current.checkOutlier(3.5, 'INFORMED CONSENT')).toBe('normal'))

    active = null
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['ctq-active'] }) })
    await waitFor(() => expect(result.current.checkOutlier(3.5, 'INFORMED CONSENT')).toBe('action'))
  })
})
