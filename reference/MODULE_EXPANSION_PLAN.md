# RBM 临床风险监控系统 - 未来模块扩展计划 (Module Expansion Plan)

本文档基于现有 RBM 系统的功能（全局大盘、预警追踪、阈值配置、中心对比），规划了未来完善系统的 6 个核心扩展模块，旨在将系统提升至符合行业标准（如 ICH GCP E6 R2/R3）的成熟临床试验监控平台。

---

## 1. 任务与工单管理 (Action Item & Task Management)

**业务价值**：实现风险的闭环管理。发现风险（Alert）是第一步，指派给对应的 CRA 并在 SLA 内解决才是最终目的。

- **Tab 名称**：工单中心 (Task Center)
- **UI 展示形式**：看板视图 (Kanban Board, 分为 To Do, In Progress, Resolved) 或具有高级过滤功能的数据表格。
- **核心算法/逻辑**：
  - **自动派发规则**：当系统生成严重 (Critical) 或高危 (High) 级别的风险预警时，系统自动 `createTask()`，并将 assignee 绑定为负责该中心的 CRA。
  - **SLA 超时计算**：`isOverdue = (currentTime - createdAt) > SLA_Threshold`。超时未处理的工单自动标红，并可触发二次邮件提醒（Escalation）。
- **所需的模拟数据 (Mock Data Schema)**：
  ```json
  {
    "taskId": "TASK-2026-001",
    "relatedAlertId": "ALT-901",
    "siteId": "S-001",
    "assignee": "张三 (CRA)",
    "status": "To Do", // 'To Do' | 'In Progress' | 'Resolved'
    "priority": "High", // 'Low' | 'Medium' | 'High'
    "createdAt": "2026-04-20T08:00:00Z",
    "dueDate": "2026-04-25T08:00:00Z"
  }
  ```

---

## 2. 受试者层面风险视图 (Subject-Level Risk Profile)

**业务价值**：实现从“中心(Site)”层面到“个体(Subject)”层面的下钻追踪，精确定位产生数据异常的根源受试者。

- **Tab 名称**：受试者画像 (Subject Profiles)
- **UI 展示形式**：左侧为受试者列表（按风险分排序），右侧为受试者的时间轴（Timeline）和雷达图，直观展示访视进度和异常事件分布。
- **核心算法/逻辑**：
  - **风险聚合加权评分**：`SubjectRiskScore = (w1 * AE数量) + (w2 * 方案违背数量) + (w3 * 漏访次数)`，其中 w1, w2, w3 为设定的严重度权重。
  - **离群值检测 (Outlier Detection)**：计算受试者的各项指标与同组人群平均值的标准差 (z-score)，z-score > 2 标记为异常高风险。
- **所需的模拟数据 (Mock Data Schema)**：
  ```json
  {
    "subjectId": "SUBJ-1001",
    "siteId": "S-001",
    "enrollmentDate": "2026-01-15T00:00:00Z",
    "riskScore": 85, // 0-100 评分
    "events": [
      {
        "type": "AE", // 'AE' | 'PD' | 'MissedVisit'
        "date": "2026-03-12T00:00:00Z",
        "severity": "Grade 3",
        "description": "血小板减少"
      }
    ]
  }
  ```

---

## 3. 数据质量与质疑管理 (Data Quality & Query Management)

**业务价值**：EDC（电子数据采集）数据的及时性和准确性是衡量中心管理质量的核心标准，直接影响临床试验的最终分析。

- **Tab 名称**：数据质量 (Data Quality)
- **UI 展示形式**：柱状图（各中心 Query 数量及解决情况）与折线图（录入滞后天数趋势）。
- **核心算法/逻辑**：
  - **数据录入滞后率 (EDC Entry Delay)**：`AvgDelay = sum(DataEntryDate - VisitDate) / totalVisits`，当平均滞后 > 5 天时触发预警。
  - **质疑解决效率 (Query Resolution Time)**：`AvgResolution = sum(QueryResolvedDate - QueryIssuedDate) / totalResolvedQueries`。
  - **质疑解决率**：`Resolved_Queries / Total_Issued_Queries * 100%`。
