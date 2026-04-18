# UI 美化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 SceneTodo 的朴素灰白界面升级为 Indigo 极简现代风格，支持主题色切换和浅色/深色模式。

**Architecture:** 三层主题架构 — 主题色 (Accent) × 明暗模式 (Mode)。CSS 变量驱动，ThemeProvider React Context 管理运行时状态，localStorage 持久化偏好。组件仅改 className，不改 props/状态逻辑。

**Tech Stack:** Tailwind CSS v4 (OKLCH 变量 + @theme inline)、React Context、localStorage

---

## File Structure

### 新建文件
- `src/hooks/useTheme.ts` — ThemeProvider hook，管理 accent + mode 状态
- `src/components/settings/ThemeSettings.tsx` — 主题设置子组件（主题色选择 + 明暗模式切换）

### 修改文件
- `src/index.css` — 重写 CSS 变量系统，添加 accent 预设 + 深色模式
- `src/main.tsx` — 包裹 ThemeProvider
- `src/widget-entry.tsx` — 包裹 ThemeProvider
- `src/App.tsx` — 更新容器 className
- `src/components/sidebar/Sidebar.tsx` — 视觉更新
- `src/components/sidebar/SectionHeader.tsx` — 分段标题样式
- `src/components/sidebar/SmartViews.tsx` — 智能视图按钮
- `src/components/sidebar/SceneList.tsx` — 场景列表
- `src/components/sidebar/GroupList.tsx` — 分组列表
- `src/components/sidebar/TagList.tsx` — 标签列表
- `src/components/todo/TodoList.tsx` — 列表容器 + 筛选栏
- `src/components/todo/TodoItem.tsx` — 待办项卡片
- `src/components/todo/TodoForm.tsx` — 快速添加表单
- `src/components/todo/TodoDetailEditor.tsx` — 详情弹出框
- `src/components/todo/CalendarView.tsx` — 日历视图
- `src/components/widget/Widget.tsx` — 浮动 Widget
- `src/components/widget/WidgetTodoItem.tsx` — Widget 待办项
- `src/components/stats/StatsView.tsx` — 统计页容器
- `src/components/stats/RealtimeOverview.tsx` — 实时概览卡片
- `src/components/stats/TimeDistribution.tsx` — 时间分布图表
- `src/components/stats/SceneTimeline.tsx` — 场景时间线
- `src/components/settings/Settings.tsx` — 设置页 + 主题设置区
- `src/components/scene/SceneEditor.tsx` — 场景编辑模态框
- `src/components/binding/BindingEditor.tsx` — 绑定编辑模态框

---

### Task 1: CSS 主题变量系统

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: 重写 index.css 的 `:root` 变量**

将当前纯灰色 OKLCH 变量替换为 Indigo 色系 + 语义化结构。保留 shadcn/ui 所需的变量名，但值全部更新。在 `:root` 和 `.dark` 中定义明暗模式，通过 `[data-accent]` 属性切换主题色。

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";

@custom-variant dark (&:is(.dark *));

@theme inline {
    --font-heading: var(--font-sans);
    --font-sans: 'Geist Variable', sans-serif;

    /* shadcn/ui 映射 */
    --color-sidebar-ring: var(--sidebar-ring);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar: var(--sidebar);
    --color-chart-5: var(--chart-5);
    --color-chart-4: var(--chart-4);
    --color-chart-3: var(--chart-3);
    --color-chart-2: var(--chart-2);
    --color-chart-1: var(--chart-1);
    --color-ring: var(--ring);
    --color-input: var(--input);
    --color-border: var(--border);
    --color-destructive: var(--destructive);
    --color-accent-foreground: var(--accent-foreground);
    --color-accent: var(--accent);
    --color-muted-foreground: var(--muted-foreground);
    --color-muted: var(--muted);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-secondary: var(--secondary);
    --color-primary-foreground: var(--primary-foreground);
    --color-primary: var(--primary);
    --color-popover-foreground: var(--popover-foreground);
    --color-popover: var(--popover);
    --color-card-foreground: var(--card-foreground);
    --color-card: var(--card);
    --color-foreground: var(--foreground);
    --color-background: var(--background);

    /* 自定义语义色 — 供组件直接用 Tailwind 类引用 */
    --color-theme: var(--accent-base);
    --color-theme-light: var(--accent-light);
    --color-theme-bg: var(--accent-bg);
    --color-theme-border: var(--accent-border);
    --color-theme-text: var(--accent-text);
    --color-surface: var(--surface);
    --color-surface-border: var(--surface-border);
    --color-surface-divider: var(--surface-divider);

    --radius-sm: calc(var(--radius) * 0.6);
    --radius-md: calc(var(--radius) * 0.8);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) * 1.4);
    --radius-2xl: calc(var(--radius) * 1.8);
    --radius-3xl: calc(var(--radius) * 2.2);
    --radius-4xl: calc(var(--radius) * 2.6);
}

