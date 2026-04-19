# Phase 2: Feedback & Loading Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add error handling + toast feedback to all bare API calls, implement skeleton loading states, and fix theme consistency (hardcoded colors -> CSS variables, Widget dark mode).

**Architecture:** Three independent workstreams: (A) wrap every bare API call in try/catch with `notify.error()`, (B) create a Skeleton component and apply it to all loading states, (C) replace hardcoded colors with semantic CSS variable tokens and fix Widget dark mode. Changes are additive and non-breaking.

**Tech Stack:** React 18, sonner (already installed), Tailwind CSS v4, shadcn/ui v4

**Prerequisite:** Phase 1 complete -- `src/lib/toast.ts` exports `notify`, `<Toaster />` is in `App.tsx`, ConfirmDialog and EmptyState components exist.

**Verification:** No test framework. Run `npm run build` after each task to verify no type errors.

---

## File Structure

### New files (1)
- `src/components/ui/skeleton.tsx` -- Skeleton loading component using `animate-pulse`

### Modified files (12)
- `src/components/todo/TodoList.tsx` -- skeleton loading + error handling for `refreshSceneTodos`, `handleCreate`, `handleAddSubTask`
- `src/components/todo/TodoItem.tsx` -- error handling for `handleSaveEdit`
- `src/components/todo/TodoDetailEditor.tsx` -- error handling for `handleGroupChange`, `handleTagToggle`, `useEffect` fetch + theme fix (`bg-blue-50 text-blue-700` -> `bg-accent text-accent-foreground`)
- `src/components/scene/SceneEditor.tsx` -- error handling for `handleAddApp`, `handleRemoveApp`, `handleCapture`
- `src/components/binding/BindingEditor.tsx` -- error handling for `handleToggle`, `handleStartCapture`
- `src/components/widget/Widget.tsx` -- dark mode fix + skeleton + error handling for `handleToggle`, `handleQuickAdd`
- `src/components/widget/WidgetTodoItem.tsx` -- theme fix (`text-gray-400`, `text-[#1e1b4b]` -> semantic tokens)
- `src/components/stats/StatsView.tsx` -- skeleton loading
- `src/components/settings/Settings.tsx` -- error handling for `handleExport`, `confirmImport`, theme fixes
- `src/components/sidebar/GroupList.tsx` -- skeleton loading
- `src/components/sidebar/TagList.tsx` -- skeleton loading
- `src/components/sidebar/SceneList.tsx` -- skeleton loading
- `src/widget-entry.tsx` -- add `<Toaster />` for Widget window
- `src/App.tsx` -- error handling for init calls

### Files NOT changed
- Hooks (`useTodos`, `useGroups`, etc.) -- already have try/catch with toast in Phase 1
- Rust backend -- no changes
- No ErrorBoundary added (deferred)

---

## Task 1: Create Skeleton component

**Files:**
- Create: `src/components/ui/skeleton.tsx`

- [ ] **Step 1: Create the Skeleton component**

Create `src/components/ui/skeleton.tsx`:

```tsx
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/skeleton.tsx
git commit -m "feat: add Skeleton component for loading states"
```

---

## Task 2: Add skeleton loading to TodoList

**Files:**
- Modify: `src/components/todo/TodoList.tsx`

- [ ] **Step 1: Add Skeleton import and replace loading placeholder**

In `src/components/todo/TodoList.tsx`, add the import at the top:

```tsx
import { Skeleton } from "../ui/skeleton";
```

Replace the current loading block (lines 144-146):

```tsx
  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">加载中...</div>;
  }
```

With:

```tsx
  if (loading) {
    return (
      <div className="p-3 space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="h-5 w-5 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
```

- [ ] **Step 2: Add error handling to `refreshSceneTodos`**

Replace the `refreshSceneTodos` function (lines 60-67):

```tsx
  const refreshSceneTodos = useCallback(async () => {
    if (selectedSceneId) {
      try {
        const data = await api.listTodosByScene(selectedSceneId);
        setSceneTodos(data);
      } catch {
        notify.error("加载场景待办失败");
      }
    } else {
      setSceneTodos([]);
    }
  }, [selectedSceneId]);
```

Add the `notify` import at the top (alongside existing imports):

```tsx
import { notify } from "../../lib/toast";
```

- [ ] **Step 3: Add error handling to `handleCreate`**

Replace the `handleCreate` function (lines 90-96):

```tsx
  const handleCreate = async (title: string) => {
    try {
      const todo = await create({ title, due_date: localTodayKey() + "T23:59" });
      if (selectedSceneId) {
        await api.bindTodoToScene(todo.id, selectedSceneId);
        refreshSceneTodos();
      }
    } catch {
      notify.error("创建待办失败");
    }
  };
```

