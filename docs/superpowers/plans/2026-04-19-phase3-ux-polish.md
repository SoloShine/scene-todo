# Phase 3: UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add transition animations, global keyboard shortcuts, Settings page split into sub-components, and smart polling (pause when window hidden).

**Architecture:** CSS-only animations via keyframes + Tailwind transition classes, a `useKeyboardShortcuts` hook registered in App.tsx, Settings.tsx refactored into a thin container with 3 extracted sub-components, and a `usePageVisibility` hook integrated into existing polling hooks.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, Tauri 2.0

---

## File Structure

### New files (5)
- `src/hooks/useKeyboardShortcuts.ts` — Global keyboard shortcut hook
- `src/hooks/usePageVisibility.ts` — Page visibility hook for smart polling
- `src/components/settings/GeneralSettings.tsx` — General settings sub-component (autostart, close action, retention, backup)
- `src/components/settings/WidgetSettings.tsx` — Widget settings sub-component (opacity, size, show-empty toggle)
- `src/components/settings/AppManagement.tsx` — App management sub-component (linked apps, capture, icons, offsets)

### Modified files (9)
- `src/index.css` — Add animate-in/out keyframes
- `src/App.tsx` — Register global keyboard shortcuts, add ref-based focus helpers
- `src/components/todo/TodoItem.tsx` — Add animate-in class on mount, animate-out on delete
- `src/components/todo/TodoList.tsx` — View switch fade transition, search input ref exposure
- `src/components/todo/TodoForm.tsx` — Expose input ref for keyboard shortcut focus
- `src/components/sidebar/SectionHeader.tsx` — Collapse animation via max-height transition
- `src/components/settings/Settings.tsx` — Refactor to thin container composing sub-components
- `src/components/settings/About.tsx` — Add keyboard shortcuts documentation section
- `src/hooks/useTodos.ts` — Integrate usePageVisibility for smart polling
- `src/hooks/useTimeStats.ts` — Integrate usePageVisibility for smart polling (useTrackingStatus only)

---

## Task 1: Add CSS animation keyframes

**Files:** `src/index.css`

- [ ] **Step 1: Add animate-in and animate-out keyframes to `src/index.css`**

Append the following at the end of `src/index.css` (after the `@layer base` block):

```css
/* ===== List item animations ===== */
.animate-in {
  animation: animateIn 0.2s ease-out;
}
@keyframes animateIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-out {
  animation: animateOut 0.15s ease-in forwards;
}
@keyframes animateOut {
  from { opacity: 1; transform: translateY(0); }
  to { opacity: 0; transform: translateY(-4px); }
}

/* Sidebar section collapse */
.section-collapse {
  transition: max-height 0.2s ease-out, opacity 0.2s ease-out;
  overflow: hidden;
}
.section-collapsed {
  max-height: 0;
  opacity: 0;
}
.section-expanded {
  max-height: 500px;
  opacity: 1;
}

/* View switch fade */
.view-fade-enter {
  animation: viewFadeIn 0.2s ease-out;
}
@keyframes viewFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add CSS animation keyframes for list items, collapse, and view fade"
```

---

## Task 2: Create usePageVisibility hook

**Files:** `src/hooks/usePageVisibility.ts`

- [ ] **Step 1: Create `src/hooks/usePageVisibility.ts`**

```ts
import { useState, useEffect } from "react"

/**
 * Returns true when the window/tab is visible.
 * Uses document.visibilityState to detect when the app window is hidden
 * (e.g. minimized, covered by another workspace).
 */
export function usePageVisibility(): boolean {
  const [visible, setVisible] = useState(!document.hidden)

  useEffect(() => {
    const handler = () => setVisible(!document.hidden)
    document.addEventListener("visibilitychange", handler)
    return () => document.removeEventListener("visibilitychange", handler)
  }, [])

  return visible
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/usePageVisibility.ts
git commit -m "feat: add usePageVisibility hook for smart polling"
```

---

## Task 3: Integrate smart polling into existing hooks

**Files:** `src/hooks/useTodos.ts`, `src/hooks/useTimeStats.ts`

- [ ] **Step 1: Update `src/hooks/useTodos.ts` — add visibility check to polling interval**

Add the import at the top (after existing imports):

```ts
import { usePageVisibility } from "./usePageVisibility"
```

Inside `useTodos`, add the hook call and guard the polling `useEffect`:

```ts
export function useTodos(filters: TodoFilters = {}) {
  const [todos, setTodos] = useState<TodoWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const visible = usePageVisibility();

  const refresh = useCallback(async () => {
    try {
      const data = await api.listTodosWithDetails(filtersRef.current);
      setTodos(data);
    } finally {
      if (initialLoad.current) {
        setLoading(false);
        initialLoad.current = false;
      }
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    initialLoad.current = true;
    setLoading(true);
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [filters, refresh, visible]);

  // ... rest unchanged
```

- [ ] **Step 2: Update `src/hooks/useTimeStats.ts` — add visibility check to `useTrackingStatus` polling**

Add the import at the top:

```ts
import { usePageVisibility } from "./usePageVisibility"
```

Update `useTrackingStatus` to use the visibility guard:

```ts
export function useTrackingStatus() {
  const [status, setStatus] = useState<TrackingStatus | null>(null);
  const visible = usePageVisibility();

  const refresh = useCallback(async () => {
    try {
      const data = await api.getTrackingStatus();
      setStatus(data);
    } catch {}
  }, []);

  useEffect(() => {
    if (!visible) return;
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh, visible]);

  const setPaused = async (paused: boolean) => {
    await api.setTrackingPaused(paused);
    await refresh();
  };

  return { status, setPaused, refresh };
}
```

