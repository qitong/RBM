export class ApiError extends Error {
  status: number
  body: string
  constructor(status: number, body: string) {
    super(`API ${status}: ${body}`)
    this.status = status
    this.body = body
  }
}

const baseUrl = () => (import.meta.env.VITE_API_BASE_URL ?? '').toString()

/**
 * Maps API paths to static JSON fallback files in /public/api/.
 * Used when the backend server is unavailable (e.g. GitHub Pages deployment).
 */
function getFallbackPath(path: string): string | null {
  // Exact match routes
  const staticMap: Record<string, string> = {
    '/api/benchmark': '/api/benchmark.json',
    '/api/correlation': '/api/correlation.json',
    '/api/investigators': '/api/investigators.json',
    '/api/sites': '/api/sites.json',
    '/api/capa': '/api/capa.json',
    '/api/capa/efficiency': '/api/capa/efficiency.json',
    '/api/tasks': '/api/tasks.json',
    '/api/subjects': '/api/subjects.json',
    '/api/data-quality': '/api/data-quality.json',
    '/api/risk-forecast': '/api/risk-forecast.json',
    '/api/audit-logs': '/api/audit-logs.json',
    '/api/reports': '/api/reports.json',
    // /api/ctq/* is intentionally absent. Plan and approval failures must stay visible.
  }
  if (staticMap[path]) return staticMap[path]

  // Dynamic route patterns
  if (/^\/api\/investigators\/[^/]+$/.test(path)) return '/api/investigators.json'
  if (/^\/api\/sites\/[^/]+$/.test(path)) return '/api/sites.json'
  if (/^\/api\/investigators\/[^/]+\/metrics$/.test(path)) return 'mock_investigator_metrics'
  if (/^\/api\/sites\/[^/]+\/metrics$/.test(path)) return 'mock_site_metrics'

  return null
}

function generateMockMetrics(id: string, type: 'investigator' | 'site') {
  if (type === 'investigator') {
    return {
      investigatorId: id,
      timeline: ['2023-08', '2023-09', '2023-10', '2023-11', '2023-12', '2024-01'],
      pdByCategory: {
        '知情同意': [1, 2, 0, 1, 0, 0],
        '入排标准': [0, 1, 1, 0, 0, 0],
        '试验用药': [0, 0, 0, 1, 1, 0]
      },
      pdTotal: [1, 3, 1, 2, 1, 0],
      aeCounts: [2, 1, 3, 2, 4, 1]
    }
  }
  return {
    siteId: id,
    timeline: ['2023-08', '2023-09', '2023-10', '2023-11', '2023-12', '2024-01'],
    pd: [2, 4, 1, 3, 2, 1],
    ae: [5, 3, 6, 4, 7, 2],
    enrollment: [10, 15, 12, 18, 14, 20],
    query: [8, 12, 5, 9, 6, 3]
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const url = `${baseUrl()}${path}`

  try {
    const res = await fetch(url)
    if (res.ok) return (await res.json()) as T

    // If the backend returned an error, try fallback
    throw new ApiError(res.status, await res.text())
  } catch {
    // Backend unavailable – try static JSON fallback
    const fallback = getFallbackPath(path)
    if (fallback) {
      if (fallback.startsWith('mock_')) {
        const idMatch = path.match(/^\/api\/(?:investigators|sites)\/([^/]+)\/metrics$/)
        if (idMatch) {
          const type = path.includes('investigators') ? 'investigator' : 'site'
          return generateMockMetrics(idMatch[1], type) as unknown as T
        }
      }

      const base = import.meta.env.BASE_URL ?? '/'
      const fallbackUrl = `${base}${fallback}`.replace(/\/\//g, '/')
      const fbRes = await fetch(fallbackUrl)
      if (fbRes.ok) {
        const data = await fbRes.json()
        
        if (Array.isArray(data)) {
          const invMatch = path.match(/^\/api\/investigators\/([^/]+)$/)
          if (invMatch) {
            const item = data.find(i => i.id === invMatch[1])
            if (item) return item as unknown as T
            throw new ApiError(404, 'Not found in mock data')
          }
          const siteMatch = path.match(/^\/api\/sites\/([^/]+)$/)
          if (siteMatch) {
            const item = data.find(s => s.id === siteMatch[1] || s.siteId === siteMatch[1])
            if (item) return item as unknown as T
            throw new ApiError(404, 'Not found in mock data')
          }
        }
        
        return data as T
      }
    }
    throw new ApiError(0, `API unavailable and no fallback for: ${path}`)
  }
}

/** Plan, approval, and rollback calls. A failed response is returned as an error. */
export async function apiSendStrict<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new ApiError(res.status, text || res.statusText)
  return (text ? JSON.parse(text) : null) as T
}
