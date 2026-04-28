import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import TaskCenter from '../components/TaskCenter'

const MOCK_TASKS = [
  {
    taskId: 'TASK-2026-001',
    title: '核查 S-001 知情同意流程缺陷',
    relatedAlertId: 'ALT-901',
    siteId: 'S-001',
    siteName: '北京协和医院',
    assignee: '张伟',
    category: '知情同意',
    status: 'To Do',
    priority: 'Critical',
    createdAt: '2026-04-20T08:00:00Z',
    dueDate: '2026-04-25T08:00:00Z',
  },
  {
    taskId: 'TASK-2026-005',
    title: 'S-002 访视计划偏差CRA现场确认',
    relatedAlertId: 'ALT-905',
    siteId: 'S-002',
    siteName: '南京鼓楼医院',
    assignee: '张伟',
    category: '访视计划',
    status: 'In Progress',
    priority: 'Critical',
    createdAt: '2026-04-15T08:00:00Z',
    dueDate: '2026-04-22T08:00:00Z',
  },
  {
    taskId: 'TASK-2026-008',
    title: 'S-004 知情同意书版本升级核查',
    relatedAlertId: 'ALT-908',
    siteId: 'S-004',
    siteName: '杭州邵逸夫医院',
    assignee: '赵磊',
    category: '知情同意',
    status: 'Resolved',
    priority: 'High',
    createdAt: '2026-04-10T08:00:00Z',
    dueDate: '2026-04-18T08:00:00Z',
  },
]

function setup() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={c}>
      <MemoryRouter>
        <TaskCenter />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TaskCenter', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('shows loading state initially', () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}))
    setup()
    expect(screen.getByText(/加载中/)).toBeInTheDocument()
  })

  it('renders kanban columns', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_TASKS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('待处理')).toBeInTheDocument())
    expect(screen.getByText('处理中')).toBeInTheDocument()
    expect(screen.getAllByText('已解决').length).toBeGreaterThanOrEqual(1)
  })

  it('renders task cards with correct data', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_TASKS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('核查 S-001 知情同意流程缺陷')).toBeInTheDocument())
    expect(screen.getByText('TASK-2026-001')).toBeInTheDocument()
    expect(screen.getByText('北京协和医院')).toBeInTheDocument()
    expect(screen.getAllByText('张伟').length).toBeGreaterThanOrEqual(1)
  })

  it('shows summary bar with correct counts', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_TASKS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('工单总数')).toBeInTheDocument())
    expect(screen.getByText('紧急待处理')).toBeInTheDocument()
    expect(screen.getByText('已逾期')).toBeInTheDocument()
  })

  it('shows dropdown options when 移动至 is clicked', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(JSON.stringify(MOCK_TASKS), { status: 200 }))
    setup()
    await waitFor(() => expect(screen.getByText('核查 S-001 知情同意流程缺陷')).toBeInTheDocument())

    const moveButtons = screen.getAllByText('移动至')
    fireEvent.click(moveButtons[0])

    await waitFor(() => expect(screen.getAllByText('处理中').length).toBeGreaterThanOrEqual(2))
  })

  it('shows error state on fetch failure', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'))
    setup()
    await waitFor(() => expect(screen.getByText(/无法加载工单数据/)).toBeInTheDocument())
  })
})
