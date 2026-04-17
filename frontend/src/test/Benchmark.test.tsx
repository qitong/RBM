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
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify([
      { siteId: '101', name: '\u4E2D\u5FC3 101', progressPct: 50, pdTotal: 12, pdZScore: 1.2, queryTotal: 30 },
      { siteId: '102', name: '\u4E2D\u5FC3 102', progressPct: 70, pdTotal: 4, pdZScore: -0.8, queryTotal: 10 },
    ]), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('\u4E2D\u5FC3 101')).toBeInTheDocument())
    expect(screen.getByText('\u4E2D\u5FC3 102')).toBeInTheDocument()
  })
})
