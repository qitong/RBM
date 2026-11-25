import { useState, type ReactNode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor, act, fireEvent, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThresholdProvider } from '../context/ThresholdContext'
import AlertTracking from '../components/AlertTracking'

let queryClient: QueryClient

function Harness({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const created = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient = created
    return created
  })
  return (
    <QueryClientProvider client={client}>
      <ThresholdProvider>{children}</ThresholdProvider>
    </QueryClientProvider>
  )
}

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

describe('AlertTracking severity follows the current plan', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('recomputes severity after approval without remounting', async () => {
    let active: unknown = null
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/api/rbqm/risks')) {
        return jsonResponse({
          isSynthetic: true,
          dataSourceMode: 'synthetic',
          disclaimer: '合成研究验证数据，非真实临床试验监查证据',
          fallbackActive: false,
          data: [{
            id: 'ALR-1000',
            studyId: 'SYN-STUDY-001',
            siteId: 'SYN-SITE-101',
            scope: 'site_kri',
            ctqId: 'CTQ-ICF',
            dimension: 'INFORMED CONSENT',
            title: '知情同意签署合规性',
            metric: 'informed_consent_sd',
            metricValue: 2.5154154036979937,
            unit: 'SD',
            level: 'warning',
            status: 'Detected',
            configVersion: 'v1',
            rootCause: null,
            assignee: null,
            dueDate: null,
            actionSummary: null,
            effectivenessNote: null,
            taskId: null,
            capaId: null,
          }],
        })
      }
      return jsonResponse({ ok: true, active })
    })
    render(<Harness><AlertTracking /></Harness>)
    await waitFor(() => {
      expect(document.querySelector('[data-alert-id="ALR-1000"]')).toHaveAttribute('data-severity', 'Yellow')
    })

    active = {
      versionId: 'MP-0009',
      status: 'approved',
      approvalStatus: 'approved',
      approvedBy: '审阅员-合成甲',
      legacyThresholdMap: [{
        rbmCategoryId: 'INFORMED CONSENT',
        warningThreshold: 1,
        actionThreshold: 2,
        monitoringMethod: 'SDV',
        candidateId: 'KRI-09',
        unit: 'SD',
        source: 'approved_kri',
      }],
    }
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ['ctq-active'] }) })
    await waitFor(() => {
      expect(document.querySelector('[data-alert-id="ALR-1000"]')).toHaveAttribute('data-severity', 'Red')
    })
  })

  it('keeps the risk open when close is rejected', async () => {
    const risk = {
      id: 'RSK-KRI-101',
      studyId: 'SYN-STUDY-001',
      siteId: 'SYN-SITE-101',
      scope: 'site_kri',
      ctqId: 'CTQ-ICF',
      dimension: 'INFORMED CONSENT',
      title: '知情同意签署合规性',
      metric: 'informed_consent_sd',
      metricValue: 3.5,
      unit: 'SD',
      level: 'action',
      status: 'Detected',
      configVersion: 'v1',
      rootCause: null,
      assignee: null,
      dueDate: null,
      actionSummary: null,
      effectivenessNote: null,
      taskId: null,
      capaId: null,
    }
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input)
      if (url.includes('/transitions')) {
        expect(init?.method).toBe('POST')
        return Promise.resolve(new Response(JSON.stringify({
          ok: false,
          code: 'CLOSE_GUARD',
          message: '不能从 Detected 进入 Closed。状态保持 Detected。',
          missing: ['rootCause', 'assignee', 'effectivenessNote'],
          status: 'Detected',
        }), { status: 422 }))
      }
      if (url.includes('/api/rbqm/risks')) {
        return jsonResponse({ isSynthetic: true, data: [risk] })
      }
      return jsonResponse({ ok: true, active: null })
    })
    render(<Harness><AlertTracking /></Harness>)
    await waitFor(() => expect(document.querySelector('[data-alert-id="RSK-KRI-101"]')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '填写人工研判' }))
    fireEvent.click(screen.getByRole('button', { name: '尝试关闭' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('CLOSE_GUARD'))
    expect(document.querySelector('[data-alert-id="RSK-KRI-101"]')).toHaveTextContent('Detected')
  })

  it('shows the bound historical version, unit, and limits when a risk is opened', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/api/rbqm/risks')) {
        return jsonResponse({
          isSynthetic: true,
          data: [{
            id: 'RSK-KRI-101',
            studyId: 'SYN-STUDY-001',
            siteId: 'SYN-SITE-101',
            scope: 'site_kri',
            ctqId: 'CTQ-ICF',
            dimension: 'INFORMED CONSENT',
            title: '知情同意签署合规性',
            metric: 'informed_consent_sd',
            metricValue: 3.5,
            unit: 'SD',
            level: 'action',
            status: 'Detected',
            configVersion: 'v1',
            warningThreshold: 1.1,
            actionThreshold: 6.6,
            boundThreshold: {
              traceable: true,
              configVersion: 'v1',
              studyId: 'SYN-STUDY-001',
              unit: 'score',
              warningThreshold: 2.2,
              actionThreshold: 3.4,
            },
            rootCause: null,
            assignee: null,
            dueDate: null,
            actionSummary: null,
            effectivenessNote: null,
            taskId: null,
            capaId: null,
          }],
        })
      }
      return jsonResponse({ ok: true, active: null })
    })
    render(<Harness><AlertTracking /></Harness>)
    await waitFor(() => {
      expect(document.querySelector('[data-bound-threshold="RSK-KRI-101"]')).toHaveTextContent(
        '已绑定历史阈值 v1 · 单位 score · 预警 2.2 · 行动 3.4',
      )
    })
    const card = document.querySelector('[data-alert-id="RSK-KRI-101"]') as HTMLElement
    expect(card.querySelector('[data-bound-threshold="RSK-KRI-101"]')).not.toHaveTextContent('1.1')
    expect(card.querySelector('[data-bound-threshold="RSK-KRI-101"]')).not.toHaveTextContent('6.6')
    fireEvent.click(within(card).getByRole('button', { name: '填写人工研判' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelector('[data-bound-threshold="RSK-KRI-101"]')).toHaveTextContent(
      '已绑定历史阈值 v1 · 单位 score · 预警 2.2 · 行动 3.4',
    )
  })

  it('shows 无法溯源 when the bound version cannot be traced', async () => {
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/api/rbqm/risks')) {
        return jsonResponse({
          isSynthetic: true,
          data: [{
            id: 'RSK-KRI-20261125-409',
            studyId: 'SYN-STUDY-001',
            siteId: 'SYN-SITE-409',
            scope: 'site_kri',
            ctqId: 'CTQ-ICF',
            dimension: 'INFORMED CONSENT',
            title: '研究号不符的合成信号',
            metric: 'informed_consent_sd',
            metricValue: 3.5,
            unit: 'SD',
            level: 'action',
            status: 'Detected',
            configVersion: 'v1',
            warningThreshold: 8.5,
            actionThreshold: 9.5,
            boundThreshold: { traceable: false, traceLabel: '无法溯源' },
            rootCause: null,
            assignee: null,
            dueDate: null,
            actionSummary: null,
            effectivenessNote: null,
            taskId: null,
            capaId: null,
          }],
        })
      }
      return jsonResponse({ ok: true, active: null })
    })
    render(<Harness><AlertTracking /></Harness>)
    await waitFor(() => {
      expect(document.querySelector('[data-bound-threshold="RSK-KRI-20261125-409"]')).toHaveTextContent('无法溯源')
    })
    const card = document.querySelector('[data-alert-id="RSK-KRI-20261125-409"]') as HTMLElement
    expect(card.querySelector('[data-bound-threshold="RSK-KRI-20261125-409"]')?.textContent).toBe('无法溯源')
    fireEvent.click(within(card).getByRole('button', { name: '填写人工研判' }))
    const dialog = screen.getByRole('dialog')
    const readout = dialog.querySelector('[data-bound-threshold="RSK-KRI-20261125-409"]')
    expect(readout?.textContent).toBe('无法溯源')
    expect(dialog.textContent).not.toContain('预警')
    expect(dialog.textContent).not.toContain('8.5')
    expect(dialog.textContent).not.toContain('9.5')
    expect(dialog.textContent).not.toContain('已绑定历史阈值')
  })
})
