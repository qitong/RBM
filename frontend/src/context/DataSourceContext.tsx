import { createContext, useContext, type ReactNode } from 'react'

export type DataSource = 'mock' | 'api'

interface Ctx { source: DataSource }

const DataSourceContext = createContext<Ctx | undefined>(undefined)

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const env = (import.meta.env.VITE_DATA_SOURCE ?? 'mock') as DataSource
  const source: DataSource = env === 'api' ? 'api' : 'mock'
  return <DataSourceContext.Provider value={{ source }}>{children}</DataSourceContext.Provider>
}

export function useDataSource() {
  const ctx = useContext(DataSourceContext)
  if (!ctx) throw new Error('useDataSource must be used within DataSourceProvider')
  return ctx
}
