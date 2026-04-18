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

  it('renders correlation page at /correlation', () => {
    renderAt('/correlation')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('PD \u00D7 Query \u76F8\u5173\u6027')
  })

  it('renders investigators page at /investigators', () => {
    renderAt('/investigators')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('\u7814\u7A76\u8005\u753B\u50CF')
  })

  it('renders forecast page at /forecast/:siteId', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    renderAt('/forecast/101')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('\u98CE\u9669\u9884\u6D4B')
  })

  it('renders CAPA page at /capa', () => {
    renderAt('/capa')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('CAPA \u6548\u7387\u5206\u6790')
  })
})
