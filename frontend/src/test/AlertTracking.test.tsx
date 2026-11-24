import { useState, type ReactNode } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
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
    vi.mocked(fetch).mockImplementation(() => jsonResponse({ ok: true, active }))
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
})
