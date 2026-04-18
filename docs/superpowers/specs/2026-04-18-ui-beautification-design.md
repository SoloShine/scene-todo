# UI 美化设计方案

## 概述

对 SceneTodo 主应用窗口和浮动 Widget 进行全面视觉美化，采用极简现代风格（类似 Linear/Notion），以 Indigo 为主色调。

## 设计目标

- 从朴素的灰白界面升级为精致的极简现代风格
- 保持现有功能和组件结构不变，聚焦视觉层改造
- 统一配色、间距、圆角、阴影等设计 token
- 增强 hover/active 交互反馈

## 主题系统

### 三层主题架构

```
主题色 (Accent) × 明暗模式 (Mode) = 最终配色
```

用户可自由选择主题色（Indigo/Emerald/Rose/Slate/自定义），同时切换浅色/深色模式。两两组合产生最终配色。

### 主题色预设

| 预设名 | 主色 | 浅色变体 | 深色变体 |
|--------|------|----------|----------|
| Indigo | #6366f1 | #818cf8 | #4f46e5 |
| Emerald | #10b981 | #34d399 | #059669 |
| Rose | #f43f5e | #fb7185 | #e11d48 |
| Slate | #475569 | #94a3b8 | #334155 |
| Amber | #f59e0b | #fbbf24 | #d97706 |
| Sky | #0ea5e9 | #38bdf8 | #0284c7 |

### CSS 变量结构

使用语义化变量名，通过 `data-theme` 和 `data-accent` 属性驱动切换：

```css
:root {
  /* 明暗模式相关 — 浅色默认 */
  --background: oklch(0.98 0.005 280);     /* #fafafe */
  --card: oklch(1 0 0);                     /* #ffffff */
  --card-border: oklch(0.94 0.02 280);      /* #eef2ff */
  --text-primary: oklch(0.15 0.04 280);     /* #1e1b4b */
  --text-secondary: oklch(0.40 0.02 260);   /* #475569 */
  --text-muted: oklch(0.70 0.02 260);       /* #94a3b8 */
  --divider: oklch(0.96 0.015 280);          /* #f5f3ff */

  /* 主题色 — 默认 Indigo，通过 data-accent 切换 */
  --accent: oklch(0.51 0.22 280);            /* primary */
  --accent-light: oklch(0.65 0.20 280);      /* primary-light */
  --accent-bg: oklch(0.96 0.04 280);         /* primary-bg */
  --accent-border: oklch(0.87 0.08 280);     /* primary-border */
  --accent-text: oklch(0.40 0.15 280);       /* primary 上文字 */

  /* 固定语义色（不受主题色影响） */
  --destructive: oklch(0.58 0.25 25);        /* 红 */
  --warning: oklch(0.70 0.18 85);            /* 黄 */
  --success: oklch(0.62 0.19 160);           /* 绿 */
}

/* 深色模式 */
.dark {
  --background: oklch(0.15 0.01 280);
  --card: oklch(0.20 0.01 280);
  --card-border: oklch(0.27 0.02 280);
  --text-primary: oklch(0.95 0.01 280);
  --text-secondary: oklch(0.75 0.01 260);
  --text-muted: oklch(0.55 0.01 260);
  --divider: oklch(0.25 0.015 280);

  --accent-text: oklch(0.95 0.01 280);
}

/* 主题色切换示例 — 通过 data-accent 属性 */
[data-accent="emerald"] {
  --accent: oklch(0.57 0.19 160);
  --accent-light: oklch(0.70 0.17 160);
  --accent-bg: oklch(0.96 0.04 160);
  --accent-border: oklch(0.87 0.08 160);
  --accent-text: oklch(0.40 0.12 160);
}
/* ... 其他主题色预设类似 */
```

### 主题存储与切换

- 主题偏好（accent + mode）存入 SQLite settings 表
- React Context (`ThemeProvider`) 管理运行时主题状态
- 切换时更新 `<html>` 的 `class`（dark）和 `data-accent` 属性
- 支持 3 种模式选项：浅色、深色、跟随系统

### 组件中引用主题色

组件统一使用语义化 class，不硬编码颜色：
- 活跃态：`bg-[var(--accent-bg)] text-[var(--accent)]`
- 边框：`border-[var(--card-border)]`
- 文字层次：`text-[var(--text-primary)]` / `text-[var(--text-secondary)]` / `text-[var(--text-muted)]`

通过 Tailwind v4 的 `@theme` 将这些变量映射为工具类（如 `bg-primary`、`text-muted`），减少内联 `var()` 书写。

场景色彩标识（保持现有场景自定义颜色的基础上提供默认值）：
- 工作：#6366f1 (indigo)
- 学习：#34d399 (emerald)
- 生活：#fb923c (orange)

优先级色彩（保持现有红黄绿体系，通过 CSS 变量适配深色模式）：
- 高：var(--destructive)
- 中：var(--warning)
- 低：var(--success)

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

- 新增功能或组件
- 布局结构大改（保持现有 flex/grid 布局）
- 性能优化
- 自定义主题色的颜色选择器 UI（先支持预设色，后续可扩展）

## 实施策略

方案 B（组件重设计）：更新 CSS 变量 + 针对性组件视觉改造。不动组件 props/状态逻辑，只改 className 和样式。新增 ThemeProvider 管理主题色和明暗模式切换。
