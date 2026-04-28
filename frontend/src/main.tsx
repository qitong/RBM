import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { DataSourceProvider } from './context/DataSourceContext'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DataSourceProvider>
        <BrowserRouter basename="/RBM">
          <App />
        </BrowserRouter>
      </DataSourceProvider>
    </QueryClientProvider>
  </StrictMode>,
)
