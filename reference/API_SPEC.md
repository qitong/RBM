# RBM 系统 REST API 接口规范 (v1.0)

**Base URL**: `{VITE_API_BASE_URL}/api/v1`
**协议**: HTTPS | **编码**: UTF-8 | **时间格式**: ISO 8601 (`YYYY-MM-DDTHH:mm:ssZ`)

---

## 通用约定

### 统一响应信封 (Response Envelope)

所有接口必须返回以下结构：

```typescript
interface ApiResponse<T> {
  code: number          // 200=成功, 400=参数错误, 401=未认证, 403=无权限, 500=服务端错误
  message: string       // 人类可读的提示信息
  data: T               // 业务数据
  timestamp: string     // 服务端响应时间 ISO 8601
}
```

### 分页请求参数 (Pagination)

适用于所有列表类接口：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 当前页码，从 1 开始 |
| `pageSize` | number | 20 | 每页条数，最大 100 |
| `sortBy` | string | - | 排序字段名 |
| `sortOrder` | `'asc'` \| `'desc'` | `'desc'` | 排序方向 |

分页响应结构：

```typescript
interface PaginatedResponse<T> {
  items: T[]
  total: number         // 总记录数
  page: number
  pageSize: number
  totalPages: number
}
```

### 筛选参数约定

- 时间范围：`startDate` / `endDate`，格式 `YYYY-MM-DD`
- 多值筛选：逗号分隔，如 `status=Open,In Review`
- 模糊搜索：`keyword` 参数

---

## 一、现有模块接口 (Existing Modules)

### E1. 中心管理 (Sites)

#### `GET /sites`
获取所有研究中心列表。

| Query 参数 | 类型 | 必填 | 说明 |
|------------|------|------|------|
| `region` | string | 否 | 按地区筛选 |

**Response `data`**:
```typescript
interface Site {
  id: string
  name: string
  region: string
  enrolled: number
  target: number
  pi: string            // 主要研究者姓名
}
// data: Site[]
```

#### `GET /sites/:siteId`
获取单个中心详情。

#### `GET /sites/:siteId/metrics`
获取中心时间序列指标。

**Response `data`**:
```typescript
interface SiteMetrics {
  siteId: string
  timeline: string[]    // ["2026-01", "2026-02", ...]
  pd: number[]          // 协议偏差数
  ae: number[]          // 不良事件数
  enrollment: number[]  // 入组人数
  query: number[]       // 质疑数
}
```

---

### E2. 全局风险大盘 (Dashboard)

#### `GET /dashboard/progress-matrix`
获取进度-类别热力矩阵数据。

**Response `data`**:
```typescript
interface ProgressMatrixItem {
  category: string        // "INFORMED CONSENT" | "INCLUSION EXCLUSION" | ...
  label: string           // "知情同意"
  progress: number        // 10, 20, ... 100 (进度百分比刻度)
  value: number           // PD 加权得分
  alertLevel: 'Green' | 'Yellow' | 'Red'
}
// data: ProgressMatrixItem[]
```

#### `GET /dashboard/visit-trends`
获取各访视的分维度 PD 趋势数据。

**Response `data`**:
```typescript
interface VisitTrendItem {
  visit: number
  [category: string]: number  // 各分类的加权得分
  Weighted_Overall: number
}
// data: VisitTrendItem[]
```

#### `GET /dashboard/categories`
获取 PD 分类及权重配置。

**Response `data`**:
```typescript
interface CategoryConfig {
  id: string       // "INFORMED CONSENT"
  label: string    // "知情同意"
  weight: number   // 0.25
}
// data: CategoryConfig[]
```

---

### E3. 预警追踪 (Alert Tracking)

#### `GET /alerts`

| Query 参数 | 类型 | 必填 | 说明 |
|------------|------|------|------|
| `status` | string | 否 | `Open,In Review,Closed` |
| `siteId` | string | 否 | 按中心筛选 |
| `dimension` | string | 否 | 按分类筛选 |
| `page` / `pageSize` | number | 否 | 分页 |

