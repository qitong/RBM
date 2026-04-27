# Design System — RBM 临床风险监控系统

## Product Context
- **What this is:** 临床试验风险监控仪表板，追踪协议偏差(PD)和预警管理
- **Who it's for:** 主任研究者(PI)和项目经理(PM)
- **Space/industry:** 临床试验管理，与Medidata、Veeva等平台竞争
- **Project type:** 专业数据分析仪表板，中文界面

## Aesthetic Direction
- **Direction:** 专业友好主义
- **Decoration level:** 有意图的简洁
- **Mood:** 既有医疗软件的可信度，又有现代数据工具的亲和力。让PI/PM觉得这是"他们的决策工具"，而不是"IT部门的系统"
- **Reference sites:** 基于Medidata CTMS、现代数据仪表板最佳实践调研

## Typography
- **Display/Hero:** PingFang SC Medium — 苹果为中文优化，权威感强，中英混排优秀
- **Body:** PingFang SC Regular — 优秀的可读性，医疗级文本显示
- **UI/Labels:** PingFang SC Medium
- **Data/Tables:** SF Mono — 等宽字体，数字对齐，数据表格专用
- **Code:** SF Mono
- **Loading:** 系统字体，macOS/iOS原生支持，Windows降级到微软雅黑
- **Scale:** 12px/14px/16px/20px/24px/32px/48px
- **备选方案:** 思源黑体 Noto Sans CJK SC（开源跨平台选项）

## Color
- **Approach:** 专业冷暖平衡 + 明确语义色
- **Primary:** #0066CC — 专业蓝，可信的医疗感但不过于严肃
- **Secondary:** #00A86B — 决策绿，替换过于鲜艳的MD3绿色
- **Neutrals:** 
  - 背景: #F8FAFB (温暖灰白)
  - 表面: #FFFFFF (主卡片)
  - 次级表面: #EEF4F9 (嵌套卡片)
  - 文本: #1F2937 (主文本)
  - 次级文本: #6B7280
  - 边框: #E5E7EB
- **Semantic:** 
  - 成功: #10B981
  - 警告: #F59E0B  
  - 错误: #DC3545
  - 信息: #0066CC
- **Dark mode:** 保留当前Material Design 3深色主题作为可选项

## Spacing
- **Base unit:** 8px
- **Density:** 舒适型 — 适合数据密集环境的长时间使用
- **Scale:** 2xs(4) xs(8) sm(12) md(16) lg(24) xl(32) 2xl(48) 3xl(64)
- **卡片间距:** 24px
- **容器内边距:** 32px
- **表格行高:** 48px (适合中文字符)

## Layout
- **Approach:** 决策优先的层次结构
- **Grid:** 12列网格，最大宽度1440px
- **Max content width:** 1200px (中心对齐)
- **Border radius:** sm:8px, md:12px, lg:16px (比Material默认的4px更友好)
- **卡片阴影:** 0 1px 3px rgba(0,0,0,0.1) (subtle elevation)

## Motion
- **Approach:** 功能导向的微动画
- **Easing:** 
  - 进入: cubic-bezier(0.4, 0, 0.2, 1) 
  - 退出: cubic-bezier(0.4, 0, 1, 1)
  - 移动: cubic-bezier(0.4, 0, 0.2, 1)
- **Duration:** 
  - 微交互: 150ms
  - 状态转换: 200ms  
  - 页面切换: 300ms
  - 数据加载: 400ms
- **特殊效果:**
  - 数据更新时subtle highlight fade
  - 预警状态的breathing animation (2s循环)

## Component Guidelines
### 数据表格
- 使用SF Mono确保数字对齐
- 行高48px适配中文
- 斑马条纹使用#F8FAFB
- 排序指示器使用Primary色

### 图表
- Recharts配色遵循语义色彩
- 趋势线使用Primary #0066CC
- 警戒线使用Warning #F59E0B
- 背景网格使用#E5E7EB，opacity 0.5

### 卡片层次
- L1: 白色背景，subtle阴影
- L2: #EEF4F9背景，无阴影
- L3: #F8FAFB背景，内嵌效果

### 交互状态
- Hover: opacity 0.8
- Active: transform scale(0.98)
- Focus: 2px solid Primary色outline
- Disabled: opacity 0.5

## 解决的核心问题
1. **AI通用感** → PingFang字体 + 专业配色建立独特视觉身份
2. **中文显示质量** → PingFang SC专门优化，告别Inter的中文问题
3. **卡片背景不协调** → 三层表面系统，清晰的视觉层次
4. **交互问题** → 明确滚动层级，页面级vs组件级滚动定义
5. **决策效率** → 重要信息前置，3秒识别关键状态

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-27 | 采用PingFang SC字体系统 | 替代Inter，解决中文显示质量问题，提升专业感 |
| 2026-04-27 | 浅色主题为主，深色可选 | 现代友好的数据分析工具定位，降低严肃感 |
| 2026-04-27 | #0066CC专业蓝主色 | 建立医疗可信感，避免过于鲜艳的MD3配色 |
| 2026-04-27 | 8px舒适网格系统 | 数据密集环境需要足够呼吸空间，提升长时间使用体验 |
| 2026-04-27 | 决策导向信息架构 | 面向PI/PM的决策需求，关键信息前置 |