# UI 美化设计方案

## 概述

对 SceneTodo 主应用窗口和浮动 Widget 进行全面视觉美化，采用极简现代风格（类似 Linear/Notion），以 Indigo 为主色调。

## 设计目标

- 从朴素的灰白界面升级为精致的极简现代风格
- 保持现有功能和组件结构不变，聚焦视觉层改造
- 统一配色、间距、圆角、阴影等设计 token
- 增强 hover/active 交互反馈

## 配色系统

基于 Indigo 色系重新定义 OKLCH CSS 变量：

| Token | 值 | 用途 |
|-------|------|------|
| primary | #6366f1 (indigo-500) | 主操作、活跃状态、强调 |
| primary-light | #818cf8 (indigo-400) | 次要强调 |
| primary-bg | #eef2ff (indigo-50) | 活跃项背景 |
| primary-border | #c7d2fe (indigo-200) | 边框、复选框 |
| background | #fafafe | 页面背景（微蓝白） |
| card | #ffffff | 卡片背景 |
| card-border | #eef2ff | 卡片边框 |
| text-primary | #1e1b4b | 主文字 |
| text-secondary | #475569 | 次要文字 |
| text-muted | #94a3b8 | 占位、辅助 |
| divider | #f5f3ff | 分隔线 |

场景色彩标识（保持现有场景自定义颜色的基础上提供默认值）：
- 工作：#6366f1 (indigo)
- 学习：#34d399 (emerald)
- 生活：#fb923c (orange)

优先级色彩（保持现有红黄绿体系）：
- 高：#dc2626 bg #fef2f2
- 中：#d97706 bg #fffbeb
- 低：#059669 bg #ecfdf5

## 各组件改造方案

### 1. 侧边栏 (Sidebar)

**结构不变，视觉增强：**
- 分段标题（智能视图/场景/分组/标签）使用 `text-indigo-400` + `uppercase` + `letter-spacing`
- 活跃项：`bg-indigo-50 text-indigo-600 font-medium` + 左侧无额外指示条
- 场景项：添加彩色圆点（8px）作为标识，圆点颜色取场景自定义色
- 智能视图添加未完成计数徽章：`bg-indigo-500 text-white text-[9px] rounded-full px-1.5`
- 侧边栏背景：`bg-[#fafafe]`，右边框 `border-indigo-50/50`
- App 图标/Logo：Indigo 渐变色方块 + 白色字母

**拥挤问题处理：**
- 每个分组默认折叠，点击展开
- 折叠时只显示分组标题和计数
- 展开后显示子项列表

### 2. 待办列表 (TodoList + TodoItem)

**列表视图：**
- 所有待办项放入统一白色卡片容器：`bg-white rounded-xl border border-indigo-50 p-1`
- 项之间用 `border-b border-[#f5f3ff]` 分隔

**单个 TodoItem：**
- 未完成复选框：`border-2 border-indigo-200 rounded-md w-[18px] h-[18px]`，hover 变 `border-indigo-400`
- 已完成复选框：`bg-indigo-500 rounded-md` + 白色 ✓
- 标题：`text-[#1e1b4b] font-medium`
- 副信息行：截止日期、场景名等用 `text-indigo-300 text-[10px]`
- 优先级标签：pill 形状 `text-[9px] rounded-full px-2 py-0.5 font-semibold`
- 自定义标签：pill 形状 `bg-indigo-50 text-indigo-600 text-[9px] rounded-full px-2`
- 已完成项：`opacity-45`，标题 `text-slate-400 line-through`
- Hover 效果：`hover:bg-[#fafaff] rounded-lg`

**列表标题区：**
- 标题：`text-xl font-bold text-[#1e1b4b]`
- 副标题：`text-xs text-slate-400` 显示待办数量
- 视图切换（列表/日历）：Pill 形状切换按钮

### 3. 浮动 Widget

**毛玻璃增强：**
- 透明度：0.85 → 0.92
- 模糊：`backdrop-filter: blur(20px) saturate(180%)`
- 圆角：10px → 14px
- 边框：`1px solid rgba(255,255,255,0.5)`
- 阴影：`box-shadow: 0 8px 32px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.06)`

**内部样式：**
- Header：场景名 + indigo 圆点 + 未完成计数 pill
- 待办项：圆角复选框、hover 交互 `hover:bg-indigo-50/40`、行内小圆点优先级指示
- 已完成项：indigo 色勾选框 + `opacity-45`
- 快速添加：dashed 边框 `border-dashed border-indigo-200` + indigo 占位符文字

### 4. 统计页面 (StatsView)

**概览卡片：**
- 4 列网格布局，每个卡片 `bg-white rounded-xl border border-indigo-50 p-4`
- 图标：28px 圆角方块，渐变色背景（不同色调区分）
- 数据：`text-2xl font-bold text-[#1e1b4b]`
- 趋势：绿色表示增长，indigo 表示目标，amber 表示连续

**柱状图（Recharts）：**
- 柱体填充改为 indigo 渐变（`#818cf8` → `#6366f1`）
- 周末柱体使用浅色（`#a5b4fc` → `#818cf8`）
- 今天未完成用虚线边框

**场景分布图：**
- 彩色圆角进度条：高度 6px、圆角 99px
- 背景色用场景色的极浅色
- 进度条用场景色的渐变

**时间选择器：**
- 外层 `bg-white rounded-lg border border-indigo-50 p-0.5`
- 选中态：`bg-indigo-500 text-white rounded-md`
- 未选中：`text-slate-400`

### 5. 其他组件

**模态框（SceneEditor、BindingEditor 等）：**
- 背景遮罩：`bg-black/30` → `bg-[#1e1b4b]/20`（带 indigo 色调）
- 内容框：`bg-white rounded-2xl border border-indigo-50`

**设置页面：**
- 输入框：`border-indigo-100 focus:border-indigo-300 focus:ring-indigo-100`
- 开关/选择器：indigo 色活跃态

**日历视图：**
- 选中日期：`bg-indigo-500 text-white rounded-lg`
- 有待办的日期：底部小圆点指示器

## 不在本次范围内

- 暗色模式重新设计（保持现有暗色模式不变，后续单独优化）
- 新增功能或组件
- 布局结构大改（保持现有 flex/grid 布局）
- 性能优化

## 实施策略

方案 B（组件重设计）：更新 CSS 变量 + 针对性组件视觉改造。不动组件 props/状态逻辑，只改 className 和样式。
