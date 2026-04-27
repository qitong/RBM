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

  it('returns benchmark data with points and trend on success', async () => {
    const mockData = {
      points: [{ siteId: '101', name: '中心 101', progressPct: 50, pdTotal: 12, pdZScore: 1.2, queryTotal: 30 }],
      trend: {
        trendLine: [{ x: 40, y: 0.5 }, { x: 60, y: 1.5 }],
        upperBand: [{ x: 40, y: 1.0 }, { x: 60, y: 2.0 }],
        lowerBand: [{ x: 40, y: 0.0 }, { x: 60, y: 1.0 }],
        slope: 0.05,
        intercept: -1.5,
        r_squared: 0.8
      }
    }
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(mockData), { status: 200 }))
    const { result } = renderHook(() => useBenchmark(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.points[0].siteId).toBe('101')
    expect(result.current.data?.trend.slope).toBe(0.05)
    expect(result.current.data?.trend.r_squared).toBe(0.8)
  })
})