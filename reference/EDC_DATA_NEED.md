# RBM 系统数据源分析：EDC 可获取性报告

本文档基于 `API_SPEC.md` 中定义的全部接口字段，逐一分析每个数据项的来源系统。目标是明确未来系统对接时，哪些数据可以直接从 EDC 拉取，哪些需要 CTMS、RBM 自身或其他系统补充。

---

## 数据源定义

| 缩写 | 全称 | 典型产品示例 | 说明 |
|------|------|-------------|------|
| **EDC** | Electronic Data Capture | Medidata Rave, Oracle InForm, Veeva Vault CDMS | CRF 表单数据、受试者临床数据、Query |
| **CTMS** | Clinical Trial Management System | Medidata Rave CTMS, Oracle Siebel CTMS, Veeva Vault CTMS | 中心管理、人员、入组目标、访视计划、监查计划 |
| **IRT/RTSM** | Randomization & Trial Supply Management | Medidata Balance, Almac IXRS | 随机化编号、用药分配 |
| **Safety** | Safety / Pharmacovigilance | Argus, ArisGlobal | SAE 上报、因果关系判定 |
| **RBM-Self** | RBM 系统自身生成 | 本系统 | 预警、工单、审计日志、报告等系统内闭环数据 |

---

## 一、E1 中心管理 (Sites)

### `GET /sites` — Site 接口

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| `id` | CTMS | ❌ | 中心唯一标识，通常由 CTMS 统一分配和管理 |
| `name` | CTMS | ❌ | 中心名称，属于中心管理范畴 |
| `region` | CTMS | ❌ | 地区信息，属于中心基础管理数据 |
| `enrolled` | **EDC** ✅ | ✅ | 可从 EDC 受试者状态 CRF 中统计"已入组"人数 |
| `target` | CTMS | ❌ | 入组目标数，在 CTMS 中由项目经理设定 |
| `pi` | CTMS | ❌ | 主要研究者姓名，属于中心人员管理 |

> **结论**：中心基础信息主要来自 CTMS。仅 `enrolled` 可从 EDC 中统计得到。

### `GET /sites/:siteId/metrics` — SiteMetrics 接口

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| `timeline` | 派生 | — | 时间轴标签，系统生成 |
| `pd[]` | **EDC** ✅ | ✅ | 协议偏差 (Protocol Deviation) 通常在 EDC 的 PD Log CRF 中记录 |
| `ae[]` | **EDC** ✅ | ✅ | 不良事件 (Adverse Event) 在 EDC 的 AE CRF 表单中录入 |
| `enrollment[]` | **EDC** ✅ | ✅ | 按月统计的入组人数趋势，可从 EDC 中的 IC (知情同意) 日期推算 |
| `query[]` | **EDC** ✅ | ✅ | Query 是 EDC 系统的核心功能，数据完全来自 EDC |

> **结论**：时间序列指标 **全部可从 EDC 获取**。

---

## 二、E2 全局风险大盘 (Dashboard)

### `GET /dashboard/progress-matrix` — ProgressMatrixItem

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| `category` | **EDC** ✅ | ✅ | PD 的分类 (INFORMED CONSENT, INCLUSION EXCLUSION 等) 在 EDC PD Log 中有对应字段 |
| `progress` | **EDC** + CTMS | ⚠️ 部分 | 进度百分比 = 已完成 CRF 页面 / 计划页面。已完成数来自 EDC，计划数来自 CTMS 的访视计划 |
| `value` | **EDC** ✅ | ✅ | PD 加权得分，基于 EDC 中的 PD 数据计算 |
| `alertLevel` | RBM-Self | ❌ | 由 RBM 系统根据阈值规则引擎计算 |

### `GET /dashboard/visit-trends` — VisitTrendItem

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| `visit` | **EDC** ✅ | ✅ | 访视编号，EDC 中的访视表单结构 |
| `[category]: number` | **EDC** ✅ | ✅ | 各分类的加权 PD 得分，原始 PD 数据来自 EDC |
| `Weighted_Overall` | RBM-Self | ❌ | 系统按权重配置计算的综合得分 |