- [ ] **Step 4: Add error handling to `handleAddSubTask`**

Replace the `handleAddSubTask` function (lines 98-104):

```tsx
  const handleAddSubTask = async (parentId: number, title: string) => {
    try {
      const todo = await create({ title, parent_id: parentId, due_date: localTodayKey() + "T23:59" });
      if (selectedSceneId) {
        await api.bindTodoToScene(todo.id, selectedSceneId);
        refreshSceneTodos();
      }
    } catch {
      notify.error("添加子任务失败");
    }
  };
```

- [ ] **Step 5: Verify build**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/components/todo/TodoList.tsx
git commit -m "feat: add skeleton loading and error handling to TodoList"
```

---

## Task 3: Add error handling to TodoItem

**Files:**
- Modify: `src/components/todo/TodoItem.tsx`

- [ ] **Step 1: Add notify import**

Add at the top of `src/components/todo/TodoItem.tsx`:

```tsx
import { notify } from "../../lib/toast";
```

- [ ] **Step 2: Wrap `handleSaveEdit` in try/catch**

Replace the `handleSaveEdit` function (lines 108-127):

```tsx
  const handleSaveEdit = async () => {
    if (!editTitle.trim()) { onEndEdit(); return; }
    const titleChanged = editTitle.trim() !== todo.title;
    const descChanged = (editDesc.trim() || "") !== (todo.description || "");
    const prioChanged = editPriority !== todo.priority;
    const newDate = editDueDate || "";
    const oldDate = todo.due_date || "";
    const dateChanged = newDate !== oldDate && (newDate !== "" || oldDate !== "");
    if (titleChanged || descChanged || prioChanged || dateChanged) {
      try {
        await api.updateTodo({
          id: todo.id,
          title: editTitle.trim(),
          description: editDesc.trim() || null,
          priority: editPriority,
          due_date: editDueDate || "",
        });
        onRefresh?.();
      } catch {
        notify.error("保存待办失败");
      }
    }
    onEndEdit();
  };
```

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/todo/TodoItem.tsx
git commit -m "feat: add error handling to TodoItem save"
```

---

## Task 4: Add error handling and theme fix to TodoDetailEditor

**Files:**
- Modify: `src/components/todo/TodoDetailEditor.tsx`

- [ ] **Step 1: Add notify import**

Add at the top of `src/components/todo/TodoDetailEditor.tsx`:

```tsx
import { notify } from "../../lib/toast";
```

- [ ] **Step 2: Wrap the useEffect fetch in try/catch**

Replace the `useEffect` on lines 20-22:

```tsx
  useEffect(() => {
    api.getTodoWithDetails(todoId)
      .then((d) => setTodoTags(d.tags))
      .catch(() => notify.error("加载待办详情失败"));
  }, [todoId]);
```

- [ ] **Step 3: Wrap `handleGroupChange` in try/catch**

Replace the `handleGroupChange` function (lines 24-28):

```tsx
  const handleGroupChange = async (gid: number | null) => {
    setGroupId(gid);
    try {
      await api.updateTodo({ id: todoId, group_id: gid });
      onRefresh();
    } catch {
      notify.error("更新分组失败");
    }
  };
```

- [ ] **Step 4: Wrap `handleTagToggle` in try/catch**

Replace the `handleTagToggle` function (lines 30-40):

```tsx
  const handleTagToggle = async (tagId: number) => {
    try {
      if (todoTags.some((t) => t.id === tagId)) {
        await api.removeTagFromTodo(todoId, tagId);
        setTodoTags((prev) => prev.filter((t) => t.id !== tagId));
      } else {
        await api.addTagToTodo(todoId, tagId);
        const tag = allTags.find((t) => t.id === tagId);
        if (tag) setTodoTags((prev) => [...prev, tag]);
      }
      onRefresh();
    } catch {
      notify.error("更新标签失败");
    }
  };
```

- [ ] **Step 5: Fix hardcoded blue colors -- replace `bg-blue-50 text-blue-700` with `bg-accent text-accent-foreground`**

In the JSX, there are two occurrences of the selected group styling. Replace the first occurrence (line 57):

```tsx
                  className={`w-full text-left text-xs px-2 py-1 rounded ${
                    groupId === null ? "bg-accent text-accent-foreground" : "hover:bg-accent"
                  }`}
```

Replace the second occurrence (line 66):

```tsx
                  className={`w-full text-left text-xs px-2 py-1 rounded flex items-center gap-2 ${
                    groupId === g.id ? "bg-accent text-accent-foreground" : "hover:bg-accent"
                  }`}
```

- [ ] **Step 6: Verify build**