/* ===== 浅色模式（默认） ===== */
:root {
    /* 基础色板 */
    --background: oklch(0.985 0.002 280);
    --foreground: oklch(0.145 0.04 280);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0.04 280);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0.04 280);

    /* shadcn/ui primary 映射到主题色 */
    --primary: var(--accent-base);
    --primary-foreground: oklch(1 0 0);
    --secondary: oklch(0.96 0.01 280);
    --secondary-foreground: oklch(0.205 0.04 280);
    --muted: oklch(0.96 0.01 280);
    --muted-foreground: oklch(0.556 0.02 260);
    --accent: oklch(0.96 0.04 280);
    --accent-foreground: oklch(0.205 0.04 280);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.93 0.02 280);
    --input: oklch(0.93 0.02 280);
    --ring: oklch(0.708 0.10 280);
    --radius: 0.625rem;

    /* 语义表面色 */
    --surface: oklch(0.985 0.002 280);
    --surface-border: oklch(0.94 0.02 280);
    --surface-divider: oklch(0.96 0.015 280);

    /* 图表色 */
    --chart-1: var(--accent-base);
    --chart-2: var(--accent-light);
    --chart-3: oklch(0.6 0.15 160);
    --chart-4: oklch(0.65 0.15 55);
    --chart-5: oklch(0.55 0.20 25);

    /* 侧边栏 */
    --sidebar: oklch(0.985 0.003 280);
    --sidebar-foreground: oklch(0.145 0.04 280);
    --sidebar-primary: var(--accent-base);
    --sidebar-primary-foreground: oklch(1 0 0);
    --sidebar-accent: var(--accent-bg);
    --sidebar-accent-foreground: oklch(0.205 0.04 280);
    --sidebar-border: oklch(0.94 0.02 280);
    --sidebar-ring: var(--accent-base);

    /* === 主题色（Indigo 默认） === */
    --accent-base: oklch(0.510 0.210 280);
    --accent-light: oklch(0.650 0.200 280);
    --accent-bg: oklch(0.960 0.040 280);
    --accent-border: oklch(0.870 0.080 280);
    --accent-text: oklch(0.250 0.100 280);
}

/* ===== 深色模式 ===== */
.dark {
    --background: oklch(0.145 0.015 280);
    --foreground: oklch(0.980 0.005 280);
    --card: oklch(0.200 0.015 280);
    --card-foreground: oklch(0.980 0.005 280);
    --popover: oklch(0.200 0.015 280);
    --popover-foreground: oklch(0.980 0.005 280);
    --primary: var(--accent-light);
    --primary-foreground: oklch(0.145 0.04 280);
    --secondary: oklch(0.269 0.010 280);
    --secondary-foreground: oklch(0.980 0.005 280);
    --muted: oklch(0.269 0.010 280);
    --muted-foreground: oklch(0.708 0.010 260);
    --accent: oklch(0.269 0.020 280);
    --accent-foreground: oklch(0.980 0.005 280);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0.10 280);

    --surface: oklch(0.145 0.015 280);
    --surface-border: oklch(0.270 0.015 280);
    --surface-divider: oklch(0.250 0.010 280);

    --chart-1: var(--accent-light);
    --chart-2: var(--accent-base);
    --chart-3: oklch(0.65 0.15 160);
    --chart-4: oklch(0.70 0.15 55);
    --chart-5: oklch(0.60 0.20 25);

    --sidebar: oklch(0.170 0.015 280);
    --sidebar-foreground: oklch(0.980 0.005 280);
    --sidebar-primary: var(--accent-light);
    --sidebar-primary-foreground: oklch(0.980 0.005 280);
    --sidebar-accent: oklch(0.269 0.020 280);
    --sidebar-accent-foreground: oklch(0.980 0.005 280);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.556 0.10 280);

    --accent-text: oklch(0.950 0.010 280);
}

