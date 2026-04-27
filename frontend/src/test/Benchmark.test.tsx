import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Benchmark from '../components/Benchmark'

function setup() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={c}>
      <MemoryRouter>
        <Benchmark />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Benchmark', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('renders ranking table rows from API', async () => {
    const mockData = {
      points: [
        { siteId: '101', name: '中心 101', progressPct: 50, pdTotal: 12, pdZScore: 1.2, queryTotal: 30 },
        { siteId: '102', name: '中心 102', progressPct: 70, pdTotal: 4, pdZScore: -0.8, queryTotal: 10 },
      ],
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
    setup()
    await waitFor(() => expect(screen.getByText('中心 101')).toBeInTheDocument())
    expect(screen.getByText('中心 102')).toBeInTheDocument()
  })

  it('renders trend analysis information', async () => {
    const mockData = {
      points: [
        { siteId: '101', name: '中心 101', progressPct: 50, pdTotal: 12, pdZScore: 1.2, queryTotal: 30 },
      ],
      trend: {
        trendLine: [{ x: 40, y: 0.5 }, { x: 60, y: 1.5 }],
        upperBand: [{ x: 40, y: 1.0 }, { x: 60, y: 2.0 }],
        lowerBand: [{ x: 40, y: 0.0 }, { x: 60, y: 1.0 }],
        slope: 0.05,
        intercept: -1.5,
        r_squared: 0.82
      }
    }
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(mockData), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('R² = 0.82')).toBeInTheDocument())
    expect(screen.getByText('斜率: +0.05')).toBeInTheDocument()
    expect(screen.getByText('入组进度 vs PD z-score')).toBeInTheDocument()
  })
})