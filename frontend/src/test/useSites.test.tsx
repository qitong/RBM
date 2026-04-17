import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSites } from '../api/hooks'

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useSites', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })

  it('returns sites on success', async () => {
    (fetch as any).mockResolvedValue(new Response(JSON.stringify([{ id: '101' }]), { status: 200 }))
    const { result } = renderHook(() => useSites(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: '101' }])
  })
})
