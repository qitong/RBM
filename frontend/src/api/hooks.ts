import { useQuery } from '@tanstack/react-query'
import { apiGet, apiGetStrict, apiSendStrict } from './client'

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
  return useQuery({
    queryKey: ['capa'],
    queryFn: async () => {
      const body = unwrapContract<CapaRecord[]>(await apiGetStrict<unknown>('/api/rbqm/actions'))
      if (!Array.isArray(body)) throw new Error('CAPA action contract mismatch')
      return body
    },
  })
}

export function useCapaEfficiency() {
  return useQuery({
    queryKey: ['capa-efficiency'],
    queryFn: async () => {
      const body = unwrapContract<CapaEfficiency>(await apiGetStrict<unknown>('/api/rbqm/capa/efficiency'))
      if (!body || typeof body !== 'object' || !('avgCycleTimeDays' in body)) {
        throw new Error('CAPA efficiency contract mismatch')
      }
      return body
    },
  })
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
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const body = unwrapContract<Task[]>(await apiGetStrict<unknown>('/api/rbqm/tasks'))
      if (!Array.isArray(body)) throw new Error('task contract mismatch')
      return body
    },
  })
}

export type ClinicalEventType = 'AE' | 'SAE' | 'Diagnosis' | 'LabFinding' | 'TreatmentChange' | 'Surgery' | 'Progression' | 'Hospitalization'
export type TrialEventType = 'Screening' | 'Enrollment' | 'Visit' | 'PD' | 'MissedVisit' | 'EarlyTermination' | 'StudyDrugHold'

export interface ClinicalEvent {
  type: ClinicalEventType
  date: string
  severity: string
  description: string
}

export interface TrialEvent {
  type: TrialEventType
  date: string
  severity: string
  description: string
}

export interface ProblemItem {
  diagnosis: string
  onsetDate: string
  category: string
}

export interface Treatment {
  name: string
  type: 'medication' | 'surgery' | 'procedure'
  startDate: string
  status: 'ongoing' | 'discontinued' | 'completed'
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
  problemList: ProblemItem[]
  treatments: Treatment[]
  clinicalEvents: ClinicalEvent[]
  trialEvents: TrialEvent[]
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
  | 'STATE_TRANSITION'

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
  return useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const body = unwrapContract<AuditLog[] | { logs: AuditLog[] }>(await apiGetStrict<unknown>('/api/rbqm/audit'))
      if (Array.isArray(body)) return body
      if (body && Array.isArray(body.logs)) return body.logs
      throw new Error('audit contract mismatch')
    },
  })
}

function unwrapContract<T>(payload: unknown): T {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'isSynthetic' in payload &&
    'data' in payload
  ) {
    return (payload as { data: T }).data
  }
  return payload as T
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

export type CtqCandidateKind = 'critical_data' | 'ctq' | 'qtl' | 'kri'
export type MonitoringMethod = 'SDV' | 'SDR' | 'CENTRAL_REVIEW' | 'SYSTEM_CHECK'

export interface CtqCandidate {
  id: string
  kind: CtqCandidateKind
  approvalStatus: 'candidate'
  title: string
  quote: string
  line: number
  rbmCategoryId: string | null
  linkedProcess: string | null
  suggestedWarning: number | null
  suggestedAction: number | null
  unit: string | null
}

export interface CtqDraft {
  ok: true
  dataSourceMode: 'synthetic'
  disclaimer: string
  draftId: string
  approvalStatus: 'unapproved'
  studyCode: string
  studyTitle: string
  sourceHash: string
  unlinkedCriticalData: string[]
  candidates: CtqCandidate[]
}

export interface MonitoringRule {
  candidateId: string
  kind: CtqCandidateKind
  title: string
  rbmCategoryId: string | null
  warningThreshold: number | null
  actionThreshold: number | null
  monitoringMethod: MonitoringMethod
  quote: string
  line: number
}

export interface LegacyThresholdMapping {
  rbmCategoryId: string
  warningThreshold: number
  actionThreshold: number
  monitoringMethod: MonitoringMethod
  candidateId: string
  unit?: string | null
  source: 'approved_kri'
}

