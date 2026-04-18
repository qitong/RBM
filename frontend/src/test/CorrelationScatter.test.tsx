import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CorrelationScatter from '../components/CorrelationScatter'

function setup() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={c}>
      <MemoryRouter>
        <CorrelationScatter />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CorrelationScatter', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('renders correlation coefficients from API', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify({
      points: [
        { siteId: '101', name: '\u4E2D\u5FC3 101', pdTotal: 12, queryTotal: 30 },
        { siteId: '102', name: '\u4E2D\u5FC3 102', pdTotal: 4, queryTotal: 10 },
      ],
      pearson: 0.85, spearman: 0.82, slope: 1.5, intercept: 3.0,
    }), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText(/Pearson/)).toBeInTheDocument())
    expect(screen.getByText(/0.85/)).toBeInTheDocument()
    expect(screen.getByText(/Spearman/)).toBeInTheDocument()
    expect(screen.getByText(/0.82/)).toBeInTheDocument()
  })

  it('shows loading state', () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    setup()
    expect(screen.getByText(/\u52A0\u8F7D\u4E2D/)).toBeInTheDocument()
  })
})