**Response `data`**:
```typescript
interface Alert {
  id: string              // "ALR-1000"
  project: string         // "ADV-2024"
  site: number            // 中心编号
  dimension: string       // PD 分类
  metricValue: number     // 触发值
  status: 'Open' | 'In Review' | 'Closed'
}
// data: PaginatedResponse<Alert>
```

#### `PATCH /alerts/:alertId`
更新预警状态。

**Request Body**:
```typescript
{ status: 'Open' | 'In Review' | 'Closed'; reason?: string }
```

---

### E4. 中心对比 (Benchmark)

#### `GET /benchmark`

**Response `data`**:
```typescript
interface BenchmarkData {
  points: BenchmarkRow[]
  trend: TrendAnalysis
}
interface BenchmarkRow {
  siteId: string
  name: string
  progressPct: number
  pdTotal: number
  pdZScore: number
  queryTotal: number
}
interface TrendAnalysis {
  trendLine: { x: number; y: number }[]
  upperBand: { x: number; y: number }[]
  lowerBand: { x: number; y: number }[]
  slope: number
  intercept: number
  r_squared: number
}
```

#### `GET /correlation`
PD 与 Query 的相关性分析。

**Response `data`**:
```typescript
interface CorrelationData {
  points: { siteId: string; name: string; pdTotal: number; queryTotal: number }[]
  pearson: number
  spearman: number
  slope: number
  intercept: number
}
```

---

### E5. CAPA 管理

#### `GET /capa`
**Response `data`**: `CapaRecord[]`

#### `GET /capa/efficiency`
**Response `data`**:
```typescript
interface CapaEfficiency {
  avgCycleTimeDays: number
  medianCycleTimeDays: number
  closureRate: number
  bySite: { siteId: string; avgCycleTimeDays: number; count: number; closureRate: number }[]
  byCategory: { category: string; avgCycleTimeDays: number; count: number }[]
}
```

---

## 二、扩展模块接口 (M1 – M6)

### M1. 工单中心 (Task Center)

#### `GET /tasks`

| Query 参数 | 类型 | 必填 | 说明 |
|------------|------|------|------|
| `status` | string | 否 | `To Do,In Progress,Resolved` |
| `priority` | string | 否 | `Low,Medium,High` |
| `assignee` | string | 否 | 指派人 userId |
| `siteId` | string | 否 | 按中心筛选 |
| `isOverdue` | boolean | 否 | 仅返回超时工单 |
| `page` / `pageSize` | number | 否 | 分页 |

**Response `data`**:
```typescript
interface Task {
  taskId: string               // "TASK-2026-001"
  title: string                // 工单标题
  description: string          // 描述
  relatedAlertId: string       // 关联预警 ID
  siteId: string
  assigneeId: string
  assigneeName: string
  status: 'To Do' | 'In Progress' | 'Resolved'
  priority: 'Low' | 'Medium' | 'High'
  createdAt: string            // ISO 8601
  dueDate: string              // ISO 8601
  resolvedAt: string | null
  isOverdue: boolean           // 后端计算: now > dueDate && status !== 'Resolved'
}
// data: PaginatedResponse<Task>
```

#### `POST /tasks`
手动创建工单。

**Request Body**:
```typescript
{
  title: string
  description?: string
  relatedAlertId?: string
  siteId: string
  assigneeId: string
  priority: 'Low' | 'Medium' | 'High'
  dueDate: string
}
```

#### `PATCH /tasks/:taskId`
更新工单状态 / 指派人。

**Request Body**:
```typescript
{
  status?: 'To Do' | 'In Progress' | 'Resolved'
  assigneeId?: string
  priority?: 'Low' | 'Medium' | 'High'
  resolution?: string        // 解决说明，status 为 Resolved 时必填
}
```

