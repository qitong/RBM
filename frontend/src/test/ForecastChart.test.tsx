import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ForecastChart from '../components/ForecastChart'

function setup(path: string) {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={c}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/forecast/:siteId" element={<ForecastChart />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ForecastChart', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('renders forecast heading and trend labels', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify({
      siteId: '101',
      historical: { timeline: ['2025-01', '2025-02'], pd: [3, 4], ae: [1, 2] },
      forecastTimeline: ['2025-03'],
      pd: { forecast: [5], lower: [3], upper: [7], slope: 1.0, intercept: 2.0 },
      ae: { forecast: [3], lower: [2], upper: [4], slope: 0.5, intercept: 0.5 },
    }), { status: 200 }))
    setup('/forecast/101')
    await waitFor(() => expect(screen.getByText('PD \u9884\u6D4B')).toBeInTheDocument())
    expect(screen.getByText('AE \u9884\u6D4B')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    setup('/forecast/101')
    expect(screen.getByText(/\u52A0\u8F7D\u4E2D/)).toBeInTheDocument()
  })
})