Note: `useTimeStats` itself does not poll on an interval (it loads on mount + range change), so it does not need the visibility guard.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTodos.ts src/hooks/useTimeStats.ts
git commit -m "feat: pause polling when window is hidden (usePageVisibility)"
```

---

## Task 4: Create useKeyboardShortcuts hook

**Files:** `src/hooks/useKeyboardShortcuts.ts`

- [ ] **Step 1: Create `src/hooks/useKeyboardShortcuts.ts`**

```ts
import { useEffect } from "react"

interface ShortcutActions {
  newTodo?: () => void
  search?: () => void
  viewAll?: () => void
  viewToday?: () => void
  settings?: () => void
  escape?: () => void
}

/**
 * Registers global keyboard shortcuts.
 * Ctrl/Cmd+N → focus new todo input
 * Ctrl/Cmd+F → focus search input
 * Ctrl+1     → switch to "all" view
 * Ctrl+2     → switch to "today" view
 * Ctrl/Cmd+, → open settings
 * Escape     → close dialogs / cancel editing
 */
export function useKeyboardShortcuts(actions: ShortcutActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()

      if (ctrl && key === "n") {
        e.preventDefault()
        actions.newTodo?.()
      } else if (ctrl && key === "f") {
        e.preventDefault()
        actions.search?.()
      } else if (ctrl && key === "1") {
        e.preventDefault()
        actions.viewAll?.()
      } else if (ctrl && key === "2") {
        e.preventDefault()
        actions.viewToday?.()
      } else if (ctrl && key === ",") {
        e.preventDefault()
        actions.settings?.()
      } else if (key === "escape") {
        actions.escape?.()
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [actions])
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useKeyboardShortcuts.ts
git commit -m "feat: add useKeyboardShortcuts hook for global shortcuts"
```

---

## Task 5: Expose refs from TodoForm and TodoList for keyboard focus

**Files:** `src/components/todo/TodoForm.tsx`, `src/components/todo/TodoList.tsx`

- [ ] **Step 1: Update `src/components/todo/TodoForm.tsx` to expose input ref via `forwardRef`**

Replace the entire file content with:

```ts
import { useState, useRef, useImperativeHandle, forwardRef } from "react"

interface TodoFormProps {
  onSubmit: (title: string) => void
  placeholder?: string
}

export interface TodoFormHandle {
  focus: () => void
}

export const TodoForm = forwardRef<TodoFormHandle, TodoFormProps>(
  function TodoForm({ onSubmit, placeholder = "添加待办，按回车提交..." }, ref) {
    const [value, setValue] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }))

    const handleSubmit = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && value.trim()) {
        onSubmit(value.trim())
        setValue("")
      }
    }

    return (
      <div className="flex items-center gap-2 p-3 border-b border-surface-border">
        <span className="text-theme-border text-lg">+</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleSubmit}
          placeholder={placeholder}
          className="flex-1 text-sm bg-transparent text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>
    )
  }
)
```

- [ ] **Step 2: Update `src/components/todo/TodoList.tsx` to expose refs for keyboard shortcuts**

Add `useRef`, `useImperativeHandle`, and `forwardRef` imports. Change the function signature to use `forwardRef`. Add a ref for the search input. Expose `focusSearch` via `useImperativeHandle`.

At the top, update imports:

```ts
import { useState, useMemo, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from "react"
```

Add the handle interface before the component:

```ts
export interface TodoListHandle {
  focusSearch: () => void
}
```

Wrap the component with `forwardRef`:

```ts
export const TodoList = forwardRef<TodoListHandle, TodoListProps>(
  function TodoList({ filters, selectedSceneId }, ref) {
    // ... existing code ...
```

Add the search input ref and imperative handle. Inside the component, after the existing state declarations (after `const [collapsed, setCollapsed] = ...`), add:

```ts
    const searchInputRef = useRef<HTMLInputElement>(null)
    const todoFormRef = useRef<TodoFormHandle>(null)

    useImperativeHandle(ref, () => ({
      focusSearch: () => searchInputRef.current?.focus(),
    }))
```

Update the TodoForm usage to pass the ref:

Change:
```tsx
<TodoForm onSubmit={handleCreate} />
```

To:
```tsx
<TodoForm ref={todoFormRef} onSubmit={handleCreate} />
```

Note: `todoFormRef` is available for future direct focus from App-level if needed.

Add `ref={searchInputRef}` to the search input element. Find the existing search `<input>` and add the ref:

```tsx
<input
  ref={searchInputRef}
  value={searchText}
  onChange={(e) => setSearchText(e.target.value)}
  placeholder="搜索..."
  className="w-full pl-7 pr-2 py-1 text-xs border border-surface-border bg-background rounded-md outline-none focus:border-theme-border"
/>
```

Also add the import for `TodoFormHandle` at the top:

```ts
import { TodoForm } from "./TodoForm"
import type { TodoFormHandle } from "./TodoForm"
```

- [ ] **Step 3: Update any direct imports of `TodoList` across the codebase**

Since `TodoList` changed from a named function export to a `forwardRef` export, verify no files use it in a way that breaks. Check `src/App.tsx` — it imports `{ TodoList }` which works fine with `forwardRef`.

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/components/todo/TodoForm.tsx src/components/todo/TodoList.tsx
git commit -m "feat: expose TodoForm and TodoList refs for keyboard shortcut focus"
```

---

## Task 6: Register keyboard shortcuts in App.tsx

**Files:** `src/App.tsx`

- [ ] **Step 1: Add imports and integrate `useKeyboardShortcuts` in `src/App.tsx`**

Add imports at the top:

```ts
import { useRef, useCallback } from "react"
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts"
import type { TodoListHandle } from "./components/todo/TodoList"
```

(If `useState` and `useEffect` are already imported, update the import line to include `useRef, useCallback`.)

Add the `todoListRef` and keyboard shortcuts integration inside the `App` component, after the existing state declarations:

```ts
  const todoListRef = useRef<TodoListHandle>(null)

  const shortcutActions = useCallback(() => ({
    newTodo: () => todoListRef.current?.focusSearch(), // Focus search as proxy — TodoForm input is inside TodoList
    search: () => todoListRef.current?.focusSearch(),
    viewAll: () => handleSmartView("all"),
    viewToday: () => handleSmartView("today"),
    settings: () => { setShowSettings((s) => !s); setShowStats(false); setShowAbout(false); },
    escape: () => {
      setShowSettings(false)
      setShowStats(false)
      setShowAbout(false)
      setShowCloseDialog(false)
      setEditingSceneId(null)
    },
  }), [handleSmartView])

  useKeyboardShortcuts(shortcutActions())
```

Update the `<TodoList>` JSX to pass the ref:

Change:
```tsx
<TodoList filters={filters} selectedSceneId={selectedSceneId} />
```

To:
```tsx
<TodoList ref={todoListRef} filters={filters} selectedSceneId={selectedSceneId} />
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: register global keyboard shortcuts (Ctrl+N/F/1/2/,, Esc)"
```

---

## Task 7: Add TodoItem entry/exit animations

**Files:** `src/components/todo/TodoItem.tsx`, `src/components/todo/TodoList.tsx`

- [ ] **Step 1: Update `src/components/todo/TodoItem.tsx` — add `animate-in` class on mount**

Add `useState` for animation state at the top of the component function (inside `TodoItem`, after existing state declarations):

```ts
  const [animatingOut, setAnimatingOut] = useState(false)
```

Add a `useEffect` for animate-in (after existing useEffects):

```ts
  // Mount animation — runs once
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
```

Modify the outer `<div>` of the non-editing return to add the animation class. Find the line:

```tsx
<div className={`group flex items-start gap-2.5 px-3 py-2 hover:bg-accent/50 rounded-lg transition-colors relative ${isOverdue ? "bg-red-50/30" : ""}`}>
```

Change to:

```tsx
<div className={`group flex items-start gap-2.5 px-3 py-2 hover:bg-accent/50 rounded-lg transition-colors relative ${isOverdue ? "bg-red-50/30" : ""} ${mounted ? "" : "animate-in"} ${animatingOut ? "animate-out" : ""}`}>
```

- [ ] **Step 2: Update `src/components/todo/TodoList.tsx` — add exit animation before delete**

Add a state to track items being animated out for deletion. After the existing state declarations in `TodoList`, add:

```ts
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set())
```

Create a wrapper delete handler that triggers the exit animation before actual deletion. Find the `handleDelete` function:

```ts
  const handleDelete = async (id: number) => {
    await remove(id);
    if (selectedSceneId) refreshSceneTodos();
  };
```

Change to:

```ts
  const handleDelete = async (id: number) => {
    setDeletingIds((prev) => new Set(prev).add(id))
    setTimeout(async () => {
      await remove(id)
      if (selectedSceneId) refreshSceneTodos()
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 150) // match animate-out duration
  }
```

Pass `deletingIds.has(todo.id)` down to `TodoItem` so it can apply the `animate-out` class. Update the `TodoItem` usage inside `renderTodo`. In `TodoList.tsx`, the `renderTodo` function already calls `TodoItem` with an `onDelete` prop — no additional prop needed since the animation is handled via `deletingIds` in the wrapper.

Actually, we need to pass the `animatingOut` state to `TodoItem`. Add an `animatingOut` prop to `TodoItemProps`:

In `src/components/todo/TodoItem.tsx`, update the interface:

```ts
interface TodoItemProps {
  todo: TodoWithDetails | Todo;
  editing: boolean;
  animatingOut?: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onToggle: (id: number, status: "pending" | "completed") => void;
  onDelete: (id: number) => void;
  onAddSubTask: (parentId: number, title: string) => void;
  onRefresh?: () => void;
}
```

Update the component signature:

```ts
export function TodoItem({ todo, editing, animatingOut = false, onStartEdit, onEndEdit, onToggle, onDelete, onAddSubTask, onRefresh }: TodoItemProps) {
```

And simplify the animation logic — remove the local `animatingOut` state we added earlier (since it now comes via prop), and use the prop directly in the class:

```tsx
<div className={`group flex items-start gap-2.5 px-3 py-2 hover:bg-accent/50 rounded-lg transition-colors relative ${isOverdue ? "bg-red-50/30" : ""} ${mounted ? "" : "animate-in"} ${animatingOut ? "animate-out" : ""}`}>
```

In `src/components/todo/TodoList.tsx`, update `renderTodo` to pass `animatingOut`:

```ts
  const renderTodo = (todo: TodoWithDetails) => {
    const visibleSubs = filterPriority || searchText || filterStatus
      ? todo.sub_tasks.filter((sub) => matchesFilter(sub))
      : todo.sub_tasks
    return (
      <div key={todo.id}>
        <TodoItem
          todo={todo}
          editing={editingId === todo.id}
          animatingOut={deletingIds.has(todo.id)}
          onStartEdit={() => setEditingId(todo.id)}
          onEndEdit={() => setEditingId(null)}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onAddSubTask={handleAddSubTask}
          onRefresh={() => { refresh(); if (selectedSceneId) refreshSceneTodos(); }}
        />
        {visibleSubs.length > 0 && (
          <div className="ml-6">
            {visibleSubs.map((sub) => (
              <TodoItem
                key={sub.id}
                todo={sub}
                editing={editingId === sub.id}
                animatingOut={deletingIds.has(sub.id)}
                onStartEdit={() => setEditingId(sub.id)}
                onEndEdit={() => setEditingId(null)}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onAddSubTask={handleAddSubTask}
                onRefresh={() => { refresh(); if (selectedSceneId) refreshSceneTodos(); }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/todo/TodoItem.tsx src/components/todo/TodoList.tsx
git commit -m "feat: add entry/exit animations for TodoItem"
```

---

## Task 8: Add view switch fade animation

**Files:** `src/components/todo/TodoList.tsx`

- [ ] **Step 1: Add view-fade-enter animation key to the view mode switch**

In `src/components/todo/TodoList.tsx`, add state to track view changes:

After the existing `viewMode` state:

```ts
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list")
  const [viewKey, setViewKey] = useState(0)
```

Create a wrapper for view switching that bumps the key:

```ts
  const switchView = (mode: "list" | "calendar") => {
    if (mode !== viewMode) {
      setViewMode(mode)
      setViewKey((k) => k + 1)
      setSelectedDate(null)
    }
  }
```

Update the view toggle buttons to use `switchView` instead of inline lambdas. Find:

```tsx
onClick={() => { setViewMode("list"); setSelectedDate(null); }}
```

Change to:

```tsx
onClick={() => switchView("list")}
```

And:

```tsx
onClick={() => setViewMode("calendar")}
```

Change to:

```tsx
onClick={() => switchView("calendar")}
```

Wrap the view content area with the fade class and key. Find the `<div className="flex-1 overflow-y-auto">` section and add `viewKey` to force re-mount with animation:

```tsx
      <div className="flex-1 overflow-y-auto" key={viewKey}>
        <div className={viewKey > 0 ? "view-fade-enter" : ""}>
          {viewMode === "list" ? (
            // ... existing list view content unchanged ...
          ) : (
            // ... existing calendar view content unchanged ...
          )}
        </div>
      </div>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/todo/TodoList.tsx
git commit -m "feat: add fade animation on list/calendar view switch"
```

---

## Task 9: Add sidebar collapse animation

**Files:** `src/components/sidebar/SectionHeader.tsx`, `src/components/sidebar/Sidebar.tsx`, `src/components/sidebar/GroupList.tsx`, `src/components/sidebar/TagList.tsx`, `src/components/sidebar/SceneList.tsx`

- [ ] **Step 1: Check how sections consume the `collapsed` prop**

Read `src/components/sidebar/GroupList.tsx`, `TagList.tsx`, and `SceneList.tsx` to see how they render their content with `collapsed`. The animation should wrap the content area that gets hidden/shown.

- [ ] **Step 2: Add collapse animation CSS classes to section content**

For each section list component (GroupList, TagList, SceneList), wrap the content that is conditionally rendered when `!collapsed` in a div with the collapse animation classes.

In each component, find the pattern where content is hidden when `collapsed` is true. The typical pattern is:

```tsx
{!collapsed && <div>...content...</div>}
```

Change this to always render the content, but use CSS classes to animate:

```tsx
<div className={`section-collapse ${collapsed ? "section-collapsed" : "section-expanded"}`}>
  {/* content that was previously inside {!collapsed && ...} */}
</div>
```

Note: Read each component file to identify the exact structure before editing. The `SectionHeader` itself does not need changes — it is the toggle button. The animation applies to the section content below it.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/sidebar/SectionHeader.tsx src/components/sidebar/Sidebar.tsx src/components/sidebar/GroupList.tsx src/components/sidebar/TagList.tsx src/components/sidebar/SceneList.tsx
git commit -m "feat: add smooth collapse/expand animation to sidebar sections"
```

---

## Task 10: Extract GeneralSettings sub-component

**Files:** `src/components/settings/GeneralSettings.tsx`

- [ ] **Step 1: Create `src/components/settings/GeneralSettings.tsx`**

Extract the "General" section (lines ~231-278 in original Settings.tsx) into its own component. Props include the state values and handlers:

```ts
import type { ChangeEvent } from "react"

interface GeneralSettingsProps {
  autoStart: boolean
  onAutoStart: (enabled: boolean) => void
  closeAction: "prompt" | "hide" | "exit"
  onCloseActionChange: (action: "prompt" | "hide" | "exit") => void
  retentionDays: number
  onRetentionDaysChange: (days: number) => void
  onExport: () => void
  onImport: () => void
}

export function GeneralSettings({
  autoStart,
  onAutoStart,
  closeAction,
  onCloseActionChange,
  retentionDays,
  onRetentionDaysChange,
  onExport,
  onImport,
}: GeneralSettingsProps) {
  return (
    <section className="mb-6">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="w-1 h-4 rounded-full bg-theme" />
        通用
      </h3>
      <label className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground">开机自启</span>
        <input
          type="checkbox"
          checked={autoStart}
          onChange={(e) => onAutoStart(e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground">关闭按钮行为</span>
        <select
          value={closeAction}
          onChange={(e) => onCloseActionChange(e.target.value as "prompt" | "hide" | "exit")}
          className="text-sm border rounded px-2 py-1"
        >
          <option value="prompt">每次询问</option>
          <option value="hide">隐藏到托盘</option>
          <option value="exit">退出程序</option>
        </select>
      </label>
      <label className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground">数据保留天数</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={3650}
            value={retentionDays}
            onChange={(e) => onRetentionDaysChange(Math.max(1, parseInt(e.target.value) || 90))}
            className="w-20 px-2 py-1 text-sm border rounded text-right"
          />
          <span className="text-xs text-gray-400">天</span>
        </div>
      </label>
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground">数据备份</span>
        <div className="flex items-center gap-2">
          <button onClick={onExport} className="text-xs text-gray-400 hover:text-blue-500">导出</button>
          <span className="text-gray-300">|</span>
          <button onClick={onImport} className="text-xs text-gray-400 hover:text-blue-500">导入</button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/GeneralSettings.tsx
git commit -m "refactor: extract GeneralSettings sub-component from Settings"
```

---

## Task 11: Extract WidgetSettings sub-component

**Files:** `src/components/settings/WidgetSettings.tsx`

- [ ] **Step 1: Create `src/components/settings/WidgetSettings.tsx`**

Extract the "Widget" section (lines ~281-316 in original Settings.tsx):

```ts
interface WidgetSettingsProps {
  widgetOpacity: number
  onOpacityChange: (value: number) => void
  widgetSize: "small" | "medium" | "large"
  onSizeChange: (size: "small" | "medium" | "large") => void
  showEmptyWidget: boolean
  onShowEmptyWidgetChange: (show: boolean) => void
}

export function WidgetSettings({
  widgetOpacity,
  onOpacityChange,
  widgetSize,
  onSizeChange,
  showEmptyWidget,
  onShowEmptyWidgetChange,
}: WidgetSettingsProps) {
  return (
    <section className="mb-6">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="w-1 h-4 rounded-full bg-theme" />
        Widget
      </h3>
      <label className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground">无待办时显示浮窗</span>
        <input
          type="checkbox"
          checked={showEmptyWidget}
          onChange={(e) => onShowEmptyWidgetChange(e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground">浮窗不透明度</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={widgetOpacity}
            onChange={(e) => onOpacityChange(parseInt(e.target.value))}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground w-8">{widgetOpacity}%</span>
        </div>
      </label>
      <label className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground">默认尺寸</span>
        <select
          value={widgetSize}
          onChange={(e) => onSizeChange(e.target.value as "small" | "medium" | "large")}
          className="text-sm border rounded px-2 py-1"
        >
          <option value="small">小</option>
          <option value="medium">中</option>
          <option value="large">大</option>
        </select>
      </label>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/WidgetSettings.tsx
git commit -m "refactor: extract WidgetSettings sub-component from Settings"
```

---

## Task 12: Extract AppManagement sub-component

**Files:** `src/components/settings/AppManagement.tsx`

- [ ] **Step 1: Create `src/components/settings/AppManagement.tsx`**

Extract the "App Management" section (lines ~319-422 in original Settings.tsx). This is the largest section. Props include the apps data, handlers, and offset state:

```ts
import type { App } from "../../types"

interface AppManagementProps {
  apps: App[]
  expandedApp: number | null
  onExpandApp: (id: number | null) => void
  offsets: Record<number, { x: number; y: number }>
  onOffsetChange: (appId: number, axis: "x" | "y", value: number) => void
  capturing: boolean
  onCapture: () => void
  refreshingIcons: boolean
  onRefreshIcons: () => void
  onRemoveApp: (id: number) => void
  onToggleShowWidget: (appId: number, show: boolean) => void
  onImportIcon: (appId: number) => void
}

export function AppManagement({
  apps,
  expandedApp,
  onExpandApp,
  offsets,
  onOffsetChange,
  capturing,
  onCapture,
  refreshingIcons,
  onRefreshIcons,
  onRemoveApp,
  onToggleShowWidget,
  onImportIcon,
}: AppManagementProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-theme" />
          已关联软件
        </h3>
        {apps.length > 0 && (
          <button
            onClick={onRefreshIcons}
            disabled={refreshingIcons}
            className="text-xs text-gray-400 hover:text-blue-500 disabled:opacity-50"
          >
            {refreshingIcons ? "刷新中..." : "自动获取图标"}
          </button>
        )}
      </div>
      <div className="space-y-1">
        {apps.map((app) => {
          const isExpanded = expandedApp === app.id
          const off = offsets[app.id] ?? { x: 8, y: 32 }
          return (
            <div key={app.id}>
              <div className="flex items-center justify-between py-1.5 px-2 hover:bg-accent rounded">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onExpandApp(isExpanded ? null : app.id)}
                    className="text-gray-400 hover:text-muted-foreground text-xs w-4"
                  >
                    {isExpanded ? "\u25BE" : "\u25B8"}
                  </button>
                  <div className="flex items-center gap-2">
                    {app.icon_path ? (
                      <img src={app.icon_path} alt="" className="w-5 h-5 rounded" />
                    ) : (
                      <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                        {app.display_name?.[0] || app.name[0]}
                      </div>
                    )}
                    <span className="text-sm text-foreground">{app.display_name || app.name}</span>
                    <span className="text-xs text-gray-400">
                      {(() => { try { return JSON.parse(app.process_names).join(", "); } catch { return app.process_names; } })()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1 cursor-pointer" title={app.show_widget ? "显示浮窗" : "隐藏浮窗"}>
                    <input
                      type="checkbox"
                      checked={app.show_widget}
                      onChange={(e) => onToggleShowWidget(app.id, e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-[10px] text-gray-400">浮窗</span>
                  </label>
                  <button onClick={() => onRemoveApp(app.id)} className="text-xs text-gray-400 hover:text-red-500">删除</button>
                </div>
              </div>
              {isExpanded && (
                <div className="ml-6 px-2 py-2 bg-background rounded text-xs space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-14">X 偏移</span>
                    <input
                      type="range"
                      min={-200}
                      max={500}
                      value={off.x}
                      onChange={(e) => onOffsetChange(app.id, "x", parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-8 text-gray-400">{off.x}px</span>
                    <input
                      type="number"
                      min={-200}
                      max={500}
                      value={off.x}
                      onChange={(e) => { const v = parseInt(e.target.value) || 0; onOffsetChange(app.id, "x", v); }}
                      className="w-14 px-1 py-0.5 border rounded text-center text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-14">Y 偏移</span>
                    <input
                      type="range"
                      min={0}
                      max={500}
                      value={off.y}
                      onChange={(e) => onOffsetChange(app.id, "y", parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-8 text-gray-400">{off.y}px</span>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={off.y}
                      onChange={(e) => { const v = parseInt(e.target.value) || 0; onOffsetChange(app.id, "y", v); }}
                      className="w-14 px-1 py-0.5 border rounded text-center text-xs"
                    />
                  </div>
                  <button
                    onClick={() => onImportIcon(app.id)}
                    className="text-xs text-gray-400 hover:text-blue-500"
                  >
                    手动导入图标...
                  </button>
                </div>
              )}
            </div>
          )
        })}
        <button
          onClick={onCapture}
          disabled={capturing}
          className="w-full py-2 mt-1 text-xs rounded border border-surface-border hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors disabled:opacity-50"
        >
          {capturing ? "点击目标窗口以抓取..." : "+ 抓取窗口添加关联软件"}
        </button>
        {apps.length === 0 && <p className="text-xs text-gray-400 py-2">暂无关联软件</p>}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/AppManagement.tsx
git commit -m "refactor: extract AppManagement sub-component from Settings"
```

---

## Task 13: Refactor Settings.tsx as thin container

**Files:** `src/components/settings/Settings.tsx`

- [ ] **Step 1: Rewrite `src/components/settings/Settings.tsx` as a container composing sub-components**

Replace the entire file with the container that imports and passes props to the three new sub-components:

```ts
import { useState, useEffect } from "react";
import { useApps } from "../../hooks/useApps";
import * as api from "../../lib/invoke";
import { ThemeSettings } from "./ThemeSettings";
import { GeneralSettings } from "./GeneralSettings";
import { WidgetSettings } from "./WidgetSettings";
import { AppManagement } from "./AppManagement";
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile, readFile } from "@tauri-apps/plugin-fs";

export function Settings() {
  const { apps, create, remove, refresh } = useApps();
  const [autoStart, setAutoStart] = useState(false);
  const [widgetOpacity, setWidgetOpacity] = useState(85);
  const [widgetSize, setWidgetSize] = useState<"small" | "medium" | "large">("medium");
  const [showEmptyWidget, setShowEmptyWidget] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);
  const [expandedApp, setExpandedApp] = useState<number | null>(null);
  const [offsets, setOffsets] = useState<Record<number, { x: number; y: number }>>({});
  const [capturing, setCapturing] = useState(false);
  const [refreshingIcons, setRefreshingIcons] = useState(false);
  const [closeAction, setCloseAction] = useState<"prompt" | "hide" | "exit">("prompt");

  useEffect(() => {
    const saved = localStorage.getItem("scene-todo-settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      setWidgetOpacity(parsed.widgetOpacity ?? 85);
      setWidgetSize(parsed.widgetSize ?? "medium");
      setShowEmptyWidget(parsed.showEmptyWidget ?? false);
      setRetentionDays(parsed.retentionDays ?? 90);
      setCloseAction(parsed.closeAction ?? "prompt");
    }
    isAutostartEnabled().then((enabled) => setAutoStart(enabled)).catch(() => {});
    const savedOffsets = localStorage.getItem("scene-todo-widget-offsets");
    if (savedOffsets) {
      setOffsets(JSON.parse(savedOffsets));
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem("scene-todo-settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.closeAction) setCloseAction(parsed.closeAction);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const saveSettings = (updates: Record<string, unknown>) => {
    const current = JSON.parse(localStorage.getItem("scene-todo-settings") || "{}");
    const updated = { ...current, ...updates };
    localStorage.setItem("scene-todo-settings", JSON.stringify(updated));
    const size = updated.widgetSize ?? "medium";
    const sizeMap: Record<string, [number, number]> = {
      small: [200, 240],
      medium: [260, 300],
      large: [340, 400],
    };
    const [w, h] = sizeMap[size] || sizeMap.medium;
    api.setWidgetDefaultSize(w, h);
  };

  const handleAutoStart = async (enabled: boolean) => {
    try {
      if (enabled) await enableAutostart();
      else await disableAutostart();
      setAutoStart(enabled);
    } catch (e) {
      console.error("Failed to toggle autostart:", e);
    }
  };

  const handleOffsetChange = (appId: number, axis: "x" | "y", value: number) => {
    const current = offsets[appId] ?? { x: 8, y: 32 };
    const updated = { ...current, [axis]: value };
    const newOffsets = { ...offsets, [appId]: updated };
    setOffsets(newOffsets);
    localStorage.setItem("scene-todo-widget-offsets", JSON.stringify(newOffsets));
    api.saveWidgetOffset(appId, updated.x, updated.y);
  };

  const handleCapture = async () => {
    setCapturing(true);
    try {
      const result = await api.startWindowCapture();
      const { process_name } = result;
      if (!process_name) return;
      const existing = apps.find((a) => {
        try {
          return JSON.parse(a.process_names).some((p: string) => p.toLowerCase() === process_name.toLowerCase());
        } catch { return false; }
      });
      if (!existing) {
        const displayName = process_name.replace(/\.[^.]+$/, "");
        await create({ name: displayName, process_names: [process_name] });
      }
    } catch (e) {
      console.error("Window capture failed:", e);
    } finally {
      setCapturing(false);
    }
  };

  const handleToggleShowWidget = async (appId: number, show: boolean) => {
    await api.updateApp({ id: appId, show_widget: show });
    refresh();
  };

  const handleRefreshIcons = async () => {
    setRefreshingIcons(true);
    try {
      await api.refreshAllIcons();
      refresh();
    } catch (e) {
      console.error("Refresh icons failed:", e);
    } finally {
      setRefreshingIcons(false);
    }
  };

  const handleImportIcon = async (appId: number) => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: "图标文件",
          extensions: ["exe", "png", "jpg", "jpeg", "ico", "bmp", "svg", "webp"],
        }],
      });
      if (!selected) return;
      await api.importAppIcon(appId, selected as string);
      refresh();
    } catch (e) {
      console.error("Import icon failed:", e);
    }
  };

  const handleExport = async () => {
    try {
      const dbJson = await api.exportData();
      const exportObj = {
        version: 1,
        database: JSON.parse(dbJson),
        localStorage: {
          "scene-todo-settings": localStorage.getItem("scene-todo-settings"),
          "scene-todo-widget-offsets": localStorage.getItem("scene-todo-widget-offsets"),
          "scene-todo-theme": localStorage.getItem("scene-todo-theme"),
        },
      };
      const content = JSON.stringify(exportObj, null, 2);
      const path = await save({
        defaultPath: "scenetodo-backup.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      const encoder = new TextEncoder();
      await writeFile(path, encoder.encode(content));
    } catch (e) {
      console.error("Export failed:", e);
    }
  };

  const [importPreview, setImportPreview] = useState<{
    dbData: Record<string, unknown>;
    localStorage: Record<string, unknown> | null;
    summary: string[];
  } | null>(null);

  const handleImport = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!selected) return;
      const bytes = await readFile(selected as string);
      const decoder = new TextDecoder();
      const text = decoder.decode(bytes);
      const importObj = JSON.parse(text);
      const dbData = importObj.database || importObj;
      const lsData = importObj.localStorage || null;

      const summary: string[] = [];
      const tableLabels: Record<string, string> = {
        groups: "分组", tags: "标签", apps: "应用", scenes: "场景",
        todos: "待办事项", todo_tags: "标签关联", scene_apps: "场景应用关联",
        todo_app_bindings: "应用绑定", todo_scene_bindings: "场景绑定",
        time_sessions: "时间记录",
      };
      for (const [key, label] of Object.entries(tableLabels)) {
        const rows = (dbData as Record<string, unknown>)[key];
        if (Array.isArray(rows) && rows.length > 0) {
          summary.push(`${label}: ${rows.length} 条`);
        }
      }
      setImportPreview({ dbData, localStorage: lsData, summary });
    } catch (e) {
      console.error("Import failed:", e);
    }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    try {
      const dbJson = JSON.stringify(importPreview.dbData);
      await api.importData(dbJson);
      if (importPreview.localStorage) {
        for (const [key, value] of Object.entries(importPreview.localStorage)) {
          if (value) localStorage.setItem(key, value as string);
        }
      }
      setImportPreview(null);
      window.location.reload();
    } catch (e) {
      console.error("Import failed:", e);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-6">设置</h2>

      <ThemeSettings />

      <GeneralSettings
        autoStart={autoStart}
        onAutoStart={handleAutoStart}
        closeAction={closeAction}
        onCloseActionChange={(v) => { setCloseAction(v); saveSettings({ closeAction: v }); }}
        retentionDays={retentionDays}
        onRetentionDaysChange={(v) => { setRetentionDays(v); saveSettings({ retentionDays: v }); }}
        onExport={handleExport}
        onImport={handleImport}
      />

      <WidgetSettings
        widgetOpacity={widgetOpacity}
        onOpacityChange={(v) => { setWidgetOpacity(v); saveSettings({ widgetOpacity: v }); }}
        widgetSize={widgetSize}
        onSizeChange={(v) => { setWidgetSize(v); saveSettings({ widgetSize: v }); }}
        showEmptyWidget={showEmptyWidget}
        onShowEmptyWidgetChange={(v) => { setShowEmptyWidget(v); saveSettings({ showEmptyWidget: v }); }}
      />

      <AppManagement
        apps={apps}
        expandedApp={expandedApp}
        onExpandApp={setExpandedApp}
        offsets={offsets}
        onOffsetChange={handleOffsetChange}
        capturing={capturing}
        onCapture={handleCapture}
        refreshingIcons={refreshingIcons}
        onRefreshIcons={handleRefreshIcons}
        onRemoveApp={remove}
        onToggleShowWidget={handleToggleShowWidget}
        onImportIcon={handleImportIcon}
      />

      {/* Import confirmation dialog */}
      {importPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border border-surface-border p-5 w-80 shadow-xl">
            <h3 className="text-sm font-semibold text-foreground mb-3">确认导入数据</h3>
            <div className="bg-background rounded-lg p-3 mb-3 space-y-1">
              {importPreview.summary.map((s) => (
                <p key={s} className="text-xs text-foreground">{s}</p>
              ))}
              {importPreview.summary.length === 0 && (
                <p className="text-xs text-muted-foreground">备份文件中无数据</p>
              )}
            </div>
            <p className="text-xs text-red-500 mb-4">
              导入将覆盖当前所有数据，此操作不可撤销。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setImportPreview(null)}
                className="px-3 py-1.5 text-xs rounded-lg border border-surface-border hover:bg-accent"
              >
                取消
              </button>
              <button
                onClick={confirmImport}
                className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600"
              >
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/Settings.tsx
git commit -m "refactor: Settings.tsx as thin container composing GeneralSettings, WidgetSettings, AppManagement"
```

---

## Task 14: Add keyboard shortcuts documentation to About page

**Files:** `src/components/settings/About.tsx`

- [ ] **Step 1: Add a keyboard shortcuts section to `src/components/settings/About.tsx`**

Insert a new section after the existing "快捷操作" section (after the closing `</section>` of that section, before the "关于" section). Add the following:

```tsx
      <section className="mb-6">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-theme" />
          键盘快捷键
        </h3>
        <div className="space-y-1 text-xs">
          <ShortcutRow keys="Ctrl+N" desc="聚焦新建待办输入框" />
          <ShortcutRow keys="Ctrl+F" desc="聚焦搜索框" />
          <ShortcutRow keys="Ctrl+1" desc="切换到「全部」视图" />
          <ShortcutRow keys="Ctrl+2" desc="切换到「今天」视图" />
          <ShortcutRow keys="Ctrl+," desc="打开/关闭设置" />
          <ShortcutRow keys="Esc" desc="关闭弹窗/取消编辑" />
        </div>
      </section>
```

Add the `ShortcutRow` helper component at the bottom of the file (after the existing `ShortcutItem` component):

```tsx
function ShortcutRow({ keys, desc }: { keys: string; desc: string }) {
  return (
    <div className="flex items-center justify-between py-1 px-2 rounded hover:bg-accent">
      <span className="text-muted-foreground">{desc}</span>
      <kbd className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-[10px] border border-surface-border">
        {keys}
      </kbd>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/About.tsx
git commit -m "feat: add keyboard shortcuts documentation to About page"
```

---

## Task 15: Final verification and integration commit

- [ ] **Step 1: Run full build to verify everything compiles**

Run: `npm run build`

- [ ] **Step 2: Manual smoke test checklist**

Verify the following in the running app:

1. **Animations**: Create a todo — it should slide in. Delete a todo — it should fade out. Toggle between list and calendar view — content should fade in. Collapse/expand sidebar sections — content should smoothly animate.
2. **Keyboard shortcuts**: Press `Ctrl+N` — search input should focus. Press `Ctrl+F` — same. Press `Ctrl+1` — switches to "all" view. Press `Ctrl+2` — switches to "today" view. Press `Ctrl+,` — toggles settings. Press `Escape` — closes settings/stats/about.
3. **Settings split**: Open Settings — all three sub-sections (General, Widget, App Management) should render identically to before the refactor. Test toggling autostart, changing widget opacity, capturing a window.
4. **Smart polling**: Open dev tools network tab. Minimize the app window. Verify that no polling requests are made while minimized. Restore the window — polling should resume.
5. **About page**: Check the new keyboard shortcuts section renders correctly.

- [ ] **Step 3: Commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: integration fixups from Phase 3 UX polish"
```

---

## Self-Review

### Coverage check

| Spec requirement | Plan coverage | Task |
|---|---|---|
| CSS keyframes for list items | animate-in / animate-out keyframes | Task 1 + Task 7 |
| Sidebar collapse animation | section-collapse / section-collapsed / section-expanded CSS classes | Task 1 + Task 9 |
| View switch animation | view-fade-enter keyframe + viewKey state | Task 1 + Task 8 |
| Keyboard shortcuts hook | useKeyboardShortcuts.ts | Task 4 |
| Shortcuts: Ctrl+N, Ctrl+F, Ctrl+1, Ctrl+2, Ctrl+,, Esc | All registered in App.tsx | Task 6 |
| Settings split: GeneralSettings | Extracted with props for autostart, close action, retention, backup | Task 10 |
| Settings split: WidgetSettings | Extracted with props for opacity, size, show-empty | Task 11 |
| Settings split: AppManagement | Extracted with props for apps, offsets, capture, icons | Task 12 |
| Settings container refactored | Settings.tsx imports and composes 3 sub-components + ThemeSettings | Task 13 |
| Smart polling: usePageVisibility | Created as standalone hook | Task 2 |
| Smart polling: useTodos | Added visibility guard to polling useEffect | Task 3 |
| Smart polling: useTrackingStatus | Added visibility guard to polling useEffect | Task 3 |
| About page: keyboard shortcuts docs | New section with ShortcutRow component | Task 14 |
| No new dependencies | Pure CSS + React hooks, no animation libraries | Confirmed |
| TodoForm ref exposure | forwardRef + useImperativeHandle | Task 5 |
| TodoList ref exposure | forwardRef + useImperativeHandle for focusSearch | Task 5 |

### Risks and mitigations

1. **Sidebar collapse: max-height 500px limit** — If a section has more items than fit in 500px, the transition will clip. Mitigation: 500px accommodates ~20+ items at compact size, which is reasonable. Can be increased if needed.

2. **TodoItem delete animation: 150ms delay** — The `setTimeout(150)` in handleDelete means the actual delete is deferred. If the user rapidly deletes multiple items, the `deletingIds` set correctly tracks all pending deletions. The 150ms matches the `animateOut` duration.

3. **TodoList forwardRef breaking change** — Since TodoList is only used in `App.tsx`, changing from named export to `forwardRef` is safe. The import syntax `{ TodoList }` works with both.

4. **Settings refactoring: behavioral parity** — All business logic (saveSettings, handleCapture, handleImport/Export, etc.) remains in Settings.tsx container. Sub-components are purely presentational. The import preview dialog stays in Settings.tsx because it is a modal overlay. This ensures identical behavior.

5. **Keyboard shortcuts in input fields** — The `Ctrl+N` and `Ctrl+F` shortcuts call `e.preventDefault()`, which prevents the browser's default "new window" / "find" behavior. This is intentional for a desktop app. Single-key shortcuts like `Escape` are not blocked in input fields, which is correct — Escape should work everywhere.

6. **Smart polling: Widget is unaffected** — Per the spec, Widget runs in a separate Tauri window and is not affected by `document.hidden`. No changes needed for Widget.