Run: `npm run build`

- [ ] **Step 7: Commit**

```bash
git add src/components/todo/TodoDetailEditor.tsx
git commit -m "feat: add error handling and fix theme colors in TodoDetailEditor"
```

---

## Task 5: Add error handling to SceneEditor

**Files:**
- Modify: `src/components/scene/SceneEditor.tsx`

- [ ] **Step 1: Add notify import**

Add at the top of `src/components/scene/SceneEditor.tsx`:

```tsx
import { notify } from "../../lib/toast";
```

- [ ] **Step 2: Wrap `handleAddApp` in try/catch**

Replace the `handleAddApp` function (lines 66-70):

```tsx
  const handleAddApp = async (appId: number) => {
    if (!existingScene) return;
    try {
      await api.addAppToScene(existingScene.id, appId, 0);
      const updated = await api.listSceneApps(existingScene.id);
      setSceneApps(updated);
    } catch {
      notify.error("添加应用到场景失败");
    }
  };
```

- [ ] **Step 3: Add toast error to `handleCapture` catch block**

In the `handleCapture` function, the existing catch already logs to console. Add a toast notification. Replace the catch block (around line 104):

```tsx
    } catch (e) {
      console.error("Window capture failed:", e);
      notify.error("窗口抓取失败");
    } finally {
```

- [ ] **Step 4: Wrap `handleRemoveApp` in try/catch**

Replace the `handleRemoveApp` function (lines 111-114):

```tsx
  const handleRemoveApp = async (appId: number) => {
    if (!existingScene) return;
    try {
      await api.removeAppFromScene(existingScene.id, appId);
      setSceneApps((prev) => prev.filter((sa) => sa.app_id !== appId));
    } catch {
      notify.error("移除应用失败");
    }
  };
```

- [ ] **Step 5: Verify build**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/components/scene/SceneEditor.tsx
git commit -m "feat: add error handling to SceneEditor"
```

---

## Task 6: Add error handling to BindingEditor

**Files:**
- Modify: `src/components/binding/BindingEditor.tsx`

- [ ] **Step 1: Add notify import**

Add at the top of `src/components/binding/BindingEditor.tsx`:

```tsx
import { notify } from "../../lib/toast";
```

- [ ] **Step 2: Wrap `handleToggle` in try/catch**

Replace the `handleToggle` function (lines 25-34):

```tsx
  const handleToggle = async (sceneId: number) => {
    try {
      if (boundSceneIds.includes(sceneId)) {
        await api.unbindTodoFromScene(todoId, sceneId);
        setBoundSceneIds((prev) => prev.filter((id) => id !== sceneId));
      } else {
        await api.bindTodoToScene(todoId, sceneId);
        setBoundSceneIds((prev) => [...prev, sceneId]);
      }
      onRefresh();
    } catch {
      notify.error("更新场景绑定失败");
    }
  };
