import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RiskForecast from '../components/RiskForecast'

const MOCK_DATA = [
  {
    siteId: 'S-001', siteName: 'SYN-SITE-001',
    metricName: 'Protocol Deviation Rate (%)',
    historicalData: [
      { month: '2025-11', value: 1.2 },
      { month: '2025-12', value: 1.5 },
      { month: '2026-01', value: 1.8 },
      { month: '2026-02', value: 2.2 },
      { month: '2026-03', value: 2.6 },
      { month: '2026-04', value: 3.1 },
    ],
    forecast: { nextMonth: '2026-05', predictedValue: 3.6, confidenceInterval: [3.1, 4.1] },
  },
  {
    siteId: 'S-004', siteName: 'SYN-SITE-010',
    metricName: 'Protocol Deviation Rate (%)',
    historicalData: [
      { month: '2025-11', value: 0.8 },
      { month: '2025-12', value: 0.9 },
      { month: '2026-01', value: 0.7 },
      { month: '2026-02', value: 1.0 },
      { month: '2026-03', value: 0.8 },
      { month: '2026-04', value: 0.9 },
    ],
    forecast: { nextMonth: '2026-05', predictedValue: 0.9, confidenceInterval: [0.6, 1.2] },
  },
]

function setup() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={c}>
      <MemoryRouter>
        <RiskForecast />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('RiskForecast', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('shows loading state', () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    setup()
    expect(screen.getByText(/加载中/)).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'))
    setup()
    await waitFor(() => expect(screen.getByText(/无法加载风险预测数据/)).toBeInTheDocument())
  })

  it('renders site selector buttons', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_DATA), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('S-001')).toBeInTheDocument())
    expect(screen.getByText('S-004')).toBeInTheDocument()
  })

  it('renders chart title for default site', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_DATA), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText(/SYN-SITE-001.*PD 率固定示意/)).toBeInTheDocument())
  })

  it('renders summary table with all site names', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_DATA), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getAllByText('SYN-SITE-001').length).toBeGreaterThanOrEqual(1))
    expect(screen.getAllByText('SYN-SITE-010').length).toBeGreaterThanOrEqual(1)
  })

  it('states the page is a fixed synthetic illustration and not an action', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_DATA), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getAllByText(/固定合成示意，不是监查预测，不触发行动/).length).toBeGreaterThanOrEqual(1))
    expect(screen.queryByText(/预测下月 PD 率将超过阈值/)).not.toBeInTheDocument()
    expect(screen.queryByText(/线性回归/)).not.toBeInTheDocument()
    expect(screen.queryByText(/95% 置信区间/)).not.toBeInTheDocument()
  })

  it('switches site when selector button clicked', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_DATA), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('S-004')).toBeInTheDocument())
    fireEvent.click(screen.getByText('S-004'))
    await waitFor(() => expect(screen.getByText(/SYN-SITE-010.*PD 率固定示意/)).toBeInTheDocument())
  })

  it('renders KPI cards with 6月均值 and 下月示意值', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_DATA), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('6月均值')).toBeInTheDocument())
    expect(screen.getByText('下月示意值')).toBeInTheDocument()
    expect(screen.getAllByText('示意区间').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('趋势').length).toBeGreaterThanOrEqual(1)
  })
})
