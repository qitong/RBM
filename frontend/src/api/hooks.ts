import { useQuery } from '@tanstack/react-query'
import { apiGet } from './client'

export interface Site {
  id: string
  name: string
  region: string
  enrolled: number
  target: number
  pi: string
}

export interface SiteMetrics {
  siteId: string
  timeline: string[]
  pd: number[]
  ae: number[]
  enrollment: number[]
  query: number[]
}

export function useSites() {
  return useQuery({ queryKey: ['sites'], queryFn: () => apiGet<Site[]>('/api/sites') })
}

export function useSite(id: string) {
  return useQuery({ queryKey: ['site', id], queryFn: () => apiGet<Site>(`/api/sites/${id}`), enabled: !!id })
}

export function useSiteMetrics(id: string) {
  return useQuery({ queryKey: ['site-metrics', id], queryFn: () => apiGet<SiteMetrics>(`/api/sites/${id}/metrics`), enabled: !!id })
}

export interface BenchmarkRow {
  siteId: string
  name: string
  progressPct: number
  pdTotal: number
  pdZScore: number
  queryTotal: number
}

export function useBenchmark() {
  return useQuery({ queryKey: ['benchmark'], queryFn: () => apiGet<BenchmarkRow[]>('/api/benchmark') })
}

export interface CorrelationPoint {
  siteId: string
  name: string
  pdTotal: number
  queryTotal: number
}

export interface CorrelationData {
  points: CorrelationPoint[]
  pearson: number
  spearman: number
  slope: number
  intercept: number
}

export function useCorrelation() {
  return useQuery({ queryKey: ['correlation'], queryFn: () => apiGet<CorrelationData>('/api/correlation') })
}
