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

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`)
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return (await res.json()) as T
}
