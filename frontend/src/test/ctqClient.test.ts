import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError, apiGet, apiSendStrict } from '../api/client'

describe('ctq client', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('does not replace a failed plan read with static JSON', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('down'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(apiGet('/api/ctq/active')).rejects.toThrow(/no fallback/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns the extractor error instead of a second fallback request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ ok: false, code: 'EXTRACT_FAILED', message: '提取失败，未生成候选或监测计划' }),
      { status: 500 },
    ))
    vi.stubGlobal('fetch', fetchMock)
    await expect(apiSendStrict('/api/ctq/extract', {
      method: 'POST',
      body: JSON.stringify({ protocolText: 'x' }),
    })).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
