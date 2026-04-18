import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useForecast } from '../api/hooks'

function wrapper({ children }: { children: ReactNode }) {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={c}>{children}</QueryClientProvider>
}

describe('useForecast', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('returns forecast data on success', async () => {
    const mock = {
      siteId: '101',
      historical: { timeline: ['2025-01'], pd: [3], ae: [1] },
      forecastTimeline: ['2026-01'],
      pd: { forecast: [5], lower: [3], upper: [7], slope: 0.2, intercept: 2 },
      ae: { forecast: [2], lower: [1], upper: [3], slope: 0.1, intercept: 1 },
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(mock), { status: 200 })
    )
    const { result } = renderHook(() => useForecast('101'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.siteId).toBe('101')
    expect(result.current.data?.pd.forecast).toEqual([5])
  })
})
