import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ReportCenter from '../components/ReportCenter'

const MOCK_REPORTS = [
  {
    reportId: 'RPT-20260425-006',
    title: '2026-04 月度风险监控报告',
    type: 'Monthly',
    period: '2026-04',
    generatedBy: '赵晓燕',
    generatedAt: '2026-04-25T09:00:00Z',
    status: 'Ready',
    format: 'PDF',
    sizeMb: 3.1,
    summary: { totalCriticalAlerts: 3, unresolvedTasks: 5, avgEntryDelayDays: 4.2, highestRiskSite: '北京协和医院' },
  },
  {
    reportId: 'RPT-20260325-004',
    title: '2026-03 月度风险监控报告',
    type: 'Monthly',
    period: '2026-03',
    generatedBy: '赵晓燕',
    generatedAt: '2026-03-25T10:00:00Z',
    status: 'Ready',
    format: 'PDF',
    sizeMb: 2.9,
    summary: { totalCriticalAlerts: 2, unresolvedTasks: 8, avgEntryDelayDays: 5.1, highestRiskSite: '成都华西医院' },
  },
]

function setup() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={c}>
      <MemoryRouter>
        <ReportCenter />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ReportCenter', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('shows loading state', () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    setup()
    expect(screen.getByText(/加载中/)).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network'))
    setup()
    await waitFor(() => expect(screen.getByText(/无法加载报告列表/)).toBeInTheDocument())
  })

  it('renders report cards with titles', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_REPORTS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('2026-04 月度风险监控报告')).toBeInTheDocument())
    expect(screen.getByText('2026-03 月度风险监控报告')).toBeInTheDocument()
  })

  it('renders KPI banner with report count', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_REPORTS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('报告总数')).toBeInTheDocument())
    expect(screen.getAllByText('月度报告').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('最近生成')).toBeInTheDocument()
  })

  it('renders download buttons for ready reports', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_REPORTS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getAllByText('下载').length).toBe(2))
  })

  it('opens generate modal on button click', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_REPORTS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('生成新报告')).toBeInTheDocument())
    fireEvent.click(screen.getByText('生成新报告'))
    await waitFor(() => expect(screen.getByText('确认生成')).toBeInTheDocument())
    expect(screen.getByLabelText('报告类型')).toBeInTheDocument()
    expect(screen.getByLabelText('报告周期')).toBeInTheDocument()
  })

  it('closes modal on cancel', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_REPORTS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('生成新报告')).toBeInTheDocument())
    fireEvent.click(screen.getByText('生成新报告'))
    await waitFor(() => expect(screen.getByText('取消')).toBeInTheDocument())
    fireEvent.click(screen.getByText('取消'))
    await waitFor(() => expect(screen.queryByText('确认生成')).not.toBeInTheDocument())
  })

  it('adds a generating card after confirm', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_REPORTS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('生成新报告')).toBeInTheDocument())
    fireEvent.click(screen.getByText('生成新报告'))
    await waitFor(() => expect(screen.getByTestId('confirm-generate')).toBeInTheDocument())
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-generate'))
    })
    await waitFor(() => expect(screen.getByText(/生成中/)).toBeInTheDocument())
  })

  it('shows highest risk site in report card', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_REPORTS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('北京协和医院')).toBeInTheDocument())
  })
})
