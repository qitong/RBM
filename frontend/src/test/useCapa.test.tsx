import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCapaList, useCapaEfficiency } from '../api/hooks'

function wrapper({ children }: { children: ReactNode }) {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={c}>{children}</QueryClientProvider>
}

describe('useCapaList', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('returns CAPA records on success', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify([{ id: 'CAPA-001', siteId: '101', category: '\u77E5\u60C5\u540C\u610F', openDate: '2025-01-05', closeDate: '2025-01-20', status: 'closed', cycleTimeDays: 15 }]), { status: 200 })
    )
    const { result } = renderHook(() => useCapaList(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].id).toBe('CAPA-001')
  })
})

describe('useCapaEfficiency', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('returns efficiency metrics on success', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ avgCycleTimeDays: 15.5, medianCycleTimeDays: 14, closureRate: 0.75, bySite: [], byCategory: [] }), { status: 200 })
    )
    const { result } = renderHook(() => useCapaEfficiency(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.avgCycleTimeDays).toBe(15.5)
  })
})
