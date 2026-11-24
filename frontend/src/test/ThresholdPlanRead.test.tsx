import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThresholdProvider } from '../context/ThresholdContext'
import ThresholdConfig from '../components/ThresholdConfig'
import { adaptApprovedPlan } from '../ctq/adaptApprovedPlan'
import type { ApprovedMonitoringVersion } from '../api/hooks'

const BASE = {
  ok: true,
  dataSourceMode: 'synthetic',
  disclaimer: '合成研究验证数据，非真实临床试验监查证据',
  riskFieldMap: [],
  readEntry: { page: '/thresholds', appliesTo: [], doesNotOverwrite: [] },
  pendingCapabilities: [{
    id: 'critical-data-extractor',
    status: 'pending_decision',
    reason: '未迁入，也不调用外部模型。',
  }],
}

function approvedBody() {
  return {
    ...BASE,
    active: {
      versionId: 'MP-0001',
      status: 'approved',
      approvalStatus: 'approved',
      studyCode: 'SYN-FICTION-MIST-001',
      studyTitle: '虚构紫雾叶茶',
      sourceHash: 'abc',
      sourceDraftId: 'DR-0001',
      approvedBy: '审阅员-合成甲',
      approvedAt: '2026-11-23T03:00:00+00:00',
      previousVersionId: null,
      rules: [],
      studyQtls: [],
      legacyThresholdMap: [{
        rbmCategoryId: 'INFORMED CONSENT',
        warningThreshold: 4,
        actionThreshold: 9,
        monitoringMethod: 'CENTRAL_REVIEW',
        candidateId: 'KRI-01',
        unit: '百分比',
        source: 'approved_kri',
      }],
    },
    effectiveThresholds: [{
      id: 'INFORMED CONSENT',
      warningThreshold: 4,
      actionThreshold: 9,
      effective: true,
    }],
  }
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }))
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ThresholdProvider>
        <ThresholdConfig />
      </ThresholdProvider>
    </QueryClientProvider>,
  )
}

describe('existing threshold page reads the approved plan', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('shows the approved plan on the existing threshold page', async () => {
    vi.mocked(fetch).mockImplementation(() => jsonResponse(approvedBody()))
    setup()
    await waitFor(() => expect(screen.getByText(/INFORMED CONSENT 已生效预警 4 \/ 行动 9/)).toBeInTheDocument())
    const planSection = screen.getByRole('region', { name: '已生效监测计划' })
    expect(planSection).toHaveTextContent('百分比')
    expect(planSection).toHaveTextContent('不写入 SD 滑块')
    expect(screen.getByRole('region', { name: '合成逾期签署比例' })).toHaveTextContent('判断：行动')
    expect(screen.queryByDisplayValue('9')).not.toBeInTheDocument()
    expect(screen.getByText(/MP-0001/)).toBeInTheDocument()
    expect(screen.getByText(/审阅员-合成甲/)).toBeInTheDocument()
    expect(screen.getByText(/独立待决能力：critical-data-extractor/)).toBeInTheDocument()
  })

  it('does not present an unapproved candidate as an effective rule', async () => {
    vi.mocked(fetch).mockImplementation(() => jsonResponse({
      ...BASE,
      active: null,
      effectiveThresholds: [],
      candidates: [{ id: 'KRI-99', title: '不应生效的候选', approvalStatus: 'candidate' }],
    }))
    setup()
    await waitFor(() => expect(screen.getByText('尚无已批准监测计划')).toBeInTheDocument())
    expect(screen.queryByText(/不应生效的候选/)).not.toBeInTheDocument()
    expect(screen.queryByText(/已生效预警/)).not.toBeInTheDocument()
  })

  it('shows a visible read error instead of a stand-in plan', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network'))
    setup()
    await waitFor(() => expect(screen.getByRole('region', { name: '已生效监测计划' })).toHaveTextContent('生效计划读取失败'))
    expect(screen.getByRole('region', { name: '合成逾期签署比例' })).toHaveTextContent('没有改用静态 JSON')
    expect(screen.queryByText(/已生效预警/)).not.toBeInTheDocument()
    expect(screen.queryByText(/判断：/)).not.toBeInTheDocument()
  })
})

describe('adaptApprovedPlan', () => {
  it('drops anything that is not an approved version', () => {
    const candidate = { approvalStatus: 'candidate', status: 'candidate', legacyThresholdMap: [] } as unknown as ApprovedMonitoringVersion
    expect(adaptApprovedPlan(candidate)).toEqual([])
    expect(adaptApprovedPlan(null)).toEqual([])
  })
})
