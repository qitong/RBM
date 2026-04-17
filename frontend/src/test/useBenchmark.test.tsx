import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useBenchmark } from '../api/hooks'

function wrapper({ children }: { children: ReactNode }) {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={c}>{children}</QueryClientProvider>
}

describe('useBenchmark', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('returns rows on success', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify([{ siteId: '101', name: '\u4E2D\u5FC3 101', progressPct: 50, pdTotal: 12, pdZScore: 1.2, queryTotal: 30 }]), { status: 200 }))
    const { result } = renderHook(() => useBenchmark(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].siteId).toBe('101')
  })
})
