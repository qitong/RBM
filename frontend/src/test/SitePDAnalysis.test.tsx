import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThresholdProvider } from '../context/ThresholdContext'
import SitePDAnalysis from '../components/SitePDAnalysis'

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ThresholdProvider>
          <SitePDAnalysis />
        </ThresholdProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SitePDAnalysis', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('renders the synthetic comparison from the contract', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/api/rbqm/sites/comparison')) {
        return Promise.resolve(new Response(JSON.stringify({
          isSynthetic: true,
          data: {
            seed: 42,
            points: [{ siteId: 'SYN-SITE-101', siteLabel: 'SYN-SITE-101', counts: { '知情同意': 7 } }],
            visits: {},
          },
        }), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true, active: null }), { status: 200 }))
    })
    setup()
    await waitFor(() => expect(screen.getByText('合成研究验证数据，非真实临床试验监查证据')).toBeInTheDocument())
    expect(screen.getByText('SYN-SITE-101')).toBeInTheDocument()
  })

  it('stops when the comparison API fails', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/api/rbqm/sites/comparison')) {
        return Promise.reject(new Error('down'))
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true, active: null }), { status: 200 }))
    })
    setup()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('未用随机数填补'))
  })
})