### `GET /dashboard/categories` — CategoryConfig

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| `id` / `label` | RBM-Self | ❌ | 分类定义由 RBM 系统管理员配置 |
| `weight` | RBM-Self | ❌ | 权重是 RBM 系统的业务规则 |

> **结论**：原始 PD / AE / Visit 数据来自 EDC；但加权规则、阈值判定、分类权重均为 RBM 系统自有逻辑。

---

## 三、E3 预警追踪 (Alert Tracking)

### `GET /alerts` — Alert 接口

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| `id` | RBM-Self | ❌ | 预警由 RBM 引擎生成 |
| `project` | CTMS | ❌ | 项目编号来自 CTMS |
| `site` | CTMS | ❌ | 中心编号 |
| `dimension` | 派生自 EDC | ⚠️ 部分 | 触发预警的维度分类，原始依据来自 EDC PD 数据 |
| `metricValue` | 派生自 EDC | ⚠️ 部分 | 触发值是从 EDC 指标计算得出，但预警判定逻辑属于 RBM |
| `status` | RBM-Self | ❌ | 预警状态由 RBM 系统内部管理 |

> **结论**：预警记录是 **RBM 系统自生成数据**，但其触发依据 (metricValue, dimension) 的原始数据来自 EDC。

---

## 四、E4 中心对比 (Benchmark)

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| `progressPct` | EDC + CTMS | ⚠️ 部分 | 见 Dashboard 分析 |
| `pdTotal` | **EDC** ✅ | ✅ | PD 总数来自 EDC |
| `pdZScore` | RBM-Self | ❌ | Z 分数由 RBM 统计引擎计算 |
| `queryTotal` | **EDC** ✅ | ✅ | Query 数据来自 EDC |
| `trend.*` | RBM-Self | ❌ | 趋势线、置信带由 RBM 回归算法生成 |
| `pearson` / `spearman` | RBM-Self | ❌ | 相关性系数由 RBM 统计引擎计算 |

> **结论**：原始数据 (pdTotal, queryTotal) 来自 EDC；统计派生值 (z-score, 回归, 相关系数) 为 RBM 计算结果。

---

## 五、E5 CAPA 管理

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| `id` / `siteId` / `category` | CTMS 或 RBM-Self | ❌ | CAPA 工单通常在 CTMS 或独立的质量管理系统 (QMS) 中管理 |
| `openDate` / `closeDate` / `status` | CTMS / QMS | ❌ | CAPA 生命周期管理 |
| `cycleTimeDays` | 派生 | ❌ | RBM 系统根据日期差计算 |
| `closureRate` / `avgCycleTimeDays` | RBM-Self | ❌ | 聚合效率指标由 RBM 计算 |

> **结论**：CAPA 数据 **完全不来自 EDC**。来源为 CTMS 的 CAPA 子模块或独立的质量管理系统 (QMS)。

---

## 六、M1 工单中心 (Task Center)

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| 所有字段 | **RBM-Self** | ❌ | 工单是 RBM 系统内部的闭环管理功能，不涉及 EDC |

> **结论**：100% 为 RBM 系统自生成数据。

---

## 七、M2 受试者画像 (Subject Profiles)

### `GET /subjects` + `GET /subjects/:subjectId`

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| `subjectId` | **EDC** ✅ | ✅ | 受试者筛选号/随机号，EDC 中录入 |
| `siteId` / `siteName` | CTMS | ❌ | 中心信息 |
| `enrollmentDate` | **EDC** ✅ | ✅ | 知情同意签署日期，EDC IC 表单 |
| `riskScore` | RBM-Self | ❌ | 加权风险评分由 RBM 算法计算 |
| `riskLevel` | RBM-Self | ❌ | 基于 riskScore 的分级 |
| `aeCount` | **EDC** ✅ | ✅ | 不良事件数量，从 EDC AE Log 统计 |
| `pdCount` | **EDC** ✅ | ✅ | 协议偏差数量，从 EDC PD Log 统计 |
| `missedVisitCount` | **EDC** + CTMS | ⚠️ 部分 | 需对比 EDC 实际访视记录与 CTMS 计划访视窗口，差异为漏访 |
| `isOutlier` | RBM-Self | ❌ | z-score 计算结果 |

