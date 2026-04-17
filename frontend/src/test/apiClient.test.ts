import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiGet, ApiError } from '../api/client'

describe('apiGet', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('returns parsed JSON on 200', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 }))
    const data = await apiGet<{ ok: number }>('/api/x')
    expect(data).toEqual({ ok: 1 })
  })

  it('throws ApiError on non-2xx', async () => {
    (fetch as any).mockResolvedValue(new Response('boom', { status: 500 }))
    await expect(apiGet('/api/x')).rejects.toBeInstanceOf(ApiError)
  })

  it('uses VITE_API_BASE_URL when set', async () => {
    (fetch as any).mockResolvedValue(new Response('{}', { status: 200 }))
    import.meta.env.VITE_API_BASE_URL = 'http://api.test'
    await apiGet('/api/x')
    expect((fetch as any).mock.calls[0][0]).toBe('http://api.test/api/x')
  })
})