/* ===== 主题色预设 ===== */
[data-accent="indigo"] {
    --accent-base: oklch(0.510 0.210 280);
    --accent-light: oklch(0.650 0.200 280);
    --accent-bg: oklch(0.960 0.040 280);
    --accent-border: oklch(0.870 0.080 280);
    --accent-text: oklch(0.250 0.100 280);
}

[data-accent="emerald"] {
    --accent-base: oklch(0.570 0.190 160);
    --accent-light: oklch(0.700 0.170 160);
    --accent-bg: oklch(0.960 0.040 160);
    --accent-border: oklch(0.870 0.080 160);
    --accent-text: oklch(0.250 0.080 160);
}

[data-accent="rose"] {
    --accent-base: oklch(0.560 0.220 10);
    --accent-light: oklch(0.680 0.200 10);
    --accent-bg: oklch(0.960 0.040 10);
    --accent-border: oklch(0.870 0.080 10);
    --accent-text: oklch(0.250 0.100 10);
}

[data-accent="slate"] {
    --accent-base: oklch(0.450 0.020 260);
    --accent-light: oklch(0.650 0.020 260);
    --accent-bg: oklch(0.960 0.005 260);
    --accent-border: oklch(0.870 0.010 260);
    --accent-text: oklch(0.200 0.010 260);
}

[data-accent="amber"] {
    --accent-base: oklch(0.650 0.180 85);
    --accent-light: oklch(0.760 0.165 85);
    --accent-bg: oklch(0.960 0.040 85);
    --accent-border: oklch(0.880 0.080 85);
    --accent-text: oklch(0.250 0.080 85);
}

[data-accent="sky"] {
    --accent-base: oklch(0.580 0.180 230);
    --accent-light: oklch(0.720 0.160 230);
    --accent-bg: oklch(0.960 0.040 230);
    --accent-border: oklch(0.880 0.080 230);
    --accent-text: oklch(0.250 0.080 230);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
    }
  body {
    @apply bg-background text-foreground;
    }
  html {
    @apply font-sans;
    }
}
```

- [ ] **Step 2: 验证 CSS 编译**

Run: `cd d:/Project/overlay-todo && npx vite build 2>&1 | tail -5`
Expected: 构建成功，无 CSS 报错

- [ ] **Step 3: 提交**

```bash
git add src/index.css
git commit -m "feat: rewrite CSS theme system with accent presets and dark mode variables"
```

---

### Task 2: ThemeProvider Hook

**Files:**
- Create: `src/hooks/useTheme.ts`

- [ ] **Step 1: 创建 useTheme.ts**

创建主题管理 hook，提供 ThemeProvider 组件和 useTheme hook。管理 `data-accent` 属性和 `.dark` class。持久化到 localStorage。

```tsx
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

export type AccentPreset = "indigo" | "emerald" | "rose" | "slate" | "amber" | "sky";
export type ColorMode = "light" | "dark" | "system";

interface ThemeState {
  accent: AccentPreset;
  mode: ColorMode;
}

interface ThemeContextValue extends ThemeState {
  setAccent: (a: AccentPreset) => void;
  setMode: (m: ColorMode) => void;
  resolvedMode: "light" | "dark";
}

const STORAGE_KEY = "scene-todo-theme";
const DEFAULT: ThemeState = { accent: "indigo", mode: "system" };

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemMode(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function loadState(): ThemeState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { accent: parsed.accent || DEFAULT.accent, mode: parsed.mode || DEFAULT.mode };
    }
  } catch {}
  return DEFAULT;
}

