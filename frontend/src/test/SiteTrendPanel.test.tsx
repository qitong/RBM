import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SiteTrendPanel from '../components/site-deep-dive/SiteTrendPanel'
import type { SiteMetrics } from '../api/hooks'

const metrics: SiteMetrics = {
  siteId: '101',
  timeline: ['2025-01', '2025-02', '2025-03'],
  pd: [1, 2, 3],
  ae: [0, 1, 1],
  enrollment: [2, 5, 9],
  query: [3, 2, 4],
}

describe('SiteTrendPanel', () => {
  it('renders all 4 trend titles', () => {
    render(<SiteTrendPanel metrics={metrics} />)
    expect(screen.getByText('PD \u6708\u5EA6\u8D8B\u52BF')).toBeInTheDocument()
    expect(screen.getByText('AE \u7D2F\u8BA1')).toBeInTheDocument()
    expect(screen.getByText('\u5165\u7EC4\u66F2\u7EBF')).toBeInTheDocument()
    expect(screen.getByText('Query \u54CD\u5E94')).toBeInTheDocument()
  })
})