### SubjectEvent 子对象

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| `type: 'AE'` 事件 | **EDC** ✅ | ✅ | AE CRF 表单 |
| `type: 'PD'` 事件 | **EDC** ✅ | ✅ | PD Log |
| `type: 'Visit'` 事件 | **EDC** ✅ | ✅ | 访视表单提交记录 |
| `type: 'Enrollment'` 事件 | **EDC** ✅ | ✅ | 知情同意日期 |
| `type: 'MissedVisit'` 事件 | EDC + CTMS | ⚠️ 部分 | 需 CTMS 提供计划访视窗口 |
| `severity` | **EDC** ✅ | ✅ | AE 严重程度分级 (CTCAE Grade) |
| `description` | **EDC** ✅ | ✅ | 事件描述文本 |

### riskBreakdown 子对象

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| `dimension: 'AE'` score | 派生自 EDC | ⚠️ 部分 | 原始 AE 数据来自 EDC，评分为 RBM 计算 |
| `dimension: 'PD'` score | 派生自 EDC | ⚠️ 部分 | 同上 |
| `dimension: 'MissedVisit'` score | EDC + CTMS | ⚠️ 部分 | 需两个系统交叉比对 |
| `dimension: 'DataDelay'` score | **EDC** ✅ | ✅ | EDC 可提供表单录入时间戳 vs 访视日期 |
| `dimension: 'QueryOpen'` score | **EDC** ✅ | ✅ | Open Query 数量完全来自 EDC |

> **结论**：受试者原始临床数据（AE、PD、访视、Query）大部分来自 EDC。风险评分、z-score、离群值判定由 RBM 计算。漏访检测需 CTMS 访视窗口辅助。

---

## 八、M3 数据质量 (Data Quality)

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| `avgEntryDelayDays` | **EDC** ✅ | ✅ | EDC 系统有完整的审计追踪，可精确获取 DataEntryDate vs VisitDate |
| `totalQueriesIssued` | **EDC** ✅ | ✅ | Query 管理是 EDC 核心功能 |
| `openQueries` | **EDC** ✅ | ✅ | EDC 中 Query 状态字段 |
| `resolvedQueries` | **EDC** ✅ | ✅ | 同上 |
| `queryResolutionRate` | 派生自 EDC | ✅ | 简单除法，100% 基于 EDC 数据 |
| `avgQueryResolutionDays` | **EDC** ✅ | ✅ | EDC 可提供 Query 开启和关闭的时间戳 |
| `missingPagesCount` | **EDC** ✅ | ✅ | EDC 中 CRF 页面完成状态 |
| `isDelayAlert` | RBM-Self | ❌ | 阈值判定逻辑 |

> **结论**：M3 是 **EDC 数据覆盖率最高的模块**，除阈值判定外，所有字段均可直接从 EDC 获取。

---

## 九、M4 风险预测 (Risk Forecasting)

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| `historical.timeline` / `historical.values` | 派生自 EDC | ⚠️ 部分 | 历史 PD/AE 时间序列的原始数据来自 EDC，但需 RBM 预处理 |
| `forecast.*` (predicted, bounds) | RBM-Self | ❌ | 预测模型输出 |
| `model.*` (method, slope, r²) | RBM-Self | ❌ | 回归模型参数 |
| `thresholdBreachProbability` | RBM-Self | ❌ | 概率计算 |
| `trend` ('rising'/'stable'/'declining') | RBM-Self | ❌ | 趋势判定 |

> **结论**：输入数据 (历史 PD/AE 序列) 来自 EDC，但所有预测输出均为 RBM 算法产物。

---

## 十、M5 审计追踪 (Audit Trail)

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| 所有字段 | **RBM-Self** | ❌ | 审计日志记录的是 RBM 系统内部操作，与 EDC 无关 |

> **结论**：100% 为 RBM 系统自生成数据。注：EDC 有自己的审计追踪 (Audit Trail)，但那是 EDC 内部操作的记录，不混入 RBM 审计日志。

---

## 十一、M6 报告中心 (Reports)