- **所需的模拟数据 (Mock Data Schema)**：
  ```json
  {
    "siteId": "S-001",
    "metricsMonth": "2026-04",
    "avgEntryDelayDays": 4.2,
    "totalQueriesIssued": 120,
    "openQueries": 15,
    "resolvedQueries": 105,
    "avgQueryResolutionDays": 3.5,
    "missingPagesCount": 2
  }
  ```

---

## 4. 预测性分析与早期预警 (Predictive Analytics & Forecasting)

**业务价值**：帮助项目经理从“看后视镜”（处理已发生的偏差）转向“看挡风玻璃”（干预即将发生的风险）。

- **Tab 名称**：风险预测 (Risk Forecasting)
- **UI 展示形式**：带有置信区间（Confidence Interval，阴影区域）的时间序列折线图。
- **核心算法/逻辑**：
  - **时间序列预测 (Linear Regression / ARIMA)**：利用中心过去 6 个月的指标（如 PD 发生率）作为历史序列，通过简单线性回归计算下月预测值：`y = mx + c`。
  - **超阈值概率**：计算预测值落在阈值危险区间的概率。
- **所需的模拟数据 (Mock Data Schema)**：
  ```json
  {
    "siteId": "S-001",
    "metricName": "Protocol Deviation Rate",
    "historicalData": [
      { "month": "2025-11", "value": 1.2 },
      { "month": "2025-12", "value": 1.5 }
      // ... up to current month
    ],
    "forecast": {
      "nextMonth": "2026-05",
      "predictedValue": 2.1,
      "confidenceInterval": [1.8, 2.4] // 95% 置信区间
    }
  }
  ```

---

## 5. 审计日志与合规监控 (Audit Logs & Compliance)

**业务价值**：满足 FDA CFR 21 Part 11 等关于电子记录的严格监管要求，确保系统内所有的关键操作可追溯。

- **Tab 名称**：审计追踪 (Audit Trail)
- **UI 展示形式**：紧凑的高密度数据表格，不可修改，支持强大的多维度筛选（按时间、用户、操作类型）和防伪导出。
- **核心算法/逻辑**：
  - **不可变追加日志 (Immutable Append-Only Log)**：系统状态机拦截所有敏感操作（如修改阈值 `updateThreshold`、关停预警 `closeAlert`），强制生成并持久化日志记录，包含旧值和新值的 diff。
- **所需的模拟数据 (Mock Data Schema)**：
  ```json
  {
    "logId": "LOG-882391",
    "timestamp": "2026-04-27T10:15:00Z",
    "userId": "PM_001",
    "userName": "李四",
    "actionType": "UPDATE_THRESHOLD",
    "description": "修改 '协议偏差率' 的高风险阈值",
    "details": {
      "metric": "PD_Rate",
      "previousValue": 5.0,
      "newValue": 4.5,
      "reasonProvided": "根据申办方最新稽查要求收紧控制标准"
    }
  }
  ```

---

## 6. 自动化报告生成 (Report Generation)

**业务价值**：大幅减少临床团队每月准备向申办方 (Sponsor) 汇报的时间，实现数据到文档的自动化转换。

- **Tab 名称**：报告中心 (Reports)
- **UI 展示形式**：卡片列表，展示历史生成的报告封面，提供一键下载和“立即生成新报告”按钮。
- **核心算法/逻辑**：
  - **定时任务生成 (Cron Job Scheduler)**：模拟后端按月（或周）触发聚合计算脚本，提取 Dashboard 核心快照数据。
  - **前端导出**：利用 `html2canvas` 截取图表节点，结合 `jspdf` 渲染为包含目录、执行摘要 (Executive Summary) 和具体中心数据的多页 PDF。
- **数据来源与聚合逻辑 (Data Sourcing & Aggregation)**：
  - **无需独立模拟数据**：本模块的数据不是凭空捏造的，而是直接从当前系统（大盘、工单、受试者画像、数据质量等）聚合得来。
  - **核心指标聚合 (Executive Summary)**：
    - `totalCriticalAlerts` = 过滤 AlertTracking 中的 Critical 状态数量
    - `unresolvedTasks` = 从工单中心过滤状态不为 Resolved 的任务数
    - `highestRiskSites` = 从 Benchmark 和 Subject Profile 中提炼出的本周期风险得分上升最快的中心
  - **图表数据快照 (Chart Snapshots)**：生成报告时，前端读取 Redux / Context 中的 state，直接向报告模板中填入动态计算的数据和图表。
