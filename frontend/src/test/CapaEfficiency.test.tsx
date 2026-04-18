import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CapaEfficiency from '../components/CapaEfficiency'

function setup() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={c}>
      <MemoryRouter>
        <CapaEfficiency />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CapaEfficiency', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('renders KPI cards with efficiency metrics', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify({
      avgCycleTimeDays: 15.5,
      medianCycleTimeDays: 14,
      closureRate: 0.75,
      bySite: [{ siteId: '101', avgCycleTimeDays: 12, count: 5, closureRate: 0.8 }],
      byCategory: [{ category: '\u77E5\u60C5\u540C\u610F', avgCycleTimeDays: 10, count: 3 }],
    }), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('15.5')).toBeInTheDocument())
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders by-site breakdown table', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify({
      avgCycleTimeDays: 15.5,
      medianCycleTimeDays: 14,
      closureRate: 0.75,
      bySite: [{ siteId: '101', avgCycleTimeDays: 12, count: 5, closureRate: 0.8 }],
      byCategory: [{ category: '\u77E5\u60C5\u540C\u610F', avgCycleTimeDays: 10, count: 3 }],
    }), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('101')).toBeInTheDocument())
  })

  it('shows loading state', () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    setup()
    expect(screen.getByText(/\u52A0\u8F7D\u4E2D/)).toBeInTheDocument()
  })
})
