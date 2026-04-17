import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SiteKpiCards from '../components/site-deep-dive/SiteKpiCards'

describe('SiteKpiCards', () => {
  it('shows enrollment progress percentage', () => {
    render(<SiteKpiCards enrolled={22} target={50} pdTotal={9} aeTotal={4} openQueries={3} />)
    expect(screen.getByText('44%')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('handles zero target without dividing by zero', () => {
    render(<SiteKpiCards enrolled={0} target={0} pdTotal={0} aeTotal={0} openQueries={0} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
