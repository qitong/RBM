import { useState, type ReactNode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor, fireEvent, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThresholdProvider } from '../context/ThresholdContext'
import AlertTracking from '../components/AlertTracking'

function Harness({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }))
  return (
    <QueryClientProvider client={client}>
      <ThresholdProvider>{children}</ThresholdProvider>
    </QueryClientProvider>
  )
}

function envelope(data: unknown) {
  return {
    isSynthetic: true,
    dataSourceMode: 'synthetic',
    disclaimer: '合成研究验证数据，非真实临床试验监查证据',
    fallbackActive: false,
    data,
  }
}

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
}

function risk(id: string, bound: unknown) {
  return {
    id,
    studyId: 'SYN-STUDY-001',
    siteId: 'SYN-SITE-101',
    scope: 'site_kri',
    ctqId: 'CTQ-ICF',
    dimension: 'INFORMED CONSENT',
    title: id,
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
    boundThreshold: bound,
  }
}

describe('AlertTracking shows the bound historical threshold', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('renders the single-risk binding and does not replace it with another approved plan', async () => {
    const listed = {
      traceable: true,
      configVersion: 'v1',
      studyId: 'SYN-STUDY-001',
      unit: 'SD',
      warningThreshold: 2.2,
      actionThreshold: 3.4,
      thresholdId: 'THR-KRI-ICF-V1',
    }
    const opened = { ...listed, warningThreshold: 2.2, actionThreshold: 3.4 }
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/api/rbqm/thresholds')) {
        return jsonResponse(envelope({
          configVersion: 'v2',
          rules: [{ unit: 'SD', warningThreshold: 8, actionThreshold: 9 }],
        }))
      }
      if (url.includes('/api/rbqm/risks/RSK-BOUND')) {
        return jsonResponse(envelope({
          risk: risk('RSK-BOUND', opened),
          audits: [],
          boundThreshold: opened,
        }))
      }
      if (url.includes('/api/rbqm/risks')) {
        return jsonResponse(envelope([risk('RSK-BOUND', listed)]))
      }
      return jsonResponse({
        ok: true,
        active: {
          versionId: 'MP-0009',
          legacyThresholdMap: [{
            rbmCategoryId: 'INFORMED CONSENT',
            warningThreshold: 8,
            actionThreshold: 9,
            monitoringMethod: 'SDV',
            candidateId: 'KRI-09',
            unit: 'SD',
            source: 'approved_kri',
          }],
        },
      })
    })

    render(<Harness><AlertTracking /></Harness>)
    const card = await waitFor(() => {
      const node = document.querySelector('[data-alert-id="RSK-BOUND"]')
      expect(node).toBeTruthy()
      return node as HTMLElement
    })
    const line = card.querySelector('[data-bound-threshold="RSK-BOUND"]') as HTMLElement
    expect(line).toHaveAttribute('data-traceable', 'true')
    expect(line).toHaveAttribute('data-config-version', 'v1')
    expect(line).toHaveAttribute('data-unit', 'SD')
    expect(line).toHaveAttribute('data-warning', '2.2')
    expect(line).toHaveAttribute('data-action', '3.4')
    expect(line).toHaveTextContent('阈值版本 v1 · 单位 SD · 预警界限 2.2 · 行动界限 3.4')
    expect(card).not.toHaveTextContent('8')
    expect(card).not.toHaveTextContent('9')

    fireEvent.click(within(card).getByRole('button', { name: '填写人工研判' }))
    const dialog = await screen.findByRole('dialog')
    await waitFor(() => {
      const openedLine = dialog.querySelector('[data-bound-threshold="RSK-BOUND"]') as HTMLElement
      expect(openedLine).toHaveAttribute('data-warning', '2.2')
      expect(openedLine).toHaveAttribute('data-action', '3.4')
      expect(openedLine).toHaveAttribute('data-unit', 'SD')
    })
    expect(String(vi.mocked(fetch).mock.calls)).toContain('/api/rbqm/risks/RSK-BOUND')
    expect(String(vi.mocked(fetch).mock.calls)).not.toContain('/api/rbqm/thresholds')
  })

  it('shows 无法溯源 when the bound version is missing or the study does not match', async () => {
    const untraceable = { traceable: false, label: '无法溯源' }
    const rows = [
      risk('RSK-KRI-MISSING', untraceable),
      { ...risk('RSK-KRI-WRONG-STUDY', untraceable), studyId: 'SYN-STUDY-002' },
    ]
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/api/rbqm/risks/')) {
        const id = url.split('/').pop()
        const row = rows.find((item) => item.id === id)
        return jsonResponse(envelope({
          risk: row,
          audits: [],
          boundThreshold: untraceable,
        }))
      }
      if (url.includes('/api/rbqm/risks')) {
        return jsonResponse(envelope(rows))
      }
      return jsonResponse({
        ok: true,
        active: {
          legacyThresholdMap: [{
            rbmCategoryId: 'INFORMED CONSENT',
            warningThreshold: 8,
            actionThreshold: 9,
            unit: 'SD',
            candidateId: 'KRI-09',
            source: 'approved_kri',
          }],
        },
      })
    })

    render(<Harness><AlertTracking /></Harness>)
    for (const id of ['RSK-KRI-MISSING', 'RSK-KRI-WRONG-STUDY']) {
      const card = await waitFor(() => {
        const node = document.querySelector(`[data-alert-id="${id}"]`)
        expect(node).toBeTruthy()
        return node as HTMLElement
      })
      const line = card.querySelector(`[data-bound-threshold="${id}"]`) as HTMLElement
      expect(line).toHaveAttribute('data-traceable', 'false')
      expect(line).toHaveTextContent('无法溯源')
      expect(line).not.toHaveAttribute('data-warning')
      expect(line).not.toHaveAttribute('data-action')
      expect(line).not.toHaveAttribute('data-unit')
      expect(card).not.toHaveTextContent('预警界限')
      expect(card).not.toHaveTextContent('8')
      expect(card).not.toHaveTextContent('9')
      fireEvent.click(within(card).getByRole('button', { name: '填写人工研判' }))
      const dialog = await screen.findByRole('dialog')
      await waitFor(() => {
        expect(dialog.querySelector(`[data-bound-threshold="${id}"]`)).toHaveTextContent('无法溯源')
      })
      fireEvent.click(within(dialog).getByRole('button', { name: '返回' }))
    }
  })
})