export interface ApprovedMonitoringVersion {
  versionId: string
  status: 'approved' | 'superseded' | 'rolled_back'
  approvalStatus: 'approved'
  studyCode: string
  studyTitle: string
  sourceHash: string
  sourceDraftId: string
  approvedBy: string
  approvedAt: string
  previousVersionId: string | null
  rules: MonitoringRule[]
  legacyThresholdMap: LegacyThresholdMapping[]
  studyQtls: MonitoringRule[]
}

export interface ActivePlanResponse {
  ok: true
  dataSourceMode: 'synthetic'
  disclaimer: string
  active: ApprovedMonitoringVersion | null
  effectiveThresholds?: Array<{
    id: string
    warningThreshold: number
    actionThreshold: number
    monitoringMethod: string | null
    candidateId: string | null
    versionId: string | null
    effective: boolean
  }>
  pendingCapabilities?: Array<{ id: string; status: string; reason: string }>
  riskFieldMap: Array<{ rbmField: string; joinsOn?: string; source?: string; note?: string }>
  readEntry: { page?: string; appliesTo: string[]; doesNotOverwrite: string[] }
}

export interface CtqVersionsResponse {
  ok: true
  dataSourceMode: 'synthetic'
  disclaimer: string
  versions: ApprovedMonitoringVersion[]
  events: Array<{ eventId: string; type: string; at: string; operator: string | null }>
}

export function useActiveMonitoringPlan() {
  return useQuery({
    queryKey: ['ctq-active'],
    queryFn: () => apiSendStrict<ActivePlanResponse>('/api/ctq/active'),
  })
}

export function useCtqVersions() {
  return useQuery({
    queryKey: ['ctq-versions'],
    queryFn: () => apiSendStrict<CtqVersionsResponse>('/api/ctq/versions'),
  })
}

export type RbqmStatus =
  | 'Detected'
  | 'Triaged'
  | 'Under_RCA'
  | 'Action_In_Progress'
  | 'Escalated'
  | 'Effectiveness_Check'
  | 'Closed'

export interface RbqmRisk {
  id: string
  studyId: string
  siteId: string | null
  scope: 'site_kri' | 'study_qtl'
  ctqId: string
  dimension: string
  title: string
  metric: string
  metricValue: number
  unit: string
  level: 'action' | 'warning'
  status: RbqmStatus | string
  configVersion: string
  rootCause: string | null
  assignee: string | null
  dueDate: string | null
  actionSummary: string | null
  effectivenessNote: string | null
  taskId: string | null
  capaId: string | null
}

export interface RbqmSiteComparison {
  seed: number
  points: Array<{ siteId: string; siteLabel: string; counts: Record<string, number> }>
  visits: Record<string, Array<Record<string, string | number>>>
}

export interface RbqmThresholdRule {
  thresholdId?: string
  configVersion?: string
  scope: string
  ctqId: string
  metric: string
  dimension?: string
  unit: string
  warningThreshold: number
  actionThreshold: number
  weight: number
  rationale?: string
}

export interface RbqmThresholds {
  configVersion: string
  versions: Array<{ configVersion: string; operator?: string; rules: RbqmThresholdRule[] }>
  rules: RbqmThresholdRule[]
}

export function useRbqmRisks() {
  return useQuery({
    queryKey: ['rbqm-risks'],
    queryFn: async () => {
      const body = unwrapContract<RbqmRisk[]>(await apiGetStrict<unknown>('/api/rbqm/risks'))
      if (!Array.isArray(body)) throw new Error('RBQM risks contract mismatch')
      return body
    },
  })
}

export function useRbqmSiteComparison() {
  return useQuery({
    queryKey: ['rbqm-site-comparison'],
    queryFn: async () => {
      const body = unwrapContract<RbqmSiteComparison>(await apiGetStrict<unknown>('/api/rbqm/sites/comparison'))
      if (!body || !Array.isArray(body.points)) throw new Error('site comparison contract mismatch')
      return body
    },
  })
}

export function useRbqmThresholds() {
  return useQuery({
    queryKey: ['rbqm-thresholds'],
    queryFn: async () => {
      const body = unwrapContract<RbqmThresholds>(await apiGetStrict<unknown>('/api/rbqm/thresholds'))
      if (!body || !Array.isArray(body.versions)) return null
      return body
    },
  })
}

export function postRiskTransition(id: string, body: Record<string, unknown>) {
  return apiSendStrict(`/api/rbqm/risks/${id}/transitions`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function postThresholdVersion(body: Record<string, unknown>) {
  return apiSendStrict('/api/rbqm/thresholds', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
