import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { DataSourceProvider, useDataSource } from '../context/DataSourceContext'

describe('useDataSource', () => {
  it('defaults to "mock" when env unset', () => {
    delete (import.meta.env as any).VITE_DATA_SOURCE
    const { result } = renderHook(() => useDataSource(), { wrapper: DataSourceProvider })
    expect(result.current.source).toBe('mock')
  })

  it('reads "api" from env', () => {
    (import.meta.env as any).VITE_DATA_SOURCE = 'api'
    const { result } = renderHook(() => useDataSource(), { wrapper: DataSourceProvider })
    expect(result.current.source).toBe('api')
  })
})
