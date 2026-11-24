import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiError, apiGet, apiGetStrict } from '../api/client'

describe('rbqm client', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => {
    delete import.meta.env.VITE_RBQM_STATIC_FALLBACK
    vi.unstubAllGlobals()
  })

  it('does not read static JSON when the risk API fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('down'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(apiGet('/api/rbqm/risks')).rejects.toThrow(/no fallback/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await expect(apiGetStrict('/api/rbqm/risks')).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps a 422 body instead of swapping in static JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: false, code: 'CLOSE_GUARD', message: '状态保持 Detected' }),
      { status: 422 },
    ))
    vi.stubGlobal('fetch', fetchMock)
    await expect(apiGetStrict('/api/rbqm/risks/RSK-KRI-101')).rejects.toMatchObject({ status: 422 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('marks an explicit offline fallback', async () => {
    import.meta.env.VITE_RBQM_STATIC_FALLBACK = '1'
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        fallbackActive: true,
        isSynthetic: true,
        disclaimer: '合成研究验证数据，非真实临床试验监查证据',
        datasets: { '/api/rbqm/risks': [] },
      }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const body = await apiGetStrict<{ fallbackActive: boolean; data: unknown[] }>('/api/rbqm/risks')
    expect(body.fallbackActive).toBe(true)
    expect(body.data).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
