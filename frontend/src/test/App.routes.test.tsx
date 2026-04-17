import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DataSourceProvider } from '../context/DataSourceContext'
import App from '../App'

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <DataSourceProvider>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </DataSourceProvider>
    </QueryClientProvider>,
  )
}

describe('App routes', () => {
  it('renders dashboard at /dashboard', () => {
    renderAt('/dashboard')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('全局风险大屏')
  })

  it('renders alerts at /alerts', () => {
    renderAt('/alerts')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('预警跟踪与闭环')
  })

  it('renders thresholds at /thresholds', () => {
    renderAt('/thresholds')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('预警阈值配置')
  })
})
