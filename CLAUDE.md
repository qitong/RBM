# CLAUDE.md — RBM2 项目指南

> 本文件为 Claude Code 在此仓库中工作时的主要参考。
> 详细系统设计见 `reference/CLAUDE.md`；模块扩展规划见 `reference/MODULE_EXPANSION_PLAN.md`。

---

## 模块开发标准流程（Manual Mode）

每新增一个功能模块，**严格按以下 9 步顺序执行**，每步完成后再进入下一步。
不要跳步，不要合并步骤，人工介入模式下应逐步确认。

### Step 1 — 阅读模块规格
```
reference/MODULE_EXPANSION_PLAN.md
```
确认：Tab 名称、路由路径、UI 形式、核心逻辑、Mock 数据 Schema。

### Step 2 — 创建 Mock JSON
路径：`frontend/public/api/<module>.json`

- 数据应贴近真实业务场景，不要全部使用顺序 ID（如工单编号应用稀疏日期格式 `TASK-YYYYMMDD-NNN`）
- 至少包含 6–12 条记录，覆盖正常/警告/异常三种状态

### Step 3 — 添加 Hook 类型和函数
文件：`frontend/src/api/hooks.ts`（追加到末尾）

- 先写 `export interface` / `export type`，再写 `export function use<Module>()`
- 类型文件只 export 类型，不 export 值；组件中用 `import type { Foo }` 引入

### Step 4 — 注册静态回退
文件：`frontend/src/api/client.ts`，在 `staticMap` 中添加：
```ts
'/api/<module>': '/api/<module>.json',
```

### Step 5 — 构建组件
路径：`frontend/src/components/<ModuleName>.tsx`

**必须遵守的约束：**
- 每个页面只有一个 `<h1>`（来自 App.tsx header），组件内部标题一律用 `<h2>`
- Lucide 图标**不能**直接写 `style` prop，需包一层 `<span style={...}><Icon /></span>`
- Recharts Tooltip `formatter` 签名为 `(v) => [Number(v).toFixed(...), label]`，不能写 `(v: number)`
- 列表/表格内同一文字会在筛选器、徽章、表格行多处出现，渲染时注意唯一性

### Step 6 — 接入 App.tsx
**四处修改，缺一不可：**
```ts
// 1. lucide-react 图标 import（同行追加）
import { ..., NewIcon } from 'lucide-react'

// 2. 组件 import
import NewModule from './components/NewModule'

// 3. TAB_TITLES（路由 → 中文标题映射）
'/new-route': '新模块名称',

// 4a. NavItem（导航栏，在"系统设置"分组上方）
<NavItem to="/new-route" icon={NewIcon} label="新模块名称" />

// 4b. Route（Routes 块内）
<Route path="/new-route" element={<NewModule />} />
```

### Step 7 — TypeScript 检查
```bash
cd frontend && npx tsc --noEmit
```
必须 **0 错误**才能继续。常见错误处理方式见下方「TypeScript 陷阱」。

### Step 8 — 编写测试
路径：`frontend/src/test/<ModuleName>.test.tsx`

**每个模块最少覆盖以下用例：**
1. Loading 状态（fetch 返回永不 resolve 的 Promise）
2. Error 状态（fetch reject）
3. 正常渲染 — KPI 卡或主要标题文字
4. 正常渲染 — 列表/图表核心内容
5. 交互 — 至少一个用户操作（筛选/排序/点击/切换）
6. 边界情况（空结果、过滤后无数据等）

**测试模板：**
```tsx
function setup() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={c}>
      <MemoryRouter><YourComponent /></MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
```

### Step 9 — 全量回归
```bash
cd frontend && npx vitest run
```
必须所有测试通过（0 failed）才算模块验收完成。

---

## TypeScript 陷阱（已踩过的坑）