| 字段 | 数据源 | 可从 EDC 获取？ | 说明 |
|------|--------|:---:|------|
| `reportId` / `status` / `createdAt` / `createdBy` | RBM-Self | ❌ | 报告元数据 |
| `executiveSummary.totalSites` | CTMS | ❌ | 中心总数 |
| `executiveSummary.totalSubjects` | **EDC** ✅ | ✅ | 受试者总数 |
| `executiveSummary.criticalAlerts` / `openAlerts` | RBM-Self | ❌ | 预警统计 |
| `executiveSummary.unresolvedTasks` / `overdueTaskCount` | RBM-Self | ❌ | 工单统计 |
| `executiveSummary.avgDataEntryDelay` | **EDC** ✅ | ✅ | 录入延迟 |
| `topRiskSites` | RBM-Self (聚合) | ❌ | 风险排名 |
| `alertTrend` | RBM-Self | ❌ | 预警趋势 |
| `dataQualitySummary` | **EDC** ✅ | ✅ | Query 解决率和延迟来自 EDC |

> **结论**：报告为聚合模块，部分指标可追溯到 EDC 源数据，但报告本身由 RBM 系统生成和管理。

---

## 汇总矩阵

| 模块 | EDC 可直接获取 | 部分需 EDC | 完全非 EDC (CTMS/RBM-Self/QMS) |
|------|:---:|:---:|:---:|
| **E1 Sites** | `enrolled` | — | `id`, `name`, `region`, `target`, `pi` |
| **E1 SiteMetrics** | `pd`, `ae`, `enrollment`, `query` | — | — |
| **E2 Dashboard** | PD 原始数据, visit 数据 | `progress` (需 CTMS 计划数) | `alertLevel`, `weight`, 分类配置 |
| **E3 Alerts** | — | `dimension`, `metricValue` (触发依据) | `id`, `status`, `project` |
| **E4 Benchmark** | `pdTotal`, `queryTotal` | `progressPct` | `pdZScore`, 趋势线, 相关系数 |
| **E5 CAPA** | — | — | **全部** (CTMS/QMS) |
| **M1 Tasks** | — | — | **全部** (RBM-Self) |
| **M2 Subjects** | `subjectId`, `enrollmentDate`, `aeCount`, `pdCount`, AE/PD/Visit 事件 | `missedVisitCount` (需 CTMS 窗口) | `riskScore`, `riskLevel`, `isOutlier` |
| **M3 Data Quality** | **几乎全部**: delays, queries, resolution, missing pages | — | `isDelayAlert` (阈值判定) |
| **M4 Forecast** | — | 历史 PD/AE 序列 (输入) | 预测值, 模型参数, 趋势, 概率 |
| **M5 Audit** | — | — | **全部** (RBM-Self) |
| **M6 Reports** | `totalSubjects`, `avgDataEntryDelay`, `dataQualitySummary` | — | 报告元数据, 预警/工单统计, 风险排名 |

---

## 系统对接优先级建议

### 第一优先级：EDC 对接 (覆盖 ~60% 原始数据)
- **对接范围**：PD Log, AE Log, Query 状态, CRF 完成状态, 受试者入组信息, 访视记录, 数据录入时间戳
- **典型 API**：Medidata Rave Web Services (RWS), Oracle InForm API, Veeva Vault CDMS API
- **数据同步方式**：建议使用 Change Data Capture (CDC) 或定时增量拉取 (Incremental Pull)，频率 ≥ 每日一次
- **影响模块**：E1 (metrics), E2, E4 (原始数据), M2 (events), M3 (全模块), M4 (输入数据)

### 第二优先级：CTMS 对接 (覆盖中心管理 + 人员)
- **对接范围**：中心基础信息、入组目标、研究者信息、访视计划窗口、CRA 人员名单
- **影响模块**：E1 (基础信息), M2 (`missedVisitCount` 检测), M1 (assignee 人员列表)

### 第三优先级：QMS / CAPA 系统对接
- **对接范围**：CAPA 工单、纠正措施记录
- **影响模块**：E5

### 无需外部对接 (RBM 系统自治)
- M1 工单中心、M5 审计追踪、M6 报告中心
- 所有统计计算 (z-score, 回归, 相关性, 加权评分, 预测)
