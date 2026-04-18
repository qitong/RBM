import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useInvestigators, useInvestigatorMetrics } from '../api/hooks'

function wrapper({ children }: { children: ReactNode }) {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={c}>{children}</QueryClientProvider>
}

describe('useInvestigators', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('returns investigators list on success', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify([{ id: 'INV-001', name: '\u7814\u7A76\u8005 001', experience: 'senior', siteIds: ['101'] }]), { status: 200 })
    )
    const { result } = renderHook(() => useInvestigators(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].id).toBe('INV-001')
  })
})

describe('useInvestigatorMetrics', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('returns metrics on success', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ investigatorId: 'INV-001', timeline: ['2025-01'], pdByCategory: {}, pdTotal: [5], aeCounts: [1] }), { status: 200 })
    )
    const { result } = renderHook(() => useInvestigatorMetrics('INV-001'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.investigatorId).toBe('INV-001')
  })
})