| 场景 | 错误写法 | 正确写法 |
|------|----------|----------|
| 引入类型 | `import { Foo }` from hooks | `import type { Foo }` from hooks |
| Lucide 图标样式 | `<Icon style={{ color: '...' }} />` | `<span style={{ color: '...' }}><Icon /></span>` |
| Recharts Tooltip | `formatter={(v: number) => ...}` | `formatter={(v) => [Number(v).toFixed(1), label]}` |
| 未使用变量 | 定义了函数但没有调用 | 删除未用的函数/变量 |
| 组件内 h1 | `<h1>页面标题</h1>` in component | 改为 `<h2>`；h1 只在 App.tsx header |

---

## 测试陷阱（已踩过的坑）

| 场景 | 问题 | 解决方案 |
|------|------|----------|
| 同一文字多处出现（表格行 + 筛选下拉 + 徽章） | `getByText` 报 multiple elements | 改用 `getAllByText(...).length >= 1` |
| 筛选后验证"消失"的行 | `queryByText` 仍匹配下拉 option | 用 `within(container.querySelector('tbody'))` 限定范围 |
| 排序列头点击 | `getAllByText()[0]` 点到了 KPI 卡 | 用 `getByRole('columnheader', { name: /文字/ })` |
| 表格可展开行 | `<LogRow>` 返回 Fragment，不能外包 `<tr>` | tbody 直接渲染 `<LogRow key={...} />`，Fragment 内含多个 `<tr>` |

---

## 技术栈速查

```
React 19 + TypeScript + Vite 8
Tailwind CSS v4 (via @tailwindcss/vite)
Recharts（图表）
lucide-react（图标）
@tanstack/react-query（数据获取）
react-router-dom v6（路由）
Vitest + React Testing Library（测试）
```

### 数据层架构
```
public/api/*.json          ← 静态 Mock（fallback，无后端时使用）
src/api/client.ts          ← apiGet()；后端不可用时自动回退到 staticMap
src/api/hooks.ts           ← 所有 useQuery hooks 和 TypeScript 类型
src/components/*.tsx       ← 页面组件
```

### 导航与路由
- 导航栏在 `App.tsx` 的 `<nav>` 内，`NavItem` 组件
- 路由在 `App.tsx` 的 `<Routes>` 内
- 页面标题映射在 `TAB_TITLES` 对象（路径 → 中文名）

---

## 命令速查

```bash
cd frontend
npx tsc --noEmit          # TypeScript 检查
npx vitest run            # 全量测试
npx vitest run src/test/Foo.test.tsx --reporter=verbose  # 单文件测试
npm run dev               # 开发服务器
npm run build             # 生产构建
```

---

## 当前已完成的模块

| 模块 | 路由 | 组件 | Mock 数据 |
|------|------|------|-----------|
| 全局风险大屏 | `/dashboard` | `GlobalDashboard` | `sites.json` |
| 预警跟踪 | `/alerts` | `AlertTracking` | — |
| 预警阈值配置 | `/thresholds` | `ThresholdConfig` | — |
| 中心间横向对比 | `/benchmark` | `Benchmark` | `benchmark.json` |
| PD×Query 相关性 | `/correlation` | `CorrelationScatter` | `correlation.json` |
| 研究者画像 | `/investigators` | `InvestigatorList/Profile` | `investigators.json` |
| CAPA 效率分析 | `/capa` | `CapaEfficiency` | `capa.json`, `capa/efficiency.json` |
| 工单中心 | `/tasks` | `TaskCenter` | `tasks.json` |
| 受试者画像 | `/subjects` | `SubjectProfiles` | `subjects.json` |
| 数据质量 | `/data-quality` | `DataQuality` | `data-quality.json` |
| 风险预测 | `/risk-forecast` | `RiskForecast` | `risk-forecast.json` |
| 审计追踪 | `/audit` | `AuditTrail` | `audit-logs.json` |
| 报告中心 | `/reports` | `ReportCenter` | `reports.json` |
