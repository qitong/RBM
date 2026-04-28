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
  }
  if (staticMap[path]) return staticMap[path]

  // Dynamic route patterns – e.g. /api/investigators/INV-001
  if (/^\/api\/investigators\/[^/]+$/.test(path)) return '/api/investigators.json'
  if (/^\/api\/sites\/[^/]+$/.test(path)) return '/api/sites.json'

  return null
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
      const base = import.meta.env.BASE_URL ?? '/'
      const fallbackUrl = `${base}${fallback}`.replace(/\/\//g, '/')
      const fbRes = await fetch(fallbackUrl)
      if (fbRes.ok) return (await fbRes.json()) as T
    }
    throw new ApiError(0, `API unavailable and no fallback for: ${path}`)
  }
}
