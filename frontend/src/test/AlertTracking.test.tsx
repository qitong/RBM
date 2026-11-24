import { useState, type ReactNode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor, act, fireEvent, screen } from '@testing-library/react'
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
})
