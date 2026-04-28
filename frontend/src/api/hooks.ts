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

export interface TrendPoint {
  x: number
  y: number
}

export interface TrendAnalysis {
  trendLine: TrendPoint[]
  upperBand: TrendPoint[]
  lowerBand: TrendPoint[]
  slope: number
  intercept: number
  r_squared: number
}

export interface BenchmarkData {
  points: BenchmarkRow[]
  trend: TrendAnalysis
}

export function useBenchmark() {
  return useQuery({ queryKey: ['benchmark'], queryFn: () => apiGet<BenchmarkData>('/api/benchmark') })
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

export interface Investigator {
  id: string
  name: string
  experience: string
  siteIds: string[]
}

export interface InvestigatorMetrics {
  investigatorId: string
  timeline: string[]
  pdByCategory: Record<string, number[]>
  pdTotal: number[]
  aeCounts: number[]
}

export function useInvestigators() {
  return useQuery({ queryKey: ['investigators'], queryFn: () => apiGet<Investigator[]>('/api/investigators') })
}

export function useInvestigator(id: string) {
  return useQuery({ queryKey: ['investigator', id], queryFn: () => apiGet<Investigator>(`/api/investigators/${id}`), enabled: !!id })
}

export function useInvestigatorMetrics(id: string) {
  return useQuery({ queryKey: ['investigator-metrics', id], queryFn: () => apiGet<InvestigatorMetrics>(`/api/investigators/${id}/metrics`), enabled: !!id })
}

export interface ForecastSeries {
  forecast: number[]
  lower: number[]
  upper: number[]
  slope: number
  intercept: number
}

export interface ForecastData {
  siteId: string
  historical: { timeline: string[]; pd: number[]; ae: number[] }
  forecastTimeline: string[]
  pd: ForecastSeries
  ae: ForecastSeries
}

export function useForecast(siteId: string) {
  return useQuery({
    queryKey: ['forecast', siteId],
    queryFn: () => apiGet<ForecastData>(`/api/sites/${siteId}/forecast`),
    enabled: !!siteId,
  })
}

export interface CapaRecord {
  id: string
  siteId: string
  category: string
  openDate: string
  closeDate: string
  status: string
  cycleTimeDays?: number
}

export interface CapaSiteEfficiency {
  siteId: string
  avgCycleTimeDays: number
  count: number
  closureRate: number
}

export interface CapaCategoryEfficiency {
  category: string
  avgCycleTimeDays: number
  count: number
}

export interface CapaEfficiency {
  avgCycleTimeDays: number
  medianCycleTimeDays: number
  closureRate: number
  bySite: CapaSiteEfficiency[]
  byCategory: CapaCategoryEfficiency[]
}

export function useCapaList() {
  return useQuery({ queryKey: ['capa'], queryFn: () => apiGet<CapaRecord[]>('/api/capa') })
}

export function useCapaEfficiency() {
  return useQuery({ queryKey: ['capa-efficiency'], queryFn: () => apiGet<CapaEfficiency>('/api/capa/efficiency') })
}

export interface Task {
  taskId: string
  title: string
  relatedAlertId: string | null
  siteId: string
  siteName: string
  assignee: string
  category: string
  status: 'To Do' | 'In Progress' | 'Resolved'
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  createdAt: string
  dueDate: string
}

export function useTaskList() {
  return useQuery({ queryKey: ['tasks'], queryFn: () => apiGet<Task[]>('/api/tasks') })
}

export interface SubjectEvent {
  type: 'AE' | 'PD' | 'MissedVisit'
  date: string
  severity: string
  description: string
}

export interface Subject {
  subjectId: string
  siteId: string
  siteName: string
  enrollmentDate: string
  riskScore: number
  aeCount: number
  pdCount: number
  missedVisitCount: number
  events: SubjectEvent[]
}

export function useSubjectList() {
  return useQuery({ queryKey: ['subjects'], queryFn: () => apiGet<Subject[]>('/api/subjects') })
}

export interface SiteDataQuality {
  siteId: string
  siteName: string
  metricsMonth: string
  avgEntryDelayDays: number
  totalQueriesIssued: number
  openQueries: number
  resolvedQueries: number
  avgQueryResolutionDays: number
  missingPagesCount: number
}

export function useDataQuality() {
  return useQuery({ queryKey: ['data-quality'], queryFn: () => apiGet<SiteDataQuality[]>('/api/data-quality') })
}

export interface ForecastHistoryPoint {
  month: string
  value: number
}

export interface SiteForecast {
  siteId: string
  siteName: string
  metricName: string
  historicalData: ForecastHistoryPoint[]
  forecast: {
    nextMonth: string
    predictedValue: number
    confidenceInterval: [number, number]
  }
}

export function useRiskForecast() {
  return useQuery({ queryKey: ['risk-forecast'], queryFn: () => apiGet<SiteForecast[]>('/api/risk-forecast') })
}

export type AuditActionType =
  | 'UPDATE_THRESHOLD'
  | 'CLOSE_ALERT'
  | 'CREATE_TASK'
  | 'RESOLVE_TASK'
  | 'UPDATE_SUBJECT'
  | 'EXPORT_REPORT'

export interface AuditLog {
  logId: string
  timestamp: string
  userId: string
  userName: string
  actionType: AuditActionType
  description: string
  details: Record<string, unknown>
}

export function useAuditLogs() {
  return useQuery({ queryKey: ['audit-logs'], queryFn: () => apiGet<AuditLog[]>('/api/audit-logs') })
}

export type ReportType = 'Monthly' | 'SiteDeepDive' | 'CapaAnalysis' | 'Custom'

export interface ReportSummary {
  totalCriticalAlerts: number
  unresolvedTasks: number
  avgEntryDelayDays: number
  highestRiskSite: string
}

export interface Report {
  reportId: string
  title: string
  type: ReportType
  period: string
  generatedBy: string
  generatedAt: string
  status: 'Ready' | 'Generating' | 'Failed'
  format: 'PDF' | 'Excel'
  sizeMb: number
  summary: ReportSummary
}

export function useReportList() {
  return useQuery({ queryKey: ['reports'], queryFn: () => apiGet<Report[]>('/api/reports') })
}