```

- [ ] **Step 3: Add toast error to `handleStartCapture` catch block**

Replace the catch block in `handleStartCapture` (around line 92):

```tsx
    } catch (e) {
      console.error("Window capture failed:", e);
      notify.error("窗口抓取失败");
    } finally {
```

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/components/binding/BindingEditor.tsx
git commit -m "feat: add error handling to BindingEditor"
```

---

## Task 7: Widget dark mode + error handling + skeleton

This is the most complex task. Widget is an independent window that does not share the main window's Toaster.

**Files:**
- Modify: `src/widget-entry.tsx`
- Modify: `src/components/widget/Widget.tsx`
- Modify: `src/components/widget/WidgetTodoItem.tsx`

- [ ] **Step 1: Add Toaster to Widget entry point**

In `src/widget-entry.tsx`, add the Toaster so Widget can show toasts independently. Replace the full file with:

```tsx
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
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
    <Toaster position="bottom-center" richColors closeButton />
  </ThemeProvider>
);
```

- [ ] **Step 2: Add imports to Widget.tsx**

Add at the top of `src/components/widget/Widget.tsx`:

```tsx
import { notify } from "../../lib/toast";
import { Skeleton } from "../ui/skeleton";
```

- [ ] **Step 3: Add dark mode detection and dynamic color constants**

After the `readOpacity` function (around line 31), add a helper:

```tsx
function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}
```

Inside the `Widget` component, after the `bgAlpha` computation (around line 222), add:

```tsx
  const dark = isDarkMode();
  const bgBase = dark ? "30, 30, 40" : "255, 255, 255";
  const textColor = dark ? "text-foreground" : "text-[#1e1b4b]";
  const textColorMuted = dark ? "text-muted-foreground" : "text-gray-400";
  const textColorSecondary = dark ? "text-muted-foreground" : "text-gray-600";
  const surfaceBg = dark ? "bg-card" : "bg-white";
  const hoverBg = dark ? "hover:bg-accent" : "hover:bg-gray-50";
  const borderColor = dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.5)";
  const dropdownBg = dark ? "rgba(30,30,40,0.95)" : "rgba(255,255,255,0.95)";
```

- [ ] **Step 4: Apply dynamic background and border colors**

In the outer `<div>` style object, replace:

```tsx
        background: `rgba(255, 255, 255, ${bgAlpha})`,
```

With:

```tsx
        background: `rgba(${bgBase}, ${bgAlpha})`,
```

Replace:

```tsx
          : "1px solid rgba(255, 255, 255, 0.5)",
```

With:

```tsx
          : `1px solid ${borderColor}`,
```

- [ ] **Step 5: Fix title bar text color**

Replace the scene selector button className (around line 266):

```tsx
              className={`text-xs font-semibold text-[#1e1b4b] truncate flex items-center gap-1 ${
```

With:

```tsx
              className={`text-xs font-semibold ${textColor} truncate flex items-center gap-1 ${
```

Replace the dropdown arrow color (around line 273):

```tsx
                <span className="text-[9px] text-[#1e1b4b]/50 flex-shrink-0">▾</span>
```

With:

```tsx
                <span className={`text-[9px] flex-shrink-0 ${dark ? "text-muted-foreground" : "text-[#1e1b4b]/50"}`}>▾</span>
```

- [ ] **Step 6: Fix dropdown popup colors**

Replace the dropdown `<div>` (around line 283):

```tsx
                className="absolute top-full left-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-0.5 min-w-[120px] max-w-[220px]"
```

With:

```tsx
                className={`absolute top-full left-0 mt-1 rounded-md shadow-lg border border-surface-border z-50 py-0.5 min-w-[120px] max-w-[220px] ${surfaceBg}`}
```

Replace the dropdown item className (around line 293):

```tsx
                    className={`w-full text-left px-2 py-1 text-[11px] hover:bg-gray-50 flex items-center gap-1 ${
                      scene.id === effectiveDefaultSceneId ? "bg-blue-50 text-blue-600" : "text-gray-700"
                    }`}
```

With:

```tsx
                    className={`w-full text-left px-2 py-1 text-[11px] ${hoverBg} flex items-center gap-1 ${
                      scene.id === effectiveDefaultSceneId ? "bg-accent text-accent-foreground" : textColor
                    }`}
```

- [ ] **Step 7: Fix filter panel colors**

Replace the filter toggle button (around line 324):

```tsx
              className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5 w-full py-0.5"
```

With:

```tsx
              className={`text-[10px] ${textColorMuted} hover:${dark ? "text-foreground" : "text-gray-600"} flex items-center gap-0.5 w-full py-0.5`}
```

Replace the scene name in filter panel (around line 348):

```tsx
                  <span className="text-[10px] text-gray-600">{scene.name}</span>
```

With:

```tsx
                  <span className={`text-[10px] ${textColorSecondary}`}>{scene.name}</span>
```

- [ ] **Step 8: Fix empty state colors**

Replace the two empty text elements (around lines 373 and 378):

```tsx
            <p className="text-xs text-gray-400 text-center py-2">
              当前筛选无待办
            </p>
```

With:

```tsx
            <p className={`text-xs text-center py-2 ${textColorMuted}`}>
              当前筛选无待办
            </p>
```

And:

```tsx
            <p className="text-xs text-gray-400 text-center py-2">
              No associated todos
            </p>
```

With:

```tsx
            <p className={`text-xs text-center py-2 ${textColorMuted}`}>
              No associated todos
            </p>
```

- [ ] **Step 9: Fix quick add input colors**

Replace the quick add input className (around line 393):

```tsx
            className="w-full px-2 py-1 text-[11px] rounded-lg bg-theme-bg/20 border border-dashed border-theme-border/60 text-[#1e1b4b] placeholder:text-theme-light/50 outline-none focus:border-theme"
```

With:

```tsx
            className={`w-full px-2 py-1 text-[11px] rounded-lg bg-theme-bg/20 border border-dashed border-theme-border/60 ${textColor} placeholder:text-theme-light/50 outline-none focus:border-theme`}
```

- [ ] **Step 10: Add error handling to `handleToggle`**

Replace the `handleToggle` function (around line 194):

```tsx
  const handleToggle = async (id: number) => {
    try {
      await updateTodo({ id, status: "completed" });
      await refresh();
    } catch {
      notify.error("切换状态失败");
    }
  };
```

- [ ] **Step 11: Add error handling to `handleQuickAdd`**

Replace the `handleQuickAdd` function (around line 199):

```tsx
  const handleQuickAdd = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && quickAdd.trim()) {
      try {
        const todo = await createTodo({ title: quickAdd.trim() });
        if (effectiveDefaultSceneId !== null) {
          await bindTodoToScene(todo.id, effectiveDefaultSceneId);
        }
        setQuickAdd("");
        await refresh();
      } catch {
        notify.error("快速添加失败");
      }
    }
  };
```

- [ ] **Step 12: Add loading skeleton to todo list area**

Inside the todo list `<div>` (around line 361), before the `filteredTodos.map` call, add a loading check. Replace the todo list content section:

```tsx
          {filteredTodos.map(todo => (
```

With a loading gate:

```tsx
          {todos.length === 0 && (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 px-2">
                  <Skeleton className="h-3.5 w-3.5 rounded-[3px]" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </>
          )}
          {filteredTodos.map(todo => (
```

Note: The skeleton shows only on first load when `todos.length === 0`. After the first `refresh()` completes, todos will either have data or be empty (no skeleton needed). If a loading state is needed for first-load, add a `loading` state variable:

After `const [opacity, setOpacity] = useState(readOpacity);`, add:

```tsx
  const [initialLoading, setInitialLoading] = useState(true);
```

In the `refresh` callback, after `setTodos(data);` add:

```tsx
      setInitialLoading(false);
```

Then replace the skeleton condition with:

```tsx
          {initialLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 px-2">
                  <Skeleton className="h-3.5 w-3.5 rounded-[3px]" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </>
          ) : (
```

And close the ternary properly before the closing `</div>` of the todo list area -- replace the end of the todo list section:

```tsx
          )}
        </div>
```

With:

```tsx
          )}
          )}
        </div>
```

The complete updated todo list section should be:

```tsx
        <div
          ref={todoListRef}
          style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
          className="px-2 pb-1.5 space-y-0.5"
        >
          {initialLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 px-2">
                  <Skeleton className="h-3.5 w-3.5 rounded-[3px]" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </>
          ) : (
            <>
              {filteredTodos.map(todo => (
                <div key={todo.id}>
                  <WidgetTodoItem todo={todo} onToggle={handleToggle} />
                  {todo.sub_tasks.map(sub => (
                    <div key={sub.id} className="ml-4">
                      <WidgetTodoItem todo={sub} onToggle={handleToggle} />
                    </div>
                  ))}
                </div>
              ))}
              {filteredTodos.length === 0 && todos.length > 0 && (
                <p className={`text-xs text-center py-2 ${textColorMuted}`}>
                  当前筛选无待办
                </p>
              )}
              {todos.length === 0 && (
                <p className={`text-xs text-center py-2 ${textColorMuted}`}>
                  No associated todos
                </p>
              )}
            </>
          )}
        </div>
```

- [ ] **Step 13: Fix WidgetTodoItem theme colors**

In `src/components/widget/WidgetTodoItem.tsx`, replace the completed text color:

```tsx
            ? "text-[11px] text-gray-400 line-through"
```

With:

```tsx
            ? "text-[11px] text-muted-foreground line-through"
```

Replace the active text color:

```tsx
            : "text-[11px] text-[#1e1b4b]"
```

With:

```tsx
            : "text-[11px] text-foreground"
```

- [ ] **Step 14: Verify build**

Run: `npm run build`

- [ ] **Step 15: Commit**

```bash
git add src/widget-entry.tsx src/components/widget/Widget.tsx src/components/widget/WidgetTodoItem.tsx
git commit -m "feat: Widget dark mode, error handling, skeleton loading, and theme fixes"
```

---

## Task 8: Add skeleton loading to StatsView

**Files:**
- Modify: `src/components/stats/StatsView.tsx`

- [ ] **Step 1: Add Skeleton import**

Add at the top of `src/components/stats/StatsView.tsx`:

```tsx
import { Skeleton } from "../ui/skeleton";
```

- [ ] **Step 2: Replace the loading text with skeleton**

Replace the loading block (around line 104):

```tsx
      {loading ? (
        <p className="text-muted-foreground text-center py-8">加载中...</p>
```

With:

```tsx
      {loading ? (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
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
        </>
```

And make sure the closing of the ternary still ends properly (the `) : summary.length === 0 ? (` should follow).

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/stats/StatsView.tsx
git commit -m "feat: add skeleton loading to StatsView"
```

---

## Task 9: Add skeleton loading to sidebar components

**Files:**
- Modify: `src/components/sidebar/GroupList.tsx`
- Modify: `src/components/sidebar/TagList.tsx`
- Modify: `src/components/sidebar/SceneList.tsx`

- [ ] **Step 1: Add skeleton loading to GroupList**

In `src/components/sidebar/GroupList.tsx`, add imports:

```tsx
import { Skeleton } from "../ui/skeleton";
```

The `useGroups` hook already exposes a `loading` state. Destructure it from the hook:

```tsx
  const { groups, loading, create, remove } = useGroups();
```

Then, inside the `{!collapsed && (` section, add a loading check right after the showInput block and before the list items:

```tsx
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => onSelectGroup(null)}
                className={`w-full flex items-center gap-2 px-2 py-1 text-xs rounded transition-colors ${
                  selectedGroupId === null ? "bg-theme-bg text-theme" : "hover:bg-accent text-muted-foreground"
                }`}
              >
                全部待办
              </button>
              {groups.map((group) => (
                <div
                  key={group.id}
                  className={`group flex items-center gap-2 px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                    selectedGroupId === group.id ? "bg-theme-bg text-theme" : "hover:bg-accent text-muted-foreground"
                  }`}
                  onClick={() => onSelectGroup(group.id)}
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/20" style={{ backgroundColor: group.color }} />
                  <span className="flex-1 truncate">{group.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(group.id); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground/70 hover:text-destructive text-[10px]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </>
          )}
```

The complete inner section of `{!collapsed && ( ... )}` should be:

```tsx
      {!collapsed && (
        <div className="px-1 pb-1">
          {showInput && (
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              onBlur={() => { if (!newName.trim()) setShowInput(false); }}
              placeholder="分组名称..."
              autoFocus
              className="w-full px-2 py-1 text-xs border border-surface-border bg-background focus:border-theme-border outline-none rounded-md mb-0.5"
            />
          )}
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => onSelectGroup(null)}
                className={`w-full flex items-center gap-2 px-2 py-1 text-xs rounded transition-colors ${
                  selectedGroupId === null ? "bg-theme-bg text-theme" : "hover:bg-accent text-muted-foreground"
                }`}
              >
                全部待办
              </button>
              {groups.map((group) => (
                <div
                  key={group.id}
                  className={`group flex items-center gap-2 px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                    selectedGroupId === group.id ? "bg-theme-bg text-theme" : "hover:bg-accent text-muted-foreground"
                  }`}
                  onClick={() => onSelectGroup(group.id)}
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/20" style={{ backgroundColor: group.color }} />
                  <span className="flex-1 truncate">{group.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(group.id); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground/70 hover:text-destructive text-[10px]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
```

- [ ] **Step 2: Add skeleton loading to TagList**

In `src/components/sidebar/TagList.tsx`, add imports:

```tsx
import { Skeleton } from "../ui/skeleton";
```

Destructure `loading` from the hook:

```tsx
  const { tags, loading, create, remove } = useTags();
```

Inside `{!collapsed && (`, add a loading check after the showInput block:

```tsx
          {loading ? (
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-5 w-12 rounded-full" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className={`group inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] rounded-full cursor-pointer transition-colors ${
                    selectedTagIds.includes(tag.id)
                      ? "ring-1 ring-offset-0.5"
                      : "hover:opacity-80"
                  }`}
                  style={{
                    backgroundColor: tag.color + "20",
                    color: tag.color,
                    ...(selectedTagIds.includes(tag.id) ? { ringColor: tag.color } : {}),
                  }}
                  onClick={() => onToggleTag(tag.id)}
                >
                  <span>{tag.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(tag.id); }}
                    className="opacity-0 group-hover:opacity-100 ml-0.5 text-[9px] hover:text-destructive"
                    style={{ color: tag.color + "80" }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
```

- [ ] **Step 3: Add skeleton loading to SceneList**

In `src/components/sidebar/SceneList.tsx`, add imports:

```tsx
import { Skeleton } from "../ui/skeleton";
```

Destructure `loading` from the hook:

```tsx
  const { scenes, loading, create } = useScenes();
```

Inside `{!collapsed && (`, add a loading check after the showInput block:

```tsx
          {loading ? (
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {scenes.map((scene) => (
                <button
                  key={scene.id}
                  onClick={() => onSelectScene(scene.id)}
                  onContextMenu={(e) => { e.preventDefault(); onEditScene(scene.id); }}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-colors ${
                    selectedSceneId === scene.id
                      ? "bg-theme-bg text-theme ring-1 ring-theme-border"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <span>{scene.icon || "📁"}</span>
                  <span>{scene.name}</span>
                </button>
              ))}
            </div>
          )}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar/GroupList.tsx src/components/sidebar/TagList.tsx src/components/sidebar/SceneList.tsx
git commit -m "feat: add skeleton loading to sidebar components"
```

---

## Task 10: Settings error handling + theme fixes

**Files:**
- Modify: `src/components/settings/Settings.tsx`

- [ ] **Step 1: Add notify import**

Add at the top of `src/components/settings/Settings.tsx`:

```tsx
import { notify } from "../../lib/toast";
```

- [ ] **Step 2: Add toast error to `handleExport`**

Replace the catch block in `handleExport` (around line 164):

```tsx
    } catch (e) {
      console.error("Export failed:", e);
      notify.error("导出数据失败");
    }
```

- [ ] **Step 3: Add toast error to `confirmImport`**

Replace the catch block in `confirmImport` (around line 219):

```tsx
    } catch (e) {
      console.error("Import failed:", e);
      notify.error("导入数据失败");
    }
```

- [ ] **Step 4: Add toast error to `handleImport`**

Replace the catch block in `handleImport` (around line 202):

```tsx
    } catch (e) {
      console.error("Import failed:", e);
      notify.error("读取备份文件失败");
    }
```

- [ ] **Step 5: Fix hardcoded `text-gray-400` in data retention label**

Replace (around line 267):

```tsx
            <span className="text-xs text-gray-400">天</span>
```

With:

```tsx
            <span className="text-xs text-muted-foreground">天</span>
```

- [ ] **Step 6: Fix hardcoded `text-gray-400` in export/import buttons**

Replace (around line 273):

```tsx
            <button onClick={handleExport} className="text-xs text-gray-400 hover:text-blue-500">导出</button>
            <span className="text-gray-300">|</span>
            <button onClick={handleImport} className="text-xs text-gray-400 hover:text-blue-500">导入</button>
```

With:

```tsx
            <button onClick={handleExport} className="text-xs text-muted-foreground hover:text-theme">导出</button>
            <span className="text-muted-foreground/30">|</span>
            <button onClick={handleImport} className="text-xs text-muted-foreground hover:text-theme">导入</button>
```

- [ ] **Step 7: Fix hardcoded `text-gray-400` in app list and capture button**

Replace the refresh icons button (around line 329):

```tsx
              className="text-xs text-gray-400 hover:text-blue-500 disabled:opacity-50"
```

With:

```tsx
              className="text-xs text-muted-foreground hover:text-theme disabled:opacity-50"
```

Replace the expand arrow (around line 345):

```tsx
                      className="text-gray-400 hover:text-muted-foreground text-xs w-4"
```

With:

```tsx
                      className="text-muted-foreground/60 hover:text-muted-foreground text-xs w-4"
```

Replace the process names display (around line 358):

```tsx
                      <span className="text-xs text-gray-400">
```

With:

```tsx
                      <span className="text-xs text-muted-foreground">
```

Replace the widget label (around line 371):

```tsx
                      <span className="text-[10px] text-gray-400">浮窗</span>
```

With:

```tsx
                      <span className="text-[10px] text-muted-foreground">浮窗</span>
```

Replace the delete button (around line 373):

```tsx
                    <button onClick={() => remove(app.id)} className="text-xs text-gray-400 hover:text-red-500">删除</button>
```

With:

```tsx
                    <button onClick={() => remove(app.id)} className="text-xs text-muted-foreground hover:text-red-500">删除</button>
```

Replace the offset display texts (around lines 384, 395):

```tsx
                      <span className="w-8 text-gray-400">{off.x}px</span>
```

With:

```tsx
                      <span className="w-8 text-muted-foreground">{off.x}px</span>
```

```tsx
                      <span className="w-8 text-gray-400">{off.y}px</span>
```

With:

```tsx
                      <span className="w-8 text-muted-foreground">{off.y}px</span>
```

Replace the import icon button (around line 403):

```tsx
                      className="text-xs text-gray-400 hover:text-blue-500"
```

With:

```tsx
                      className="text-xs text-muted-foreground hover:text-theme"
```

Replace the capture button border (around line 417):

```tsx
            className="w-full py-2 mt-1 text-xs rounded border border-surface-border hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors disabled:opacity-50"
```

With:

```tsx
            className="w-full py-2 mt-1 text-xs rounded border border-surface-border hover:border-theme hover:text-theme cursor-pointer transition-colors disabled:opacity-50"
```

Replace the empty apps text (around line 420):

```tsx
          {apps.length === 0 && <p className="text-xs text-gray-400 py-2">暂无关联软件</p>}
```

With:

```tsx
          {apps.length === 0 && <p className="text-xs text-muted-foreground py-2">暂无关联软件</p>}
```

- [ ] **Step 8: Verify build**

Run: `npm run build`

- [ ] **Step 9: Commit**

```bash
git add src/components/settings/Settings.tsx
git commit -m "feat: add error handling and fix theme colors in Settings"
```

---

## Task 11: App.tsx init error handling

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add notify import**

Add at the top of `src/App.tsx`:

```tsx
import { notify } from "./lib/toast";
```

- [ ] **Step 2: Wrap init `startWindowMonitor` with toast**

Replace (around line 27):

```tsx
    startWindowMonitor().catch((e) =>
      console.error("Failed to start window monitor:", e)
    );
```

With:

```tsx
    startWindowMonitor().catch((e) => {
      console.error("Failed to start window monitor:", e);
      notify.error("窗口监控启动失败");
    });
```

- [ ] **Step 3: Wrap `cleanupOldSessions` with toast**

Replace (around line 46):

```tsx
          cleanupOldSessions(retentionDays).catch(() => {});
```

With:

```tsx
          cleanupOldSessions(retentionDays).catch(() => {
            notify.error("清理历史数据失败");
          });
```

- [ ] **Step 4: Verify build**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add init error handling to App"
```

---

## Task 12: Final verification and cleanup

- [ ] **Step 1: Full build verification**

Run: `npm run build`

Ensure zero errors and zero warnings.

- [ ] **Step 2: Grep for remaining hardcoded colors**

Run these checks to find any remaining issues:

```bash
grep -rn "text-gray-400\|text-gray-500\|text-gray-600\|text-gray-700\|bg-gray-50\|bg-gray-100\|border-gray-200\|bg-blue-50\|text-blue-700\|text-blue-600\|bg-white\|text-\[#1e1b4b\]" src/components/
```

Any remaining hits should be in files not covered by this phase (e.g., RealtimeOverview, TimeDistribution, SceneTimeline, CalendarView, etc.) and can be deferred.

- [ ] **Step 3: Verify all spec items are covered**

Check each item from the spec:

| Spec item | Covered by task |
|-----------|----------------|
| TodoList error handling | Task 2 |
| TodoItem error handling | Task 3 |
| TodoDetailEditor error handling + theme | Task 4 |
| SceneEditor error handling | Task 5 |
| BindingEditor error handling | Task 6 |
| Widget dark mode + error + skeleton + Toaster | Task 7 |
| Settings error handling + theme | Task 10 |
| App.tsx init error handling | Task 11 |
| Skeleton component | Task 1 |
| TodoList skeleton | Task 2 |
| StatsView skeleton | Task 8 |
| Sidebar skeletons | Task 9 |
| Widget skeleton | Task 7 |
| Theme consistency (hardcoded colors) | Tasks 4, 7, 10 |

---

## Self-Review

**Completeness check:**
- All 12 bare API call locations from the spec are covered with try/catch + toast.
- Skeleton loading added to all 6 locations (TodoList, StatsView, 3 sidebar components, Widget).
- Theme fixes address all hardcoded colors listed in the spec: `text-gray-400`, `text-gray-700`, `text-[#1e1b4b]`, `bg-blue-50 text-blue-700`, `bg-white`, `border-gray-200`, `hover:bg-gray-50`.
- Widget dark mode is dynamically computed via `isDarkMode()` helper, using RGB base values for background and semantic classes for text.
- Widget gets its own `<Toaster />` via the widget entry point since it is an independent window.

**Risk assessment:**
- Task 7 (Widget) is the most complex due to the dark mode logic and ternary nesting. Care must be taken with the skeleton loading ternary to avoid JSX structure errors.
- Sidebar skeleton changes restructure the list rendering into a ternary. The original JSX is preserved verbatim in the non-loading branch, so no visual regression.
- `text-gray-400` to `text-muted-foreground` is a safe semantic swap -- both represent secondary/muted text.
- `bg-blue-50 text-blue-700` to `bg-accent text-accent-foreground` works because the accent color system maps to theme-appropriate values in both light and dark modes.

**Potential issues:**
- The `hover:text-gray-600` inside a template literal `${textColorMuted} hover:${dark ? "text-foreground" : "text-gray-600"}` in Widget (Step 7 of Task 7) constructs a dynamic class. Tailwind may not detect `hover:text-foreground` if it is not used elsewhere. However, both `text-foreground` and `hover:text-foreground` are used extensively across the codebase, so Tailwind's content scanning should pick them up.
- No ErrorBoundary is added (explicitly out of scope per spec).

**What's NOT in this plan (deferred):**
- ErrorBoundary component
- Data fetching pattern refactor (keeping polling)
- Rust backend changes
- Theme fixes in StatsView sub-components (TimeDistribution, SceneTimeline, CalendarView) and TodoForm -- these use semantic tokens already or can be addressed separately
