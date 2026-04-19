# Phase 2: 反馈与加载改进

**日期**: 2026-04-19
**前置**: Phase 1 完成（Toast 基础设施、shadcn/ui 组件）
**范围**: API 错误处理 + Toast 反馈、加载骨架屏、主题一致性修复

## 目标

1. 所有 API 调用添加 try/catch + Toast 错误反馈（基于 Phase 1 的 toast 工具）
2. 数据加载时显示骨架屏，消除空白闪烁
3. 修复主题一致性问题 — 消除硬编码颜色，统一暗色模式

## 一、API 错误处理补全

### 现状

Phase 1 在 hooks 中添加了 Toast 反馈，但以下位置仍有裸 API 调用无错误处理：

| 文件 | 位置 | 调用 |
|------|------|------|
| `TodoList.tsx` | `refreshSceneTodos` | `api.listTodosByScene()` |
| `TodoList.tsx` | `handleCreate` | `api.bindTodoToScene()` |
| `TodoList.tsx` | `handleAddSubTask` | `api.bindTodoToScene()` |
| `TodoItem.tsx` | `handleSaveEdit` | `api.updateTodo()` |
| `TodoDetailEditor.tsx` | `handleGroupChange`, `handleTagToggle` | `api.updateTodo()`, `api.removeTagFromTodo()`, `api.addTagToTodo()` |
| `SceneEditor.tsx` | `handleAddApp`, `handleCapture` | `api.addAppToScene()`, `api.startWindowCapture()` |
| `BindingEditor.tsx` | `handleToggle`, `handleStartCapture` | `api.bindTodoToScene()`, `api.unbindTodoFromScene()`, `api.startWindowCapture()` |
| `Widget.tsx` | `handleToggle`, `handleQuickAdd` | `updateTodo()`, `createTodo()`, `bindTodoToScene()` |
| `Settings.tsx` | `handleExport`, `confirmImport` | `api.exportData()`, `api.importData()` |
| `App.tsx` | 初始化 | `startWindowMonitor()`, `cleanupOldSessions()`, `saveWidgetOffset()` |

### 方案

在所有裸调用处添加 try/catch，使用 `notify.error()` 反馈。对于 Widget 窗口中的错误，使用 `toast.error()` 直接调用（Widget 是独立窗口，不共享主窗口的 Toaster）。

Widget 需要单独添加 `<Toaster />`（在 `widget.html` 对应的入口中）。

## 二、加载骨架屏

### 技术方案

使用 Tailwind CSS 的 `animate-pulse` 创建骨架屏组件。

### 新增组件

`src/components/ui/skeleton.tsx`:

```tsx
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
  )
}

export { Skeleton }
```

### 应用位置

| 位置 | 骨架屏样式 |
|------|-----------|
| `TodoList.tsx` loading | 3-5 行矩形条，模拟待办项高度 |
| `StatsView.tsx` loading | 4 个卡片占位 + 图表区域占位 |
| `Sidebar` 组件 loading | 每个列表 3-4 个小矩形 |
| `Widget.tsx` 加载中 | 2-3 个紧凑矩形条 |

### TodoList 骨架屏示例

```tsx
if (loading) {
  return (
    <div className="p-3 space-y-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="h-5 w-5 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

### StatsView 骨架屏示例

```tsx
if (loading) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-card rounded-xl border border-surface-border p-4">
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}
```

## 三、主题一致性修复

### 问题清单

| 问题 | 文件 | 修复 |
|------|------|------|
| 硬编码蓝色 `bg-blue-50 text-blue-700` | TodoDetailEditor, Widget | 改用 `bg-accent text-accent-foreground` 或 `bg-theme-bg text-theme` |
| 硬编码 `text-gray-400`, `text-gray-700` | Widget, Settings, StatsView | 改用 `text-muted-foreground` |
| 硬编码 `bg-white`, `bg-gray-50` | Widget | 改用 `bg-card` / `bg-background` |
| 硬编码 `text-[#1e1b4b]` | Widget | 改用 `text-foreground` |
| 硬编码 `border-gray-200` | Widget | 改用 `border-surface-border` |
| 暗色模式下 Widget 背景不正确 | Widget | `rgba(255,255,255,...)` 需根据主题色动态调整 |
| Settings 中 `<hr>` 用 `text-gray-300` | Settings | 改用 Separator 组件 |

### Widget 暗色模式适配

Widget 当前硬编码白色半透明背景。需要根据主题动态切换：

```ts
const isDark = document.documentElement.classList.contains("dark");
const bgBase = isDark ? "30, 30, 40" : "255, 255, 255";
// background: rgba(${bgBase}, ${bgAlpha})
```

文字颜色也需要适配：
```ts
const textColor = isDark ? "text-gray-200" : "text-[#1e1b4b]";
```

### 批量替换规则

- `text-gray-400` → `text-muted-foreground`
- `text-gray-700` → `text-foreground`
- `text-gray-500` → `text-muted-foreground`
- `text-gray-600` → `text-muted-foreground`
- `bg-gray-50` → `bg-accent/50`
- `border-gray-200` → `border-surface-border`
- `bg-blue-50 text-blue-700` → `bg-accent text-accent-foreground`
- `hover:bg-gray-50` → `hover:bg-accent`

## 四、文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/components/ui/skeleton.tsx` | 骨架屏组件 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/components/todo/TodoList.tsx` | 骨架屏 loading 态 |
| `src/components/stats/StatsView.tsx` | 骨架屏 loading 态 |
| `src/components/sidebar/GroupList.tsx` | 骨架屏 loading 态 |
| `src/components/sidebar/TagList.tsx` | 骨架屏 loading 态 |
| `src/components/sidebar/SceneList.tsx` | 骨架屏 loading 态 |
| `src/components/widget/Widget.tsx` | 暗色模式适配 + 骨架屏 + 错误处理 + Toaster |
| `src/components/todo/TodoItem.tsx` | 错误处理 |
| `src/components/todo/TodoDetailEditor.tsx` | 错误处理 |
| `src/components/scene/SceneEditor.tsx` | 错误处理 |
| `src/components/binding/BindingEditor.tsx` | 错误处理 |
| `src/components/settings/Settings.tsx` | 错误处理 + 主题修复 |
| `src/App.tsx` | 初始化错误处理 |
| `widget.html` 或 Widget 入口 | 添加 Toaster（如需要） |

### 不做的项

- 不添加 ErrorBoundary（后续可考虑）
- 不重构数据获取模式（保持轮询）
- 不修改 Rust 后端
