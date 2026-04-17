import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SiteDeepDive from '../components/SiteDeepDive'

function setup(initialPath: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/sites/:siteId" element={<SiteDeepDive />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SiteDeepDive', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('renders site name from API', async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: '101', name: '中心 101', region: '华东', enrolled: 22, target: 50, pi: '研究者 101' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ siteId: '101', timeline: ['2025-01'], pd: [1], ae: [0], enrollment: [1], query: [0] }), { status: 200 }))
    setup('/sites/101')
    await waitFor(() => expect(screen.getByText('中心 101')).toBeInTheDocument())
  })

  it('shows loading state', () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    setup('/sites/101')
    expect(screen.getByText(/加载中/)).toBeInTheDocument()
  })
})
