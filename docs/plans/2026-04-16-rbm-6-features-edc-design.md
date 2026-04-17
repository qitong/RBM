# RBM 6 Features + EDC 集成设计

**日期**: 2026-04-16
**目标受众**: 内部 + Demo（偏 Demo 影响力）
**范围**: 6 个主要功能 + EDC 数据接口（Demo 级别）

---

## 一、设计目标

在现有 3 个 Tab（全局风险大屏 / 预警跟踪 / 阈值配置）基础上，新增 6 个面向不同角色的分析视图，同时引入 EDC 数据接口作为后端雏形，用于 Demo 时展示「接真实数据」的能力。

---

## 二、架构决策

### 1. 整体架构（B + β）

- **前端**：保留 React 19 + Vite 8 + Tailwind v4，新增 `react-router-dom` 做 URL 路由；`@tanstack/react-query` 管数据态
- **后端**：新增 FastAPI 服务，`backend/src/` 下分 `api/`（路由）、`analytics/`（统计）、`edc/`（数据生成）三层；Pydantic 做 schema
- **数据源切换**：前端 `DataSourceContext` + `VITE_DATA_SOURCE=mock|api` 环境变量，默认 mock；Demo 切 api

### 2. 依赖增项

| 层 | 包 | 用途 |
|---|---|---|
| 前端 | `react-router-dom` | URL 路由 |
| 前端 | `@tanstack/react-query` | loading/error/cache |
| 后端 | `fastapi`, `uvicorn`, `pydantic` | Web 层 |
| 后端 | `scipy`, `statsmodels` | 相关性 + 预测 |
| 后端 | `numpy`, `pandas` | 数值处理 |

### 3. 数据流

```
[mock data.json]  ─┐
                   ├─→ DataSourceContext ─→ React Query hooks ─→ Feature pages
[FastAPI /api/*] ──┘                          (cache + retry + loading)
       ↑
[edc_generator.py] → in-memory dict (demo)
```

---

## 三、6 个 Feature 详细设计

### 组 1：多维下钻

#### Feature 1：单中心深度分析（Site Deep Dive）
- **入口**：全局大屏的站点列表行点击，路由 `/sites/:siteId`
- **组件**：
  - 顶部 KPI 卡：入组进度 / AE 发生率 / PD 总数 / Query 未关闭数
  - 4 面板趋势图：PD 月度趋势 / AE 累计 / 入组曲线 / Query 响应时长
  - 受试者 × 访视 热力图（cell 显示 PD/AE 标记）
- **API**：`GET /api/sites/:id`、`GET /api/sites/:id/metrics?from=...&to=...`

#### Feature 2：中心间横向对比（Cross-Site Benchmarking）
- **入口**：独立页面 `/benchmark`
- **组件**：
  - 散点图：x = 入组进度, y = PD z-score，气泡大小 = 受试者数
  - 雷达图：选 2-3 个站点跨 5 维指标对比
  - 排名表：各维度 Top/Bottom 3
- **API**：`GET /api/benchmark?metrics=pd,ae,query`

#### Feature 3：研究者画像（Investigator Profile）
- **入口**：`/investigators` + `/investigators/:id`
- **组件**：
  - 卡片网格（每个 PI 一张，显示负责项目数、累计 PD、Query 响应时长）
  - 跨项目 PD 堆积柱状图（按 8 大类分色）
  - vs 全国基线 z-score 对比
- **API**：`GET /api/investigators`、`GET /api/investigators/:id`

### 组 2：统计分析

#### Feature 4：PD × Query 相关性分析
- **入口**：`/analytics/correlation`
- **组件**：
  - 散点图 + 线性回归线 + 95% CI 带
  - 指标卡：Pearson r / Spearman ρ / p-value / R²
  - GroupBy 切换：按站点 / 按研究者 / 按 PD 类别
- **API**：`GET /api/analytics/correlation?x=pd&y=query&groupBy=site`
- **后端**：scipy.stats.pearsonr / spearmanr

#### Feature 5：风险预测（Risk Forecasting）
- **入口**：`/analytics/forecast`
- **组件**：
  - 时间序列图：实线历史 + 虚线预测 + 置信带
  - 模型切换：线性外推 / 指数平滑 / ARIMA
  - 三情景：乐观 / 基准 / 悲观
- **API**：`GET /api/analytics/forecast?metric=pd&siteId=...&model=ets`
- **后端**：statsmodels.tsa（SimpleExpSmoothing / ARIMA）

### 组 3：运营

#### Feature 6：CAPA 效能仪表盘
- **入口**：`/capa`
- **组件**：
  - KPI 条：平均关闭天数 / 逾期率 / 本月关闭数
  - 漏斗图：Open → In Progress → Verified → Closed
  - 老化分布（0-7d / 8-14d / 15-30d / 30+d）
  - 站点排名 + 类别效率热力图
- **API**：`GET /api/capa/summary`、`GET /api/capa/aging`

---

## 四、跨功能设计

- **路由重构**：引入 `react-router-dom`，旧 3 个 Tab 迁到 `/dashboard`, `/alerts`, `/thresholds`
- **空状态**：所有 Feature 页面准备「无数据」fallback，不让 demo 翻车
- **Loading/Error**：统一走 React Query 的 isLoading/isError 分支，主题色与现有 Tailwind token 一致

---

## 五、测试策略

### 前端（Vitest + RTL）
- **纯函数**：`statisticsUtils`、`forecastUtils`、`benchmarkUtils` — 100% 覆盖，每个公式 ≥3 个边界用例
- **Context**：`DataSourceContext`、`ThresholdContext`
- **组件**：每个 Feature 主页 1 个 smoke test + 1 个关键交互 test
- **API client**：用 `msw` mock，测三态

### 后端（pytest）
- **统计层**：numpy 生成已知分布，断言计算结果在容差内
- **EDC 生成器**：schema 完整 + 数值范围合理 + seed 可复现
- **API 层**：FastAPI TestClient 测 200/422/404

### 契约测试
- 用 `openapi-typescript` 从 FastAPI 的 OpenAPI schema 自动生成前端 TS 类型，避免前后端漂移

### 不做的
- **E2E (Playwright)** — 本期不做

---

## 六、交付节奏

### 本期聚焦：M1 + M2

#### M1：打通管线
- 后端骨架：FastAPI + EDC mock generator + 1 个联通 endpoint（如 `/api/sites`）
- 前端：接入 `@tanstack/react-query` + `DataSourceContext` + `VITE_DATA_SOURCE` 开关
- 验收：前端能通过 mock 和 api 两种模式渲染现有大屏

#### M2：多维下钻（前两个 Feature）
- Feature 1：Site Deep Dive（`/sites/:siteId`）
- Feature 2：Cross-Site Benchmarking（`/benchmark`）
- 引入 `react-router-dom`，重构既有 Tab 为路由
- 验收：两个 Feature 从 API 获取数据 + 所有单元测试绿

### 后续（暂不启动）
- M3：Investigator Profile + 路由重构收尾
- M4：PD × Query 相关性（引入 scipy）
- M5：风险预测（引入 statsmodels）
- M6：CAPA 效能

---

## 七、风险 & 缓解

| 风险 | 缓解 |
|---|---|
| Mock 数据与真实 EDC schema 偏差 | EDC generator 文档化字段映射，README 标注 |
| 路由重构破坏现有 3 个 Tab | 先建 router，旧 Tab 兼容 wrapper，最后再拆 |
| React Query 初次引入心智成本 | M1 用最小集（1 个 hook），逐步铺开 |
| PR 体积失控 | 严格按 milestone 拆，每个 PR ≤ 1 个 Feature |
