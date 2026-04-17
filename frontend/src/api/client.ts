export class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`API ${status}: ${body}`)
  }
}

const baseUrl = () => (import.meta.env.VITE_API_BASE_URL ?? '').toString()

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`)
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return (await res.json()) as T
}
