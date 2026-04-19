# Phase 3: 交互打磨

**日期**: 2026-04-19
**前置**: Phase 1 + Phase 2 完成
**范围**: 过渡动画、键盘快捷键、设置页拆分、智能轮询

## 目标

1. 为列表增删、视图切换、侧边栏折叠添加平滑过渡动画
2. 添加全局键盘快捷键支持
3. 将 Settings.tsx 拆分为独立的子组件
4. 优化轮询效率 — 窗口隐藏时暂停轮询

## 一、过渡动画

### 技术方案

使用 Tailwind CSS 内置的 `transition` + `duration` 工具类，配合条件类名实现动画。不引入额外动画库。

### 动画场景

| 场景 | 动画类型 | 实现 |
|------|----------|------|
| TodoItem 勾选完成 | 划线淡出 | `transition-all duration-300`，完成时 `line-through opacity-60` |
| TodoItem 出现/消失 | 滑入/滑出 | 使用 CSS `max-height` + `opacity` 过渡，或简单的 `animate-in fade-in` |
| 侧边栏折叠/展开 | 高度过渡 | `transition-all duration-200`，通过 `max-height` + `overflow-hidden` |
| 视图切换（列表↔日历） | 淡入淡出 | `transition-opacity duration-200` |
| 场景/分组/标签列表项 | 出现动画 | `animate-in fade-in slide-in-from-top-2 duration-200` |
| 确认弹窗/对话框 | 缩放淡入 | 已由 shadcn/ui Dialog/AlertDialog 内置 |
| Toast | 滑入滑出 | 已由 sonner 内置 |

### 新增工具类

在 `src/index.css` 中添加：

```css
/* 列表项进入动画 */
.animate-in {
  animation: animateIn 0.2s ease-out;
}
@keyframes animateIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 列表项退出动画 */
.animate-out {
  animation: animateOut 0.15s ease-in forwards;
}
@keyframes animateOut {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-4px); }
}
```

### 应用规则

- TodoItem 新增时添加 `animate-in` class
- TodoItem 删除时先添加 `animate-out`，动画结束后再移除 DOM
- 侧边栏 SectionHeader 折叠内容用 `transition-all duration-200 overflow-hidden`，通过 `max-h-0` / `max-h-[500px]` 切换
- 视图切换：包裹在 `<div className="transition-opacity duration-200">` 中

### 不做的项

- 不引入 framer-motion 或其他动画库
- 不做复杂的列表重排动画（reorder）
- 不做路由级别的页面转场（应用是 SPA，无路由）

## 二、键盘快捷键

### 技术方案

创建 `src/hooks/useKeyboardShortcuts.ts` 全局 hook，在 `App.tsx` 中注册。

### 快捷键列表

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl+N` / `Cmd+N` | 聚焦到新建待办输入框 | 聚焦 TodoForm 的 input |
| `Ctrl+F` / `Cmd+F` | 聚焦搜索框 | 聚焦 TodoList 的搜索 input |
| `Ctrl+1` | 切换到「全部」视图 | 等同于点击「全部」 |
| `Ctrl+2` | 切换到「今天」视图 | 等同于点击「今天」 |
| `Escape` | 关闭弹窗/取消编辑 | 关闭 Dialog、退出编辑模式 |
| `Ctrl+,` | 打开设置 | 等同于点击设置 |

### 实现模式

```ts
// src/hooks/useKeyboardShortcuts.ts
import { useEffect } from "react"

