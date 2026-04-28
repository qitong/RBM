import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import SubjectProfiles from '../components/SubjectProfiles'

const MOCK_SUBJECTS = [
  {
    subjectId: 'SUBJ-1047',
    siteId: 'S-001',
    siteName: '北京协和医院',
    enrollmentDate: '2026-01-08T00:00:00Z',
    riskScore: 91,
    aeCount: 3,
    pdCount: 2,
    missedVisitCount: 1,
    events: [
      { type: 'AE', date: '2026-02-03T00:00:00Z', severity: 'Grade 3', description: '血小板减少' },
      { type: 'PD', date: '2026-02-18T00:00:00Z', severity: 'Major', description: '知情同意书签署日期晚于筛选期检查' },
    ],
  },
  {
    subjectId: 'SUBJ-1023',
    siteId: 'S-003',
    siteName: '上海瑞金医院',
    enrollmentDate: '2026-01-15T00:00:00Z',
    riskScore: 45,
    aeCount: 1,
    pdCount: 1,
    missedVisitCount: 0,
    events: [
      { type: 'AE', date: '2026-03-01T00:00:00Z', severity: 'Grade 1', description: '轻度头晕' },
    ],
  },
  {
    subjectId: 'SUBJ-1008',
    siteId: 'S-004',
    siteName: '杭州邵逸夫医院',
    enrollmentDate: '2026-01-05T00:00:00Z',
    riskScore: 18,
    aeCount: 0,
    pdCount: 0,
    missedVisitCount: 0,
    events: [],
  },
]

function setup() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={c}>
      <MemoryRouter>
        <SubjectProfiles />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SubjectProfiles', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('shows loading state initially', () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    setup()
    expect(screen.getByText(/加载中/)).toBeInTheDocument()
  })

  it('renders summary bar with correct counts', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_SUBJECTS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('受试者总数')).toBeInTheDocument())
    expect(screen.getAllByText('高风险').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('中风险').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('低风险').length).toBeGreaterThanOrEqual(1)
  })

  it('renders subject list sorted by risk score descending', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_SUBJECTS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getAllByText('SUBJ-1047').length).toBeGreaterThanOrEqual(1))
    expect(screen.getAllByText('SUBJ-1023').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('SUBJ-1008').length).toBeGreaterThanOrEqual(1)
  })

  it('shows detail panel for highest-risk subject by default', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_SUBJECTS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getAllByText('北京协和医院').length).toBeGreaterThanOrEqual(1))
    expect(screen.getByText('事件时间轴')).toBeInTheDocument()
    expect(screen.getByText('风险雷达图')).toBeInTheDocument()
  })

  it('switches detail panel when another subject is selected', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_SUBJECTS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getAllByText('SUBJ-1023').length).toBeGreaterThanOrEqual(1))
    fireEvent.click(screen.getAllByText('SUBJ-1023')[0])
    await waitFor(() => expect(screen.getAllByText('上海瑞金医院').length).toBeGreaterThanOrEqual(1))
  })

  it('renders timeline events in detail panel', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_SUBJECTS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('血小板减少')).toBeInTheDocument())
    expect(screen.getByText('知情同意书签署日期晚于筛选期检查')).toBeInTheDocument()
  })

  it('shows 暂无事件记录 when subject has no events', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_SUBJECTS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('SUBJ-1008')).toBeInTheDocument())
    fireEvent.click(screen.getByText('SUBJ-1008'))
    await waitFor(() => expect(screen.getByText('暂无事件记录')).toBeInTheDocument())
  })

  it('shows error state on fetch failure', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'))
    setup()
    await waitFor(() => expect(screen.getByText(/无法加载受试者数据/)).toBeInTheDocument())
  })
})