#### `GET /tasks/summary`
工单看板汇总统计（无需分页）。

**Response `data`**:
```typescript
interface TaskSummary {
  total: number
  byStatus: { status: string; count: number }[]
  overdueCount: number
  avgResolutionDays: number   // 已关闭工单的平均关闭周期
}
```

---

### M2. 受试者画像 (Subject Profiles)

#### `GET /subjects`

| Query 参数 | 类型 | 必填 | 说明 |
|------------|------|------|------|
| `siteId` | string | 否 | 按中心筛选 |
| `minRiskScore` | number | 否 | 风险分下限 |
| `maxRiskScore` | number | 否 | 风险分上限 |
| `sortBy` | string | 否 | 默认 `riskScore` |
| `page` / `pageSize` | number | 否 | 分页 |

**Response `data`**:
```typescript
interface Subject {
  subjectId: string            // "SUBJ-1001"
  siteId: string
  siteName: string
  enrollmentDate: string
  riskScore: number            // 0–100
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical'
  aeCount: number
  pdCount: number
  missedVisitCount: number
  isOutlier: boolean           // z-score > 2
}
// data: PaginatedResponse<Subject>
```

#### `GET /subjects/:subjectId`
单个受试者详情，包含完整事件时间轴。

**Response `data`**:
```typescript
interface SubjectDetail extends Subject {
  events: SubjectEvent[]
  riskBreakdown: {             // 雷达图数据
    dimension: string          // "AE" | "PD" | "MissedVisit" | "DataDelay" | "QueryOpen"
    score: number              // 0–100
    zScore: number
  }[]
}
interface SubjectEvent {
  eventId: string
  type: 'AE' | 'PD' | 'MissedVisit' | 'Visit' | 'Enrollment'
  date: string
  severity?: string            // "Grade 1" – "Grade 5"（AE 专用）
  description: string
}
```

#### `GET /subjects/risk-distribution`
风险分布统计（用于直方图）。

**Response `data`**:
```typescript
interface RiskDistribution {
  buckets: { range: string; count: number }[]   // "0-20", "21-40", ...
  avgScore: number
  medianScore: number
  outlierCount: number
}
```

---

### M3. 数据质量 (Data Quality)

#### `GET /data-quality`

| Query 参数 | 类型 | 必填 | 说明 |
|------------|------|------|------|
| `siteId` | string | 否 | 按中心筛选 |
| `month` | string | 否 | 格式 `YYYY-MM` |
| `startDate` / `endDate` | string | 否 | 时间范围 |

**Response `data`**:
```typescript
interface DataQualityMetrics {
  siteId: string
  siteName: string
  metricsMonth: string          // "2026-04"
  avgEntryDelayDays: number     // 平均录入滞后天数
  totalQueriesIssued: number
  openQueries: number
  resolvedQueries: number
  queryResolutionRate: number   // 后端计算: resolved / total * 100
  avgQueryResolutionDays: number
  missingPagesCount: number
  isDelayAlert: boolean         // 后端计算: avgEntryDelayDays > 5
}
// data: DataQualityMetrics[]
```

#### `GET /data-quality/trends`
各中心数据质量随时间的趋势。

| Query 参数 | 类型 | 必填 | 说明 |
|------------|------|------|------|
| `siteId` | string | 是 | 中心 ID |
| `months` | number | 否 | 回溯月数，默认 6 |

**Response `data`**:
```typescript
interface DataQualityTrend {
  siteId: string
  timeline: string[]                // ["2025-11", "2025-12", ...]
  avgEntryDelayDays: number[]
  openQueries: number[]
  queryResolutionRate: number[]
}
```

---

### M4. 风险预测 (Risk Forecasting)

#### `GET /forecast/:siteId`

