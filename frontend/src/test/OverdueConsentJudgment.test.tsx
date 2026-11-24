import { useState, type ReactNode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThresholdProvider } from '../context/ThresholdContext'
import OverdueConsentJudgment from '../components/OverdueConsentJudgment'

function Harness({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <ThresholdProvider>{children}</ThresholdProvider>
    </QueryClientProvider>
  )
}

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

function plan(unit: string) {
  return {
    ok: true,
    active: {
      versionId: 'MP-0001',
      status: 'approved',
      approvalStatus: 'approved',
      approvedBy: '审阅员-合成甲',
      legacyThresholdMap: [{
        rbmCategoryId: 'INFORMED CONSENT',
        warningThreshold: 4,
        actionThreshold: 9,
        monitoringMethod: 'CENTRAL_REVIEW',
        candidateId: 'KRI-01',
        unit,
        source: 'approved_kri',
      }],
    },
  }
}

describe('OverdueConsentJudgment', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows an action for the synthetic 9 percent rate and leaves the SD preset alone', async () => {
    localStorage.setItem('rbm_threshold_configs', JSON.stringify({
      categories: [
        { id: 'INFORMED CONSENT', label: '知情同意', weight: 0.25, warningThreshold: 2, actionThreshold: 3, enabled: true },
      ],
    }))
    vi.mocked(fetch).mockImplementation(() => jsonResponse(plan('百分比')))
    render(<Harness><OverdueConsentJudgment /></Harness>)
    const result = await screen.findByText(/判断：行动/)
    expect(result).toHaveAttribute('data-unit', '百分比')
    expect(result).toHaveAttribute('data-judgment', 'action')
    expect(screen.getByText(/合成值 9，单位百分比/)).toBeInTheDocument()
    expect(screen.getByText(/不写入 SD 滑块/)).toBeInTheDocument()
  })

  it('does not invent a level when the plan cannot be read', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))
    render(<Harness><OverdueConsentJudgment /></Harness>)
    const failure = await screen.findByRole('alert')
    expect(failure).toHaveAttribute('data-judgment', 'failed')
    expect(failure).toHaveTextContent('没有改用静态 JSON')
    expect(screen.queryByText(/判断：/)).not.toBeInTheDocument()
  })

  it('rejects an SD unit instead of judging 9 as 9 SD', async () => {
    vi.mocked(fetch).mockImplementation(() => jsonResponse(plan('SD')))
    render(<Harness><OverdueConsentJudgment /></Harness>)
    const failure = await screen.findByRole('alert')
    await waitFor(() => expect(failure).toHaveAttribute('data-failure', 'WRONG_UNIT'))
    expect(screen.queryByText(/判断：行动/)).not.toBeInTheDocument()
  })
})