function saveState(state: ThemeState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(loadState);
  const resolvedMode = state.mode === "system" ? getSystemMode() : state.mode;

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-accent", state.accent);
    el.classList.toggle("dark", resolvedMode === "dark");
    saveState(state);
  }, [state.accent, resolvedMode]);

  useEffect(() => {
    if (state.mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setState((s) => ({ ...s }));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [state.mode]);

  const setAccent = useCallback((accent: AccentPreset) => setState((s) => ({ ...s, accent })), []);
  const setMode = useCallback((mode: ColorMode) => setState((s) => ({ ...s, mode })), []);

  return (
    <ThemeContext.Provider value={{ ...state, setAccent, setMode, resolvedMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
```

- [ ] **Step 2: 在 main.tsx 包裹 ThemeProvider**

修改 `src/main.tsx`，在 StrictMode 内包裹 ThemeProvider：

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./hooks/useTheme";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 3: 在 widget-entry.tsx 包裹 ThemeProvider**

修改 `src/widget-entry.tsx`：

```tsx
import ReactDOM from "react-dom/client";
import { Widget } from "./components/widget/Widget";
import { ThemeProvider } from "./hooks/useTheme";
import "./index.css";

interface SceneInfo {
  id: number;
  name: string;
  icon: string | null;
  color: string;
}

const params = new URLSearchParams(window.location.search);
const appId = parseInt(params.get("app_id") || "0", 10);
const appName = params.get("app_name") || "Unknown";

const scenesRaw = params.get("scenes");
const scenes: SceneInfo[] = scenesRaw
  ? JSON.parse(scenesRaw)
  : (params.get("scene_names") || "")
      .split(",")
      .filter(Boolean)
      .map((name: string, i: number) => ({
        id: -(i + 1),
        name,
        icon: null,
        color: "#6B7280",
      }));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <Widget appId={appId} appName={appName} scenes={scenes} />
  </ThemeProvider>
);
```

- [ ] **Step 4: 验证构建**

Run: `cd d:/Project/overlay-todo && npx vite build 2>&1 | tail -5`
Expected: 构建成功

- [ ] **Step 5: 提交**

```bash
git add src/hooks/useTheme.ts src/main.tsx src/widget-entry.tsx
git commit -m "feat: add ThemeProvider with accent color and light/dark mode support"
```

---

### Task 3: 侧边栏视觉更新

**Files:**
- Modify: `src/components/sidebar/Sidebar.tsx`
- Modify: `src/components/sidebar/SectionHeader.tsx`
- Modify: `src/components/sidebar/SmartViews.tsx`
- Modify: `src/components/sidebar/SceneList.tsx`
- Modify: `src/components/sidebar/GroupList.tsx`
- Modify: `src/components/sidebar/TagList.tsx`

所有文件统一使用主题语义类名替换硬编码灰色。替换规则：

| 旧值 | 新值 |
|------|------|
| `bg-white` (侧边栏) | `bg-sidebar` |
| `bg-gray-50` (hover) | `hover:bg-accent` |
| `text-gray-500` (标题) | `text-theme-light` |
| `text-gray-600` (次要) | `text-muted-foreground` |
| `text-gray-800` (主文字) | `text-foreground` |
| `text-gray-400` (辅助) | `text-muted-foreground/70` |
| `border-gray-200` | `border-sidebar-border` |
| `border-gray-100` | `border-surface-divider` |
| `bg-gray-100` (inactive) | `bg-muted` |
| `hover:bg-gray-200` | `hover:bg-accent` |
| `bg-blue-50 text-blue-700` (selected) | `bg-theme-bg text-theme` |
| `bg-blue-100 text-blue-700 ring-1 ring-blue-200` (selected) | `bg-theme-bg text-theme ring-1 ring-theme-border` |

- [ ] **Step 1: 更新 Sidebar.tsx**

替换关键 className：

```tsx
// aside 容器
<aside className="w-60 border-r border-sidebar-border bg-sidebar flex flex-col">

// Logo 区
<div className="p-3 border-b border-sidebar-border">
  <div className="flex items-center gap-2">
    <div className="w-6 h-6 rounded-md bg-gradient-to-br from-theme to-theme-light flex items-center justify-center text-white text-[11px] font-bold">S</div>
    <h1 className="text-sm font-bold text-foreground">SceneTodo</h1>
  </div>
</div>

// 底部按钮区
<div className="p-2 border-t border-sidebar-border flex gap-1">
  <button className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground rounded-md hover:bg-accent transition-colors">
  <button className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground rounded-md hover:bg-accent transition-colors">
```

- [ ] **Step 2: 更新 SectionHeader.tsx**

```tsx
// 标题按钮
className="flex items-center gap-1.5 text-xs font-semibold text-theme-light uppercase tracking-wide hover:text-theme"

// 展开箭头旁的计数
className="text-[10px] text-muted-foreground/70 font-normal normal-case"

// 添加按钮
className="text-muted-foreground/70 hover:text-theme text-sm opacity-0 group-hover:opacity-100 transition-opacity"
```

- [ ] **Step 3: 更新 SmartViews.tsx**

```tsx
className="px-2 py-0.5 text-xs text-muted-foreground rounded-full hover:bg-accent hover:text-theme transition-colors"
```

- [ ] **Step 4: 更新 SceneList.tsx**

```tsx
// 新建输入框
className="w-full px-2 py-1 text-xs border border-surface-border rounded-md mb-1 bg-background focus:border-theme-border outline-none"

// 场景按钮 - 选中
"bg-theme-bg text-theme ring-1 ring-theme-border"

// 场景按钮 - 未选中
"bg-muted text-muted-foreground hover:bg-accent"
```

- [ ] **Step 5: 更新 GroupList.tsx**

```tsx
// 新建输入框
className="w-full px-2 py-1 text-xs border border-surface-border rounded-md mb-0.5 bg-background focus:border-theme-border outline-none"

// 全部待办按钮 - 选中
"bg-theme-bg text-theme"

// 全部待办按钮 - 未选中
"hover:bg-accent text-muted-foreground"

// 分组项 - 选中
"bg-theme-bg text-theme"

// 分组项 - 未选中
"hover:bg-accent text-muted-foreground"

// 删除按钮
"opacity-0 group-hover:opacity-100 text-muted-foreground/70 hover:text-destructive text-[10px]"
```

- [ ] **Step 6: 更新 TagList.tsx**

```tsx
// 新建输入框
className="w-full px-2 py-1 text-xs border border-surface-border rounded-md mb-1 bg-background focus:border-theme-border outline-none"
```

（TagList 的标签按钮使用动态 style，保持不变）

- [ ] **Step 7: 验证**

Run: `cd d:/Project/overlay-todo && npx vite build 2>&1 | tail -5`
Expected: 构建成功

- [ ] **Step 8: 提交**

```bash
git add src/components/sidebar/
git commit -m "feat: update sidebar styling with theme-aware class names"
```

---

### Task 4: 待办列表视觉更新

**Files:**
- Modify: `src/components/todo/TodoList.tsx`
- Modify: `src/components/todo/TodoItem.tsx`
- Modify: `src/components/todo/TodoForm.tsx`
- Modify: `src/components/todo/TodoDetailEditor.tsx`

替换规则（同 Task 3，以下只列关键差异）：

| 旧值 | 新值 |
|------|------|
| `bg-gray-50` (页面背景) | `bg-background` |
| `hover:bg-gray-50` (todo hover) | `hover:bg-accent` |
| `border-gray-200` (输入框/分隔) | `border-surface-border` |
| `border-gray-100` | `border-surface-divider` |
| `text-gray-300` (+ 占位) | `text-theme-border` |
| `text-gray-400` (已完成文字) | `text-muted-foreground` |
| `text-gray-500` (辅助) | `text-muted-foreground` |
| `text-gray-700` (正文) | `text-foreground` |
| `text-gray-800` (标题) | `text-foreground` |
| `text-red-600` (高优先) | `text-destructive` |
| `bg-red-50` | `bg-destructive/10` |
| `text-yellow-600` | `text-[oklch(0.650_0.180_85)]` |
| `bg-yellow-50` | `bg-[oklch(0.960_0.040_85)]` |

- [ ] **Step 1: 更新 TodoList.tsx**

关键替换：
```tsx
// 搜索输入框
className="w-full pl-7 pr-2 py-1 text-xs border border-surface-border rounded-md bg-background focus:border-theme-border outline-none"

// 筛选栏
className="px-3 py-1.5 border-b border-surface-divider bg-background/50"

// 分组标题
className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent"

// 视图切换按钮 - 选中
className="px-2 py-0.5 text-xs rounded-md bg-theme text-theme-text font-medium"

// 视图切换按钮 - 未选中
className="px-2 py-0.5 text-xs rounded-md text-muted-foreground hover:bg-accent"
```

- [ ] **Step 2: 更新 TodoItem.tsx**

关键替换：
```tsx
// 整行容器
className="group flex items-start gap-2.5 px-3 py-2 hover:bg-accent/50 transition-colors rounded-lg"

// 未完成复选框
className="w-[18px] h-[18px] rounded-md border-2 border-theme-border hover:border-theme flex-shrink-0 transition-colors"

// 已完成复选框
className="w-[18px] h-[18px] rounded-md bg-theme flex-shrink-0 flex items-center justify-center text-white text-[10px]"

// 标题 - 未完成
className="text-sm text-foreground font-medium"

// 标题 - 已完成
className="text-sm text-muted-foreground line-through"

// 优先级标签 pill
className="text-[9px] px-2 py-0.5 rounded-full font-semibold"

// 高优先：bg-destructive/10 text-destructive
// 中优先：bg-[oklch(0.960_0.040_85)] text-[oklch(0.650_0.180_85)]
// 低优先：bg-[oklch(0.960_0.040_160)]/10 text-[oklch(0.600_0.150_160)]

// 副信息行
className="text-[10px] text-theme-light/60"

// 操作按钮区
className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"

// 删除按钮 hover
className="text-muted-foreground hover:text-destructive"

// 待办项分隔线（在 TodoList 层）
className="border-b border-surface-divider mx-3"
```

- [ ] **Step 3: 更新 TodoForm.tsx**

```tsx
// 容器
className="flex items-center gap-2 p-3 border-b border-surface-border"

// 加号图标
className="text-theme-border text-lg"

// 输入框
className="flex-1 text-sm outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
```

- [ ] **Step 4: 更新 TodoDetailEditor.tsx**

```tsx
// 遮罩层
className="fixed inset-0 bg-foreground/20 z-50"

// 内容框
className="absolute bg-card rounded-xl border border-surface-border shadow-xl w-56 p-3"

// 各 label/text 替换 text-gray-600 → text-muted-foreground, text-gray-700 → text-foreground

// checkbox/input
className="... border-surface-border focus:border-theme-border"
```

- [ ] **Step 5: 验证**

Run: `cd d:/Project/overlay-todo && npx vite build 2>&1 | tail -5`

- [ ] **Step 6: 提交**

```bash
git add src/components/todo/
git commit -m "feat: update todo list components with theme-aware styling"
```

---

### Task 5: 浮动 Widget 视觉更新

**Files:**
- Modify: `src/components/widget/Widget.tsx`
- Modify: `src/components/widget/WidgetTodoItem.tsx`

- [ ] **Step 1: 更新 Widget.tsx**

Widget 大量使用 inline style（因为是浮动窗口，需要动态值），保留 inline style 模式但更新样式：

```tsx
// 外层容器 style 替换
style={{
  background: passthrough
    ? `rgba(255, 255, 255, 0.92)`
    : `rgba(255, 255, 255, ${bgAlpha})`,
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  borderRadius: "14px",
  border: passthrough
    ? "1px dashed rgba(99, 102, 241, 0.4)"
    : "1px solid rgba(255, 255, 255, 0.5)",
  boxShadow: "0 8px 32px rgba(99,102,241,0.12), 0 2px 8px rgba(0,0,0,0.06)",
}}

// Header 区域
<div className="flex items-center justify-between px-3 py-1.5 cursor-move" data-tauri-drag-region>
  <div className="flex items-center gap-1.5">
    <div className="w-1.5 h-1.5 rounded-full bg-theme" />
    <span className="text-xs font-semibold text-theme-text">{sceneName}</span>
    <span className="bg-theme-bg text-theme text-[9px] px-1.5 rounded-full font-semibold">{todoCount}</span>
  </div>
  <div className="flex gap-1">
    {/* 操作按钮：w-5 h-5 rounded bg-theme-bg/30 text-theme text-[10px] */}
  </div>
</div>

// Quick add 输入框
className="w-full px-2 py-1 text-[11px] rounded-lg bg-theme-bg/30 border border-dashed border-theme-border text-foreground placeholder:text-theme-light/60 outline-none focus:border-theme"

// 待办列表区
className="px-2 pb-1.5 space-y-0.5"
```

- [ ] **Step 2: 更新 WidgetTodoItem.tsx**

```tsx
// 容器
className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/40 transition-colors"

// 未完成复选框
className="w-3.5 h-3.5 rounded-[3px] border-[1.5px] border-theme-border hover:border-theme flex-shrink-0 transition-colors"

// 已完成复选框
className="w-3.5 h-3.5 rounded-[3px] bg-theme flex-shrink-0 flex items-center justify-center"

// 勾选符号
<span className="text-white text-[7px]">✓</span>

// 未完成文字
className="text-[11px] text-foreground"

// 已完成文字
className="text-[11px] text-muted-foreground line-through"
```

- [ ] **Step 3: 验证**

Run: `cd d:/Project/overlay-todo && npx vite build 2>&1 | tail -5`

- [ ] **Step 4: 提交**

```bash
git add src/components/widget/
git commit -m "feat: update widget with enhanced glassmorphism and theme-aware styling"
```

---

### Task 6: 统计页面视觉更新

**Files:**
- Modify: `src/components/stats/StatsView.tsx`
- Modify: `src/components/stats/RealtimeOverview.tsx`
- Modify: `src/components/stats/TimeDistribution.tsx`
- Modify: `src/components/stats/SceneTimeline.tsx`

- [ ] **Step 1: 更新 StatsView.tsx**

```tsx
// 容器
className="p-6 max-w-4xl mx-auto"

// 标题
className="text-xl font-bold text-foreground"

// 时间切换按钮组外层
className="inline-flex items-center gap-1 bg-card rounded-lg border border-surface-border p-0.5 mb-6"

// 切换按钮 - 选中
className="px-3 py-1.5 text-sm rounded-md bg-theme text-theme-text font-medium"

// 切换按钮 - 未选中
className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground"
```

- [ ] **Step 2: 更新 RealtimeOverview.tsx**

```tsx
// 卡片网格
className="grid grid-cols-3 gap-4 mb-6"

// 概览卡片
className="bg-card rounded-xl border border-surface-border p-4"

// 标签
className="text-xs text-muted-foreground mb-1"

// 数值
className="text-lg font-semibold text-foreground"
```

- [ ] **Step 3: 更新 TimeDistribution.tsx**

```tsx
// 图表容器
className="bg-card rounded-xl border border-surface-border p-4"

// 标题
className="text-sm font-semibold text-foreground mb-3"

// Recharts 颜色：将现有的灰色/蓝色替换
// 主色用 var(--accent-base) 或 #6366f1 作为 fallback
// Recharts 不直接支持 CSS 变量，用 JS getComputedStyle 获取
```

对于 Recharts 的颜色，在组件内通过 `getComputedStyle` 获取主题色：

```tsx
const accentBase = getComputedStyle(document.documentElement).getPropertyValue('--accent-base').trim() || '#6366f1';
```

- [ ] **Step 4: 更新 SceneTimeline.tsx**

```tsx
// 时间线容器
className="bg-card rounded-xl border border-surface-border p-4"

// 标题
className="text-sm font-semibold text-foreground mb-3"

// 小时刻度线
className="text-[10px] text-muted-foreground"

// 场景块：保持 inline style 的 backgroundColor（取场景自定义色）
// hover 效果
className="... rounded-md cursor-pointer hover:opacity-80 transition-opacity"
```

- [ ] **Step 5: 验证**

Run: `cd d:/Project/overlay-todo && npx vite build 2>&1 | tail -5`

- [ ] **Step 6: 提交**

```bash
git add src/components/stats/
git commit -m "feat: update stats page with themed cards and chart colors"
```

---

### Task 7: 日历 + 模态框视觉更新

**Files:**
- Modify: `src/components/todo/CalendarView.tsx`
- Modify: `src/components/scene/SceneEditor.tsx`
- Modify: `src/components/binding/BindingEditor.tsx`

- [ ] **Step 1: 更新 CalendarView.tsx**

```tsx
// 月导航标题
className="text-sm font-semibold text-foreground"

// 星期标题
className="text-[10px] text-muted-foreground text-center py-1"

// 日格网格
className="grid grid-cols-7 gap-px bg-surface-divider"

// 日格
className="min-h-[72px] p-1 bg-card cursor-pointer"

// 今天高亮（日期数字）
className="w-6 h-6 rounded-full bg-theme text-theme-text flex items-center justify-center text-xs font-semibold"

// 有待办日期底部圆点
className="w-1 h-1 rounded-full bg-theme mt-0.5"
```

- [ ] **Step 2: 更新 SceneEditor.tsx**

```tsx
// 遮罩
className="fixed inset-0 bg-foreground/20 flex items-center justify-center z-50"

// 内容框
className="bg-card rounded-2xl border border-surface-border shadow-xl w-96 p-5"

// 标题
className="text-base font-semibold text-foreground mb-4"

// 输入框
className="w-full px-3 py-2 text-sm border border-surface-border rounded-lg bg-background focus:border-theme-border outline-none"

// 表单 label
className="text-xs font-medium text-muted-foreground mb-1.5"

// 关联应用列表项
className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md hover:bg-accent"
```

- [ ] **Step 3: 更新 BindingEditor.tsx**

```tsx
// 遮罩
className="fixed inset-0 bg-foreground/20 flex items-center justify-center z-50"

// 内容框
className="bg-card rounded-2xl border border-surface-border shadow-xl w-80 p-5"

// 捕获按钮
className="w-full py-2 mb-3 text-sm rounded-lg border border-dashed border-theme-border text-theme hover:bg-accent transition-colors"
```

- [ ] **Step 4: 验证**

Run: `cd d:/Project/overlay-todo && npx vite build 2>&1 | tail -5`

- [ ] **Step 5: 提交**

```bash
git add src/components/todo/CalendarView.tsx src/components/scene/SceneEditor.tsx src/components/binding/BindingEditor.tsx
git commit -m "feat: update calendar and modal components with theme-aware styling"
```

---

### Task 8: App 容器 + 设置页主题 UI

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/settings/ThemeSettings.tsx`
- Modify: `src/components/settings/Settings.tsx`

- [ ] **Step 1: 更新 App.tsx 容器**

```tsx
<div className="flex h-screen bg-background">
```

- [ ] **Step 2: 创建 ThemeSettings.tsx**

```tsx
import { useTheme, type AccentPreset, type ColorMode } from "../../hooks/useTheme";

const accents: { key: AccentPreset; label: string; color: string }[] = [
  { key: "indigo", label: "靛蓝", color: "#6366f1" },
  { key: "emerald", label: "翡翠", color: "#10b981" },
  { key: "rose", label: "玫瑰", color: "#f43f5e" },
  { key: "slate", label: "石板灰", color: "#475569" },
  { key: "amber", label: "琥珀", color: "#f59e0b" },
  { key: "sky", label: "天蓝", color: "#0ea5e9" },
];

const modes: { key: ColorMode; label: string }[] = [
  { key: "light", label: "浅色" },
  { key: "dark", label: "深色" },
  { key: "system", label: "跟随系统" },
];

export function ThemeSettings() {
  const { accent, mode, setAccent, setMode } = useTheme();

  return (
    <section>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">外观</h3>

      <div className="mb-4">
        <label className="text-xs text-muted-foreground mb-2 block">明暗模式</label>
        <div className="inline-flex gap-1 bg-muted rounded-lg p-0.5">
          {modes.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                mode === m.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">主题色</label>
        <div className="flex gap-2">
          {accents.map((a) => (
            <button
              key={a.key}
              onClick={() => setAccent(a.key)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                accent === a.key ? "border-foreground scale-110" : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: a.color }}
              title={a.label}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: 更新 Settings.tsx**

在 Settings 组件中引入 ThemeSettings，添加到"通用"分组上方或独立分组：

```tsx
import { ThemeSettings } from "./ThemeSettings";

// 在 return 的 JSX 中，通用设置 section 之前插入：
<ThemeSettings />
```

同时更新 Settings.tsx 的其他 className：
```tsx
// 页面标题
className="text-lg font-semibold text-foreground"

// 分组标题
className="text-sm font-medium text-muted-foreground mb-3"

// label
className="text-sm text-foreground"

// 输入框/选择器
className="... border-surface-border focus:border-theme-border rounded-lg"
```

- [ ] **Step 4: 验证**

Run: `cd d:/Project/overlay-todo && npx vite build 2>&1 | tail -5`

- [ ] **Step 5: 提交**

```bash
git add src/App.tsx src/components/settings/
git commit -m "feat: add theme settings UI and update App container styling"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] 主题色切换 (6 presets) → Task 1 CSS + Task 2 Hook + Task 8 UI
- [x] 浅色/深色模式 → Task 1 CSS + Task 2 Hook + Task 8 UI
- [x] 侧边栏视觉增强 → Task 3
- [x] 待办列表卡片化 → Task 4
- [x] Widget 毛玻璃增强 → Task 5
- [x] 统计页美化 → Task 6
- [x] 日历 + 模态框 → Task 7
- [x] 设置页主题 UI → Task 8
- [x] 语义化 CSS 变量 → Task 1

**Placeholder scan:** No TBD/TODO found. All steps have concrete code or specific commands.

**Type consistency:** `AccentPreset`, `ColorMode` types defined in Task 2, used consistently in Task 8.
