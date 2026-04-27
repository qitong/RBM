# RBM 研发团队全栈编码与架构规范 (Engineering Standards)

**【机密/团队内部使用】**
本文档为 RBM (Risk-Based Monitoring) 系统的强制性研发规范。所有参与本项目的研发人员（前端、后端、全栈）必须严格遵守以下技术栈要求与编码规范，任何技术选型的变更必须经过架构委员会（Architecture Board）审批。

---

## 1. 强制性基础技术栈 (Mandatory Tech Stack)

项目中不得引入与下述选型重叠或冲突的第三方库。所有项目模块必须锁定主版本号。

### 1.1 前端核心层 (Frontend)
- **框架**：**React `^19.2.4`**。禁止使用 Class Component，强制使用 Functional Component + Hooks。
- **构建工具**：**Vite `^8.0.1`**。禁止引入 Webpack 相关的 loader 或插件。
- **类型系统**：**TypeScript `~5.9.3`**。强制开启 `strict` 模式，**严禁使用 `any` 类型**。无法推导类型时必须使用 `unknown` 并进行类型收窄。
- **路由**：**React Router `^7.14.1`**。
- **状态与数据获取**：**React Query (TanStack Query) `^5.99.0`**。所有的异步请求、缓存机制强制通过 React Query 管理。禁止使用 Redux 或 MobX 管理服务器状态。

### 1.2 后端与持久层 (Backend & Database)
- **运行环境**：**Node.js `>=20.x LTS`**。
- **后端框架**：**NestJS `^10.0.0`**。必须遵循 NestJS 官方的模块化 (Module/Controller/Service) 最佳实践，强制使用依赖注入 (DI)。
- **关系型数据库**：**MySQL `>= 8.0`**。
  - 禁止在业务逻辑中直接拼接 SQL。
  - 核心业务表必须建立联合索引以优化大宽表查询。
- **ORM 引擎**：**Prisma `^5.0.0`**。
  - 所有库表结构定义必须通过 `schema.prisma` 管理并执行迁移（Migration）。
  - 复杂聚合查询在 Prisma 性能瓶颈时，才允许使用 Prisma 的 Raw Query 提权执行，且必须附带性能测试报告。
- **鉴权中心**：**JWT + Redis (`>=7.0`)**。
  - 强制使用 HttpOnly Cookie 传递 JWT Token，防止 XSS 攻击拦截 Token。
  - 注销和风控必须将对应的 Token 签发 ID 加入 Redis 黑名单。

---

## 2. 编码与目录规范 (Coding Conventions)

### 2.1 命名规范
- **文件/目录命名**：
  - 前端组件文件：强制 `PascalCase`（如 `AlertTracking.tsx`）。
  - 工具类/Hook/纯函数：强制 `camelCase`（如 `useThresholds.ts`, `formatDate.ts`）。
- **变量/函数命名**：
  - 纯函数/普通变量：`camelCase`。
  - 常量定义：`UPPER_SNAKE_CASE`（如 `MAX_RETRY_COUNT`），且需统一提取到 `constants.ts` 中。

### 2.2 前后端 API 交互规范
- 所有 API 响应必须包裹在统一的标准数据结构中：
  ```typescript
  interface ApiResponse<T> {
    code: number; // 200 为成功，其他均为业务错误
    message: string; // 错误信息，可以直接展示给用户
    data: T; // 具体的业务数据
  }
  ```
- 接口定义必须在前后端共享目录中通过 TypeScript `interface` 或 `type` 定义，禁止出现前后端数据格式不对齐的情况。

---

## 3. UI 格式与样式规范 (UI & Styling Standards)

### 3.1 样式开发规范
- **CSS 引擎**：强制使用 **Tailwind CSS `^4.2.2`** 进行样式开发。
- **禁止自行写原生 CSS**：除非是极为复杂的动态动画，否则禁止在 `.css` 文件中手写原生类名，必须使用 Tailwind 的原子类（Utility Classes）。
- **样式冲突处理**：处理动态 class 组合时，强制使用 `clsx` 结合 `tailwind-merge` 包裹（项目中通常封装为 `cn()` 函数）。禁止直接使用字符串拼接 class。

### 3.2 设计系统规范 (Design Tokens)
UI 开发必须 100% 还原设计语言，严禁使用非规范的自定义色值或字体大小：
- **排版字体**：
  - 标题及关键数据标签必须使用 `font-display` (PingFang SC Medium)。
  - 正文必须使用 `font-body` (PingFang SC Regular)。
- **色彩规范**：
  - 不允许在代码中写死十六进制色值（如 `text-[#FF5555]`），必须使用 Tailwind 配置好的语义化变量：
    - 严重风险/错误：`bg-error` / `text-error`
    - 警告/中危：`bg-warning` / `text-warning`
    - 主背景/卡片：`bg-surface` / `bg-surface-variant`
- **组件形态**：
  - 所有数据模块、图表必须被包裹在标准卡片中（带有标准背景色和 `rounded-2xl` 圆角）。
  - 所有可点击交互元素（Button, 列表项）必须具备 Hover 反馈。

---

## 4. 自动化测试与质量保障
- 核心业务组件（如 Threshold 阈值计算器、Alert 状态派发模块）必须包含对应的 **Vitest** 单元测试用例。
- 代码合入主分支前，必须通过 `npm run lint` 和 CI 环境的构建检查，任何 Warning 或 Error 都将阻断合并操作（Merge Request）。
