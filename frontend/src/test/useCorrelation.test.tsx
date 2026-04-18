import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCorrelation } from '../api/hooks'

function wrapper({ children }: { children: ReactNode }) {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={c}>{children}</QueryClientProvider>
}

describe('useCorrelation', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('returns correlation data on success', async () => {
    const mock = {
      points: [{ siteId: '101', name: '\u4E2D\u5FC3 101', pdTotal: 12, queryTotal: 30 }],
      pearson: 0.85, spearman: 0.82, slope: 1.5, intercept: 3.0,
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(mock), { status: 200 })
    )
    const { result } = renderHook(() => useCorrelation(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.pearson).toBe(0.85)
    expect(result.current.data?.points).toHaveLength(1)
  })
})
