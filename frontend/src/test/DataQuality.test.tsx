import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import DataQuality from '../components/DataQuality'

const MOCK_DATA = [
  {
    siteId: 'S-001', siteName: '北京协和医院', metricsMonth: '2026-04',
    avgEntryDelayDays: 7.4, totalQueriesIssued: 143, openQueries: 28,
    resolvedQueries: 115, avgQueryResolutionDays: 5.2, missingPagesCount: 6,
  },
  {
    siteId: 'S-004', siteName: '杭州邵逸夫医院', metricsMonth: '2026-04',
    avgEntryDelayDays: 2.0, totalQueriesIssued: 67, openQueries: 4,
    resolvedQueries: 63, avgQueryResolutionDays: 2.1, missingPagesCount: 0,
  },
]

function setup() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={c}>
      <MemoryRouter>
        <DataQuality />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('DataQuality', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('shows loading state', () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    setup()
    expect(screen.getByText(/加载中/)).toBeInTheDocument()
  })

  it('renders KPI cards', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_DATA), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('平均录入滞后')).toBeInTheDocument())
    expect(screen.getAllByText('未解决质疑').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('质疑解决率')).toBeInTheDocument()
    expect(screen.getByText('缺失页总数')).toBeInTheDocument()
  })

  it('renders both charts', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_DATA), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('各中心 EDC 录入滞后天数')).toBeInTheDocument())
    expect(screen.getByText('各中心质疑情况（已解决 vs 未解决）')).toBeInTheDocument()
  })

  it('renders site detail table with site names', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_DATA), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('北京协和医院')).toBeInTheDocument())
    expect(screen.getByText('杭州邵逸夫医院')).toBeInTheDocument()
  })

  it('changes sort when column header clicked', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_DATA), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByRole('columnheader', { name: /未解决质疑/ })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('columnheader', { name: /未解决质疑/ }))
    await waitFor(() => expect(screen.getByRole('columnheader', { name: /未解决质疑 ↓/ })).toBeInTheDocument())
  })

  it('shows error state on fetch failure', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'))
    setup()
    await waitFor(() => expect(screen.getByText(/无法加载数据质量/)).toBeInTheDocument())
  })
})