| Query 参数 | 类型 | 必填 | 说明 |
|------------|------|------|------|
| `metric` | string | 否 | `pd` \| `ae`，默认 `pd` |
| `horizonMonths` | number | 否 | 预测步长，默认 3 |

**Response `data`**:
```typescript
interface ForecastResult {
  siteId: string
  metricName: string
  historical: {
    timeline: string[]        // ["2025-11", ...]
    values: number[]
  }
  forecast: {
    timeline: string[]        // ["2026-05", "2026-06", "2026-07"]
    predicted: number[]
    upperBound: number[]      // 95% 置信区间上限
    lowerBound: number[]      // 95% 置信区间下限
  }
  model: {
    method: 'LinearRegression' | 'ARIMA'
    slope: number
    intercept: number
    r_squared: number
  }
  thresholdBreachProbability: number  // 0–1，预测值超过阈值的概率
}
```

#### `GET /forecast/overview`
所有中心的预测风险排名（无需分页，返回 Top N）。

| Query 参数 | 类型 | 必填 | 说明 |
|------------|------|------|------|
| `metric` | string | 否 | 默认 `pd` |
| `topN` | number | 否 | 默认 10 |

**Response `data`**:
```typescript
interface ForecastOverviewItem {
  siteId: string
  siteName: string
  currentValue: number
  predictedNextMonth: number
  trend: 'rising' | 'stable' | 'declining'
  breachProbability: number
}
// data: ForecastOverviewItem[]
```

---

### M5. 审计追踪 (Audit Trail)

#### `GET /audit-logs`

| Query 参数 | 类型 | 必填 | 说明 |
|------------|------|------|------|
| `startDate` / `endDate` | string | 否 | 时间范围 |
| `userId` | string | 否 | 操作人 |
| `actionType` | string | 否 | 操作类型筛选 |
| `page` / `pageSize` | number | 否 | 分页 |

**Response `data`**:
```typescript
type AuditActionType =
  | 'UPDATE_THRESHOLD'
  | 'CLOSE_ALERT'
  | 'CREATE_TASK'
  | 'UPDATE_TASK'
  | 'GENERATE_REPORT'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'EXPORT_DATA'

interface AuditLog {
  logId: string
  timestamp: string
  userId: string
  userName: string
  actionType: AuditActionType
  description: string
  details: {
    targetEntity?: string     // 操作的目标对象（如 alertId, taskId）
    previousValue?: unknown
    newValue?: unknown
    reasonProvided?: string
  }
  ipAddress: string
}
// data: PaginatedResponse<AuditLog>
```

#### `GET /audit-logs/export`
导出审计日志为 CSV（只读，不可篡改）。

| Query 参数 | 类型 | 必填 | 说明 |
|------------|------|------|------|
| `startDate` / `endDate` | string | 是 | 导出范围 |
| `format` | string | 否 | `csv`（默认） |

**Response**: `Content-Type: text/csv`，直接返回文件流。

---

### M6. 报告中心 (Reports)

**注意**：本模块无独立的业务数据表，所有报告内容均由后端从 E1–E5 + M1–M5 的接口数据实时聚合生成。

#### `POST /reports/generate`
触发生成一份新报告。

**Request Body**:
```typescript
{
  reportType: 'weekly' | 'monthly'
  title?: string                    // 自定义报告标题
  dateRange: {
    startDate: string
    endDate: string
  }
  includeSections: string[]         // ["executive_summary", "alerts", "tasks", "data_quality", "forecast"]
}
```

**Response `data`**:
```typescript
interface ReportMeta {
  reportId: string
  status: 'generating' | 'completed' | 'failed'
  createdAt: string
  createdBy: string
}
```

#### `GET /reports`
获取历史报告列表。

**Response `data`**:
```typescript
interface ReportListItem {
  reportId: string
  title: string
  reportType: 'weekly' | 'monthly'
  status: 'generating' | 'completed' | 'failed'
  createdAt: string
  createdBy: string
  dateRange: { startDate: string; endDate: string }
  fileSizeKb: number | null
}
// data: PaginatedResponse<ReportListItem>
```

