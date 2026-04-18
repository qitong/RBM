import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import InvestigatorList from '../components/InvestigatorList'

function setup() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={c}>
      <MemoryRouter>
        <InvestigatorList />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('InvestigatorList', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('renders investigator names from API', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify([
      { id: 'INV-001', name: '\u7814\u7A76\u8005 001', experience: 'senior', siteIds: ['101'] },
      { id: 'INV-003', name: '\u7814\u7A76\u8005 003', experience: 'junior', siteIds: ['201'] },
    ]), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('\u7814\u7A76\u8005 001')).toBeInTheDocument())
    expect(screen.getByText('\u7814\u7A76\u8005 003')).toBeInTheDocument()
  })

  it('highlights junior investigators', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify([
      { id: 'INV-003', name: '\u7814\u7A76\u8005 003', experience: 'junior', siteIds: ['201'] },
    ]), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('junior')).toBeInTheDocument())
  })
})
