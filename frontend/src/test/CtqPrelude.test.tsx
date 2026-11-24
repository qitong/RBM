import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CtqPrelude from '../components/CtqPrelude'

const EMPTY_ACTIVE = {
  ok: true,
  dataSourceMode: 'synthetic',
  disclaimer: '合成研究验证数据，非真实临床试验监查证据',
  active: null,
  riskFieldMap: [],
  readEntry: { appliesTo: [], doesNotOverwrite: [] },
}

const EMPTY_VERSIONS = {
  ok: true,
  dataSourceMode: 'synthetic',
  disclaimer: '合成研究验证数据，非真实临床试验监查证据',
  versions: [],
  events: [],
}

const DRAFT = {
  ok: true,
  dataSourceMode: 'synthetic',
  disclaimer: EMPTY_ACTIVE.disclaimer,
  draftId: 'DR-0001',
  approvalStatus: 'unapproved',
  studyCode: 'SYN-FICTION-MIST-001',
  studyTitle: '虚构紫雾叶茶对办公打哈欠次数的影响',
  sourceHash: 'abc123',
  unlinkedCriticalData: [],
  candidates: [
    {
      id: 'KRI-01',
      kind: 'kri',
      approvalStatus: 'candidate',
      title: '逾期签署比例',
      quote: '中心每月逾期签署人数/随机人数',
      line: 8,
      rbmCategoryId: 'INFORMED CONSENT',
      linkedProcess: 'CP-01',
      suggestedWarning: 4,
      suggestedAction: 9,
      unit: '百分比',
    },
  ],
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><CtqPrelude /></MemoryRouter>
    </QueryClientProvider>,
  )
}

function respond(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }))
}

describe('CtqPrelude', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('shows a loading state while the approved plan is unread', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}))
    setup()
    expect(screen.getByText(/正在读取生效监测计划/)).toBeInTheDocument()
  })

  it('shows an error instead of a sample plan when the read fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network'))
    setup()
    await waitFor(() => expect(screen.getByText(/生效计划读取失败/)).toBeInTheDocument())
    expect(screen.queryByText(/MP-/)).not.toBeInTheDocument()
  })

  it('shows that nothing is approved yet', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/ctq/versions')) return respond(EMPTY_VERSIONS)
      return respond(EMPTY_ACTIVE)
    })
    setup()
    await waitFor(() => expect(screen.getByText('尚无已批准监测计划')).toBeInTheDocument())
    expect(screen.getByRole('heading', { level: 2, name: '候选与人工批准' })).toBeInTheDocument()
  })

  it('renders an unapproved candidate without creating a version', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.endsWith('/api/ctq/extract')) return respond(DRAFT)
      if (url.includes('/api/ctq/versions')) return respond(EMPTY_VERSIONS)
      return respond(EMPTY_ACTIVE)
    })
    setup()
    await waitFor(() => expect(screen.getByText('尚无已批准监测计划')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '填入合成样例' }))
    fireEvent.click(screen.getByRole('button', { name: '提取候选' }))
    await waitFor(() => expect(screen.getByText(/KRI KRI-01/)).toBeInTheDocument())
    expect(screen.getAllByText(/未批准/).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText(/已写入版本/)).not.toBeInTheDocument()
  })

  it('approves a selected candidate into a new version', async () => {
    let activeBody: Record<string, unknown> = EMPTY_ACTIVE
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST' && url.endsWith('/api/ctq/extract')) return respond(DRAFT)
      if (init?.method === 'POST' && url.includes('/approve')) {
        activeBody = {
          ...EMPTY_ACTIVE,
          active: {
            versionId: 'MP-0001',
            status: 'approved',
            approvalStatus: 'approved',
            studyCode: 'SYN-FICTION-MIST-001',
            studyTitle: DRAFT.studyTitle,
            sourceHash: 'abc123',
            sourceDraftId: 'DR-0001',
            approvedBy: '审阅员-合成甲',
            approvedAt: '2026-11-23T03:00:00+00:00',
            previousVersionId: null,
            rules: [],
            legacyThresholdMap: [{
              rbmCategoryId: 'INFORMED CONSENT',
              warningThreshold: 4,
              actionThreshold: 9,
              monitoringMethod: 'CENTRAL_REVIEW',
              candidateId: 'KRI-01',
              source: 'approved_kri',
            }],
            studyQtls: [],
          },
        }
        return respond({ ok: true, version: { versionId: 'MP-0001' }, activeVersionId: 'MP-0001' })
      }
      if (url.includes('/api/ctq/versions')) {
        const current = activeBody.active as { versionId?: string } | null
        return respond({
          ...EMPTY_VERSIONS,
          versions: current ? [{ versionId: 'MP-0001', status: 'approved' }] : [],
        })
      }
      return respond(activeBody)
    })
    setup()
    await waitFor(() => expect(screen.getByText('尚无已批准监测计划')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('合成方案文本'), { target: { value: '研究编号：SYN-FICTION-MIST-009\n' + '虚构说明。'.repeat(12) } })
    fireEvent.click(screen.getByRole('button', { name: '提取候选' }))
    await waitFor(() => expect(screen.getByLabelText('接受 KRI-01')).toBeInTheDocument())
    fireEvent.click(screen.getByLabelText('接受 KRI-01'))
    fireEvent.change(screen.getByLabelText('操作者'), { target: { value: '审阅员-合成甲' } })
    fireEvent.click(screen.getByRole('button', { name: '批准所选' }))
    await waitFor(() => expect(screen.getByText('已写入版本 MP-0001')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText(/映射 INFORMED CONSENT/)).toBeInTheDocument())
  })

  it('shows an extraction error and does not invent an approved plan', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST') {
        return respond({ ok: false, code: 'NO_CANDIDATES', message: '未识别到关键数据、CtQ 或 QTL/KRI 候选' }, 422)
      }
      if (url.includes('/api/ctq/versions')) return respond(EMPTY_VERSIONS)
      return respond(EMPTY_ACTIVE)
    })
    setup()
    await waitFor(() => expect(screen.getByLabelText('合成方案文本')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('合成方案文本'), { target: { value: '研究编号：SYN-FICTION-EMPTY-001\n' + '没有任何候选标记的虚构说明文字。'.repeat(4) } })
    fireEvent.click(screen.getByRole('button', { name: '提取候选' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('NO_CANDIDATES'))
    expect(screen.queryByText(/已写入版本/)).not.toBeInTheDocument()
    expect(screen.getByText('尚无已批准监测计划')).toBeInTheDocument()
  })
})