#### `GET /reports/:reportId`
获取单份报告的聚合快照数据（用于前端预览）。

**Response `data`**:
```typescript
interface ReportSnapshot {
  reportId: string
  generatedAt: string
  dateRange: { startDate: string; endDate: string }
  executiveSummary: {
    totalSites: number
    totalSubjects: number
    criticalAlerts: number
    openAlerts: number
    unresolvedTasks: number
    overdueTaskCount: number
    avgDataEntryDelay: number
  }
  topRiskSites: { siteId: string; siteName: string; riskScore: number }[]
  alertTrend: { date: string; openCount: number; closedCount: number }[]
  dataQualitySummary: { siteId: string; queryResolutionRate: number; avgDelayDays: number }[]
}
```

#### `GET /reports/:reportId/download`
下载 PDF 文件。

**Response**: `Content-Type: application/pdf`，返回文件流。

---

## 三、数据抽象层设计 (Data Abstraction Layer)

为实现"模拟数据 → 真实数据"的无缝切换，前端和后端各需一层抽象。

### 3.1 前端抽象：`DataProvider` 模式

```
src/
├── api/
│   ├── client.ts              # HTTP 客户端（已有）
│   ├── types.ts               # 所有 TypeScript interface 定义（从本文档提取）
│   ├── hooks/
│   │   ├── useTasks.ts        # M1 React Query hooks
│   │   ├── useSubjects.ts     # M2
│   │   ├── useDataQuality.ts  # M3
│   │   ├── useForecast.ts     # M4（已有，需扩展）
│   │   ├── useAuditLogs.ts    # M5
│   │   └── useReports.ts      # M6
│   └── mock/
│       ├── mockTasks.ts       # M1 模拟数据
│       ├── mockSubjects.ts    # M2 模拟数据
│       ├── mockDataQuality.ts # M3 模拟数据
│       └── mockAuditLogs.ts   # M5 模拟数据
```

**切换机制**：通过环境变量 `VITE_USE_MOCK=true|false` 控制。

```typescript
// src/api/client.ts (扩展后)
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export async function apiGet<T>(path: string): Promise<T> {
  if (USE_MOCK) {
    const { getMockData } = await import('./mock/router')
    return getMockData<T>(path)
  }
  const res = await fetch(`${baseUrl()}${path}`)
  if (!res.ok) throw new ApiError(res.status, await res.text())
  return (await res.json() as ApiResponse<T>).data
}
```

### 3.2 后端抽象：Repository 模式 (NestJS + Prisma)

```
backend/src/
├── modules/
│   ├── tasks/
│   │   ├── tasks.controller.ts    # 路由定义，对应 /api/v1/tasks
│   │   ├── tasks.service.ts       # 业务逻辑 & 算法
│   │   └── tasks.repository.ts    # Prisma 数据访问
│   ├── subjects/                  # 同上结构
│   ├── data-quality/
│   ├── forecast/
│   ├── audit-logs/
│   └── reports/
├── prisma/
│   └── schema.prisma              # 统一数据库 Schema
```

### 3.3 核心 MySQL 数据表映射

| 模块 | 主表 | 关联表 |
|------|------|--------|
| E1 Sites | `sites` | - |
| E3 Alerts | `alerts` | → `sites` |
| E4 Benchmark | 从 `sites` + `site_metrics` 聚合计算 | - |
| M1 Tasks | `tasks` | → `alerts`, → `users` |
| M2 Subjects | `subjects`, `subject_events` | → `sites` |
| M3 Data Quality | `data_quality_metrics` | → `sites` |
| M4 Forecast | 从 `site_metrics` 实时计算 | - |
| M5 Audit Logs | `audit_logs` | → `users` |
| M6 Reports | `reports` | 聚合查询，无独立业务表 |