interface ShortcutMap {
  [key: string]: () => void
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 不在输入框中时才触发单键快捷键
      const inInput = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)

      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (ctrl && key === "n") {
        e.preventDefault()
        shortcuts["newTodo"]?.()
      } else if (ctrl && key === "f") {
        e.preventDefault()
        shortcuts["search"]?.()
      } else if (ctrl && key === "1") {
        shortcuts["viewAll"]?.()
      } else if (ctrl && key === "2") {
        shortcuts["viewToday"]?.()
      } else if (ctrl && key === ",") {
        e.preventDefault()
        shortcuts["settings"]?.()
      } else if (key === "escape") {
        shortcuts["escape"]?.()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [shortcuts])
}
```

### 集成方式

在 `App.tsx` 中：
```ts
useKeyboardShortcuts({
  newTodo: () => { /* 聚焦 TodoForm input */ },
  search: () => { /* 聚焦搜索框 */ },
  viewAll: () => handleSmartView("all"),
  viewToday: () => handleSmartView("today"),
  settings: () => setShowSettings(true),
  escape: () => { /* 关闭当前弹窗 */ },
})
```

需要通过 ref 或自定义事件与 TodoForm/TodoList 通信。

### 快捷键提示

在 About 页面中添加快捷键说明表格。

## 三、设置页拆分

### 现状

`Settings.tsx` 有 460 行，包含通用设置、Widget 设置、App 管理、导入/导出 4 个区域。

### 拆分方案

将 `Settings.tsx` 拆分为：

| 文件 | 内容 |
|------|------|
| `src/components/settings/Settings.tsx` | 容器组件，组合子组件 |
| `src/components/settings/GeneralSettings.tsx` | 开机自启、关闭行为、数据保留、备份恢复 |
| `src/components/settings/WidgetSettings.tsx` | 透明度、尺寸、空浮窗显示 |
| `src/components/settings/AppManagement.tsx` | 已关联软件列表、抓取窗口、图标管理、偏移量 |
| `src/components/settings/ThemeSettings.tsx` | 已存在，不变 |

### 共享状态

通过 props 向下传递共享状态和回调：
- `saveSettings()` — 写入 localStorage + 同步后端
- `apps`, `create`, `remove`, `refresh` — 来自 useApps hook
- `offsets`, `handleOffsetChange` — 偏移量状态

Settings.tsx 保留 hook 调用，通过 props 传递给子组件。

## 四、智能轮询

### 现状

- `useTodos.ts`: 每 3 秒轮询，即使窗口最小化
- `useTrackingStatus.ts`: 每 2 秒轮询
- `Widget.tsx`: 每 3 秒轮询
- `WindowMonitor` (Rust): 每 200ms 轮询前台窗口

### 前端优化方案

创建 `src/hooks/usePageVisibility.ts`:

```ts
import { useState, useEffect } from "react"

export function usePageVisibility() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const handler = () => setVisible(!document.hidden)
    document.addEventListener("visibilitychange", handler)
    return () => document.removeEventListener("visibilitychange", handler)
  }, [])
  return visible
}
```

在各 hooks 中使用：

```ts
// useTodos.ts
export function useTodos(filters: TodoFilters = {}) {
  const visible = usePageVisibility()
  // ...
  useEffect(() => {
    if (!visible) return // 窗口隐藏时不启动轮询
    refresh()
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [filters, refresh, visible])
  // ...
}
```

Widget 是独立窗口，不受 `document.hidden` 影响。但 Widget 只在前台应用匹配时显示，不需要特别优化。

### 后端优化（WindowMonitor）

在 `window_monitor.rs` 中添加去抖：当检测到窗口切换后，等待 500ms 确认稳定再触发事件，避免快速 Alt+Tab 创建大量短 session。

这部分的改动放在 Phase 4 后端优化中统一处理。

## 五、文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/hooks/useKeyboardShortcuts.ts` | 全局快捷键 hook |
| `src/hooks/usePageVisibility.ts` | 页面可见性 hook |
| `src/components/settings/GeneralSettings.tsx` | 通用设置子组件 |
| `src/components/settings/WidgetSettings.tsx` | Widget 设置子组件 |
| `src/components/settings/AppManagement.tsx` | App 管理子组件 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/index.css` | 添加 animate-in/out 关键帧 |
| `src/App.tsx` | 注册全局快捷键 |
| `src/components/todo/TodoItem.tsx` | 出现/消失动画 |
| `src/components/todo/TodoList.tsx` | 视图切换动画 |
| `src/components/sidebar/SectionHeader.tsx` | 折叠动画 |
| `src/components/settings/Settings.tsx` | 拆分为容器组件 |
| `src/components/settings/About.tsx` | 添加快捷键说明 |
| `src/hooks/useTodos.ts` | 智能轮询 |
| `src/hooks/useTimeStats.ts` | 智能轮询 |
