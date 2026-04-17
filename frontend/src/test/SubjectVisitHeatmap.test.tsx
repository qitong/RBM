import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import SubjectVisitHeatmap from '../components/site-deep-dive/SubjectVisitHeatmap'

describe('SubjectVisitHeatmap', () => {
  it('renders a grid of subjects x visits', () => {
    const { container } = render(<SubjectVisitHeatmap siteId="101" subjects={5} visits={6} />)
    expect(container.querySelectorAll('[data-cell]').length).toBe(5 * 6)
  })

  it('is deterministic for the same siteId', () => {
    const a = render(<SubjectVisitHeatmap siteId="101" subjects={3} visits={3} />).container.innerHTML
    const b = render(<SubjectVisitHeatmap siteId="101" subjects={3} visits={3} />).container.innerHTML
    expect(a).toBe(b)
  })
})
