import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InvestigatorProfile from '../components/InvestigatorProfile'

function setup(path: string) {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={c}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/investigators/:invId" element={<InvestigatorProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('InvestigatorProfile', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('renders investigator name and PD category breakdown', async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new Response(JSON.stringify(
        { id: 'INV-001', name: '\u7814\u7A76\u8005 001', experience: 'senior', siteIds: ['101'] }
      ), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(
        { investigatorId: 'INV-001', timeline: ['2025-01'], pdByCategory: { '\u77E5\u60C5\u540C\u610F': [3] }, pdTotal: [3], aeCounts: [1] }
      ), { status: 200 }))
    setup('/investigators/INV-001')
    await waitFor(() => expect(screen.getByText('\u7814\u7A76\u8005 001')).toBeInTheDocument())
  })

  it('shows loading state', () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    setup('/investigators/INV-001')
    expect(screen.getByText(/\u52A0\u8F7D\u4E2D/)).toBeInTheDocument()
  })
})
