# Phase 3: Main Window Frontend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the React UI — app shell with sidebar, todo list with full CRUD, group/tag management, and software binding editor.

**Architecture:** React SPA with sidebar + content area layout. Custom hooks (`useTodos`, `useGroups`, `useTags`, `useApps`) wrap Tauri invoke calls. Components: Sidebar (smart views, group list, tag list), TodoList, TodoItem, TodoForm, BindingEditor.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, @tauri-apps/api

**Parent:** [2026-04-16-scene-todo.md](2026-04-16-scene-todo.md)

**Depends on:** Phase 2 (backend CRUD commands registered)

---

### Task 10: TypeScript Types + Invoke Wrapper

**Files:**
- Create: `src/types/index.ts`
- Create: `src/lib/invoke.ts`

- [ ] **Step 1: Write TypeScript types matching Rust models**

File: `src/types/index.ts`
```typescript
// Models
export interface Todo {
  id: number;
  title: string;
  description: string | null;
  status: "pending" | "completed";
  priority: "high" | "medium" | "low";
  group_id: number | null;
  parent_id: number | null;
  sort_order: number;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface TodoWithDetails extends Todo {
  tags: Tag[];
  sub_tasks: Todo[];
  bound_app_ids: number[];
}

export interface Group {
  id: number;
  name: string;
  color: string;
  sort_order: number;
  parent_id: number | null;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface App {
  id: number;
  name: string;
  process_names: string;  // JSON array string
  icon_path: string | null;
  display_name: string | null;
}

// Input types
export interface CreateTodo {
  title: string;
  description?: string | null;
  priority?: "high" | "medium" | "low" | null;
  group_id?: number | null;
  parent_id?: number | null;
  due_date?: string | null;
}

export interface UpdateTodo {
  id: number;
  title?: string | null;
  description?: string | null;
  status?: "pending" | "completed" | null;
  priority?: "high" | "medium" | "low" | null;
  group_id?: number | null;
  due_date?: string | null;
}

export interface CreateGroup {
  name: string;
  color?: string | null;
  parent_id?: number | null;
}

export interface UpdateGroup {
  id: number;
  name?: string | null;
  color?: string | null;
  sort_order?: number | null;
  parent_id?: number | null;
}

export interface CreateTag {
  name: string;
  color?: string | null;
}

export interface UpdateTag {
  id: number;
  name?: string | null;
  color?: string | null;
}

export interface CreateApp {
  name: string;
  process_names: string[];
  display_name?: string | null;
}

export interface UpdateApp {
  id: number;
  name?: string | null;
  process_names?: string[] | null;
  display_name?: string | null;
}

// Filters
export interface TodoFilters {
  status?: string | null;
  group_id?: number | null;
  tag_id?: number | null;
  priority?: string | null;
  parent_id?: number | null;
  due_before?: string | null;
}
```

- [ ] **Step 2: Write type-safe invoke wrapper**

File: `src/lib/invoke.ts`
```typescript
import { invoke } from "@tauri-apps/api/core";
import type {
  Todo, TodoWithDetails, Group, Tag, App,
  CreateTodo, UpdateTodo, CreateGroup, UpdateGroup,
  CreateTag, UpdateTag, CreateApp, UpdateApp, TodoFilters,
} from "../types";

// Todo
export const createTodo = (input: CreateTodo) =>
  invoke<Todo>("create_todo", { input });

export const listTodos = (filters: TodoFilters = {}) =>
  invoke<Todo[]>("list_todos", { filters });

export const getTodo = (id: number) =>
  invoke<Todo>("get_todo", { id });

export const updateTodo = (input: UpdateTodo) =>
  invoke<Todo>("update_todo", { input });

export const deleteTodo = (id: number) =>
  invoke<void>("delete_todo", { id });

export const getTodoWithDetails = (id: number) =>
  invoke<TodoWithDetails>("get_todo_with_details", { id });

export const listTodosByApp = (appId: number) =>
  invoke<TodoWithDetails[]>("list_todos_by_app", { appId });

export const addTagToTodo = (todoId: number, tagId: number) =>
  invoke<void>("add_tag_to_todo", { todoId, tagId });

export const removeTagFromTodo = (todoId: number, tagId: number) =>
  invoke<void>("remove_tag_from_todo", { todoId, tagId });

// Group
export const createGroup = (input: CreateGroup) =>
  invoke<Group>("create_group", { input });

export const listGroups = () =>
  invoke<Group[]>("list_groups");

export const updateGroup = (input: UpdateGroup) =>
  invoke<Group>("update_group", { input });

export const deleteGroup = (id: number) =>
  invoke<void>("delete_group", { id });

// Tag
export const createTag = (input: CreateTag) =>
  invoke<Tag>("create_tag", { input });

export const listTags = () =>
  invoke<Tag[]>("list_tags");

export const updateTag = (input: UpdateTag) =>
  invoke<Tag>("update_tag", { input });

export const deleteTag = (id: number) =>
  invoke<void>("delete_tag", { id });

// App
export const createApp = (input: CreateApp) =>
  invoke<App>("create_app", { input });

export const listApps = () =>
  invoke<App[]>("list_apps");

export const updateApp = (input: UpdateApp) =>
  invoke<App>("update_app", { input });

export const deleteApp = (id: number) =>
  invoke<void>("delete_app", { id });

export const bindTodoToApp = (todoId: number, appId: number) =>
  invoke<void>("bind_todo_to_app", { todoId, appId });

export const unbindTodoFromApp = (todoId: number, appId: number) =>
  invoke<void>("unbind_todo_from_app", { todoId, appId });
```

- [ ] **Step 3: Commit**

```bash
git add src/types/ src/lib/invoke.ts
git commit -m "feat: add TypeScript types and type-safe Tauri invoke wrapper"
```

---

### Task 11: App Shell Layout

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/sidebar/Sidebar.tsx`
- Create: `src/components/sidebar/SmartViews.tsx`

- [ ] **Step 1: Write App.tsx with sidebar + content layout**

File: `src/App.tsx`
```tsx
import { useState } from "react";
import { Sidebar } from "./components/sidebar/Sidebar";
import { TodoList } from "./components/todo/TodoList";
import type { TodoFilters } from "./types";

export default function App() {
  const [filters, setFilters] = useState<TodoFilters>({});
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const handleSmartView = (view: string) => {
    setSelectedGroupId(null);
    setSelectedTagIds([]);
    switch (view) {
      case "all":
        setFilters({});
        break;
      case "today":
        setFilters({ due_before: new Date().toISOString().split("T")[0] });
        break;
      case "important":
        setFilters({ priority: "high" });
        break;
    }
  };

  const handleSelectGroup = (groupId: number | null) => {
    setSelectedGroupId(groupId);
    setSelectedTagIds([]);
    setFilters(groupId ? { group_id: groupId } : {});
  };

  const handleToggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        onSmartView={handleSmartView}
        selectedGroupId={selectedGroupId}
        onSelectGroup={handleSelectGroup}
        selectedTagIds={selectedTagIds}
        onToggleTag={handleToggleTag}
      />
      <main className="flex-1 overflow-auto">
        <TodoList filters={filters} selectedTagIds={selectedTagIds} />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Write SmartViews component**

File: `src/components/sidebar/SmartViews.tsx`
```tsx
interface SmartViewsProps {
  onSmartView: (view: string) => void;
}

const views = [
  { key: "all", label: "全部", icon: "📋" },
  { key: "today", label: "今天", icon: "📅" },
  { key: "important", label: "重要", icon: "⭐" },
];

export function SmartViews({ onSmartView }: SmartViewsProps) {
  return (
    <div className="space-y-0.5">
      <h3 className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
        智能视图
      </h3>
      {views.map((v) => (
        <button
          key={v.key}
          onClick={() => onSmartView(v.key)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors"
        >
          <span>{v.icon}</span>
          <span>{v.label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Write Sidebar shell**

File: `src/components/sidebar/Sidebar.tsx`
```tsx
import { SmartViews } from "./SmartViews";
import { GroupList } from "./GroupList";
import { TagList } from "./TagList";

interface SidebarProps {
  onSmartView: (view: string) => void;
  selectedGroupId: number | null;
  onSelectGroup: (groupId: number | null) => void;
  selectedTagIds: number[];
  onToggleTag: (tagId: number) => void;
}

export function Sidebar({
  onSmartView, selectedGroupId, onSelectGroup,
  selectedTagIds, onToggleTag,
}: SidebarProps) {
  return (
    <aside className="w-60 border-r border-gray-200 bg-white flex flex-col">
      <div className="p-3 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-800">SceneTodo</h1>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        <SmartViews onSmartView={onSmartView} />
        <GroupList
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
        />
        <TagList
          selectedTagIds={selectedTagIds}
          onToggleTag={onToggleTag}
        />
      </nav>
    </aside>
  );
}
```

- [ ] **Step 4: Create placeholder components**

Create empty placeholder files for components not yet implemented:

```bash
mkdir -p src/components/todo src/components/sidebar src/components/widget src/components/binding src/components/settings
touch src/components/todo/TodoList.tsx
touch src/components/todo/TodoItem.tsx
touch src/components/todo/TodoForm.tsx
touch src/components/sidebar/GroupList.tsx
touch src/components/sidebar/TagList.tsx
```

Each placeholder exports a named component that renders `<div>TODO: ComponentName</div>`.

Example for `TodoList.tsx`:
```tsx
export function TodoList() {
  return <div className="p-4">TODO: TodoList</div>;
}
```

- [ ] **Step 5: Verify app renders**

Run:
```bash
cd d:/Project/scene-todo && npm run tauri dev
```

Expected: App window shows sidebar with "SceneTodo" header and smart views. Content area shows "TODO: TodoList".

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/
git commit -m "feat: add app shell layout with sidebar navigation"
```

---

### Task 12: GroupList + TagList Sidebar Components

**Files:**
- Create: `src/components/sidebar/GroupList.tsx`
- Create: `src/components/sidebar/TagList.tsx`
- Create: `src/hooks/useGroups.ts`
- Create: `src/hooks/useTags.ts`

- [ ] **Step 1: Write useGroups hook**

File: `src/hooks/useGroups.ts`
```typescript
import { useState, useEffect, useCallback } from "react";
import type { Group, CreateGroup, UpdateGroup } from "../types";
import * as api from "../lib/invoke";

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listGroups();
      setGroups(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (input: CreateGroup) => {
    await api.createGroup(input);
    await refresh();
  };

  const update = async (input: UpdateGroup) => {
    await api.updateGroup(input);
    await refresh();
  };

  const remove = async (id: number) => {
    await api.deleteGroup(id);
    await refresh();
  };

  return { groups, loading, create, update, remove, refresh };
}
```

- [ ] **Step 2: Write useTags hook**

File: `src/hooks/useTags.ts`
```typescript
import { useState, useEffect, useCallback } from "react";
import type { Tag, CreateTag, UpdateTag } from "../types";
import * as api from "../lib/invoke";

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listTags();
      setTags(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (input: CreateTag) => {
    await api.createTag(input);
    await refresh();
  };

  const update = async (input: UpdateTag) => {
    await api.updateTag(input);
    await refresh();
  };

  const remove = async (id: number) => {
    await api.deleteTag(id);
    await refresh();
  };

  return { tags, loading, create, update, remove, refresh };
}
```

- [ ] **Step 3: Write GroupList component**

File: `src/components/sidebar/GroupList.tsx`
```tsx
import { useState } from "react";
import { useGroups } from "../../hooks/useGroups";

interface GroupListProps {
  selectedGroupId: number | null;
  onSelectGroup: (groupId: number | null) => void;
}

export function GroupList({ selectedGroupId, onSelectGroup }: GroupListProps) {
  const { groups, create, remove } = useGroups();
  const [newName, setNewName] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await create({ name: newName.trim() });
    setNewName("");
    setShowInput(false);
  };

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-2 py-1">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">分组</h3>
        <button
          onClick={() => setShowInput(true)}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          +
        </button>
      </div>

      {showInput && (
        <div className="px-2 pb-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            onBlur={() => { if (!newName.trim()) setShowInput(false); }}
            placeholder="分组名称..."
            autoFocus
            className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
          />
        </div>
      )}

      <button
        onClick={() => onSelectGroup(null)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
          selectedGroupId === null ? "bg-blue-50 text-blue-700" : "hover:bg-gray-100"
        }`}
      >
        全部待办
      </button>

      {groups.map((group) => (
        <div
          key={group.id}
          className={`group flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer transition-colors ${
            selectedGroupId === group.id ? "bg-blue-50 text-blue-700" : "hover:bg-gray-100"
          }`}
          onClick={() => onSelectGroup(group.id)}
        >
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: group.color }}
          />
          <span className="flex-1 truncate">{group.name}</span>
          <button
            onClick={(e) => { e.stopPropagation(); remove(group.id); }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write TagList component**

File: `src/components/sidebar/TagList.tsx`
```tsx
import { useState } from "react";
import { useTags } from "../../hooks/useTags";

interface TagListProps {
  selectedTagIds: number[];
  onToggleTag: (tagId: number) => void;
}

export function TagList({ selectedTagIds, onToggleTag }: TagListProps) {
  const { tags, create, remove } = useTags();
  const [newName, setNewName] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await create({ name: newName.trim() });
    setNewName("");
    setShowInput(false);
  };

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-2 py-1">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">标签</h3>
        <button
          onClick={() => setShowInput(true)}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          +
        </button>
      </div>

      {showInput && (
        <div className="px-2 pb-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            onBlur={() => { if (!newName.trim()) setShowInput(false); }}
            placeholder="标签名称..."
            autoFocus
            className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
          />
        </div>
      )}

      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => onToggleTag(tag.id)}
          className={`group w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
            selectedTagIds.includes(tag.id)
              ? "bg-blue-50 text-blue-700"
              : "hover:bg-gray-100"
          }`}
        >
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: tag.color }}
          />
          <span className="flex-1 truncate text-left">{tag.name}</span>
          <span
            onClick={(e) => { e.stopPropagation(); remove(tag.id); }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
          >
            &times;
          </span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify sidebar renders with groups and tags**

Run:
```bash
cd d:/Project/scene-todo && npm run tauri dev
```

Expected: Sidebar shows "分组" and "标签" sections. Clicking "+" shows input. Creating items works.

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar/GroupList.tsx src/components/sidebar/TagList.tsx src/hooks/useGroups.ts src/hooks/useTags.ts
git commit -m "feat: add GroupList and TagList sidebar components with CRUD"
```

---

### Task 13: Todo List + TodoItem + TodoForm

**Files:**
- Create: `src/components/todo/TodoList.tsx`
- Create: `src/components/todo/TodoItem.tsx`
- Create: `src/components/todo/TodoForm.tsx`
- Create: `src/hooks/useTodos.ts`

- [ ] **Step 1: Write useTodos hook**

File: `src/hooks/useTodos.ts`
```typescript
import { useState, useEffect, useCallback } from "react";
import type { Todo, TodoWithDetails, CreateTodo, UpdateTodo, TodoFilters } from "../types";
import * as api from "../lib/invoke";

export function useTodos(filters: TodoFilters = {}) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listTodos(filters);
      setTodos(data);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (input: CreateTodo) => {
    await api.createTodo(input);
    await refresh();
  };

  const update = async (input: UpdateTodo) => {
    await api.updateTodo(input);
    await refresh();
  };

  const toggleStatus = async (id: number, status: "pending" | "completed") => {
    await api.updateTodo({
      id,
      status: status === "pending" ? "completed" : "pending",
    });
    await refresh();
  };

  const remove = async (id: number) => {
    await api.deleteTodo(id);
    await refresh();
  };

  const getDetails = async (id: number) => {
    return api.getTodoWithDetails(id);
  };

  return { todos, loading, create, update, toggleStatus, remove, getDetails, refresh };
}
```

- [ ] **Step 2: Write TodoForm component**

File: `src/components/todo/TodoForm.tsx`
```tsx
import { useState } from "react";

interface TodoFormProps {
  onSubmit: (title: string) => void;
  placeholder?: string;
}

export function TodoForm({ onSubmit, placeholder = "添加待办，按回车提交..." }: TodoFormProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && value.trim()) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <div className="flex items-center gap-2 p-3 border-b border-gray-200">
      <span className="text-gray-300 text-lg">+</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleSubmit}
        placeholder={placeholder}
        className="flex-1 text-sm outline-none placeholder:text-gray-400"
      />
    </div>
  );
}
```

- [ ] **Step 3: Write TodoItem component**

File: `src/components/todo/TodoItem.tsx`
```tsx
import { useState } from "react";
import type { Todo } from "../../types";

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  onAddSubTask: (parentId: number, title: string) => void;
}

const priorityColors: Record<string, string> = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-green-500",
};

export function TodoItem({ todo, onToggle, onDelete, onAddSubTask }: TodoItemProps) {
  const [showSubInput, setShowSubInput] = useState(false);
  const [subTitle, setSubTitle] = useState("");
  const isCompleted = todo.status === "completed";

  const handleAddSub = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && subTitle.trim()) {
      onAddSubTask(todo.id, subTitle.trim());
      setSubTitle("");
      setShowSubInput(false);
    }
  };

  return (
    <div className="group flex items-start gap-2 px-3 py-2 hover:bg-gray-50 transition-colors">
      <button
        onClick={() => onToggle(todo.id)}
        className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
          isCompleted
            ? "bg-green-500 border-green-500 text-white"
            : "border-gray-300 hover:border-gray-500"
        }`}
      >
        {isCompleted && <span className="text-xs">&#10003;</span>}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${isCompleted ? "line-through text-gray-400" : "text-gray-800"}`}>
            {todo.title}
          </span>
          <span className={`text-xs ${priorityColors[todo.priority] || "text-gray-400"}`}>
            {todo.priority === "high" ? "!!" : todo.priority === "medium" ? "!" : ""}
          </span>
        </div>
        {todo.description && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{todo.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setShowSubInput(true)}
          className="text-xs text-gray-400 hover:text-gray-600"
          title="添加子任务"
        >
          +子
        </button>
        <button
          onClick={() => onDelete(todo.id)}
          className="text-xs text-gray-400 hover:text-red-500"
        >
          &times;
        </button>
      </div>

      {showSubInput && (
        <div className="absolute left-8 mt-6">
          <input
            value={subTitle}
            onChange={(e) => setSubTitle(e.target.value)}
            onKeyDown={handleAddSub}
            onBlur={() => { if (!subTitle.trim()) setShowSubInput(false); }}
            placeholder="子任务名称..."
            autoFocus
            className="px-2 py-1 text-sm border border-gray-200 rounded w-48"
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write TodoList component**

File: `src/components/todo/TodoList.tsx`
```tsx
import { useTodos } from "../../hooks/useTodos";
import { TodoForm } from "./TodoForm";
import { TodoItem } from "./TodoItem";
import type { TodoFilters } from "../../types";

interface TodoListProps {
  filters: TodoFilters;
  selectedTagIds: number[];
}

export function TodoList({ filters, selectedTagIds }: TodoListProps) {
  const { todos, loading, create, toggleStatus, remove } = useTodos(filters);

  const handleCreate = (title: string) => {
    create({ title });
  };

  const handleAddSubTask = (parentId: number, title: string) => {
    create({ title, parent_id: parentId });
  };

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">加载中...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <TodoForm onSubmit={handleCreate} />
      <div className="flex-1 overflow-y-auto">
        {todos.length === 0 ? (
          <div className="p-4 text-sm text-gray-400 text-center">
            没有待办事项
          </div>
        ) : (
          todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={toggleStatus}
              onDelete={remove}
              onAddSubTask={handleAddSubTask}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify todo CRUD works end-to-end**

Run:
```bash
cd d:/Project/scene-todo && npm run tauri dev
```

Expected:
- Type in quick-add input, press Enter — todo appears in list
- Click checkbox — todo toggles to completed (strikethrough)
- Hover — shows delete button, click to remove
- Click "+子" — sub-task input appears

- [ ] **Step 6: Commit**

```bash
git add src/components/todo/ src/hooks/useTodos.ts
git commit -m "feat: add TodoList, TodoItem, TodoForm with full CRUD"
```

---

### Task 14: Software Binding Editor

**Files:**
- Create: `src/components/binding/BindingEditor.tsx`
- Create: `src/hooks/useApps.ts`
- Modify: `src/components/todo/TodoItem.tsx` — add binding button

- [ ] **Step 1: Write useApps hook**

File: `src/hooks/useApps.ts`
```typescript
import { useState, useEffect, useCallback } from "react";
import type { App, CreateApp } from "../types";
import * as api from "../lib/invoke";

export function useApps() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listApps();
      setApps(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (input: CreateApp) => {
    await api.createApp(input);
    await refresh();
  };

  const remove = async (id: number) => {
    await api.deleteApp(id);
    await refresh();
  };

  return { apps, loading, create, remove, refresh };
}
```

- [ ] **Step 2: Write BindingEditor dialog**

File: `src/components/binding/BindingEditor.tsx`
```tsx
import { useState } from "react";
import { useApps } from "../../hooks/useApps";
import * as api from "../../lib/invoke";

interface BindingEditorProps {
  todoId: number;
  boundAppIds: number[];
  onClose: () => void;
  onRefresh: () => void;
}

export function BindingEditor({ todoId, boundAppIds, onClose, onRefresh }: BindingEditorProps) {
  const { apps, create } = useApps();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProcess, setNewProcess] = useState("");

  const handleToggle = async (appId: number) => {
    if (boundAppIds.includes(appId)) {
      await api.unbindTodoFromApp(todoId, appId);
    } else {
      await api.bindTodoToApp(todoId, appId);
    }
    onRefresh();
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newProcess.trim()) return;
    await create({
      name: newName.trim(),
      process_names: [newProcess.trim()],
    });
    setNewName("");
    setNewProcess("");
    setShowCreate(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-80 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">关联软件</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        <div className="space-y-1 max-h-60 overflow-y-auto">
          {apps.map((app) => (
            <label
              key={app.id}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
            >
              <input
                type="checkbox"
                checked={boundAppIds.includes(app.id)}
                onChange={() => handleToggle(app.id)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{app.display_name || app.name}</span>
            </label>
          ))}
        </div>

        {showCreate ? (
          <div className="mt-3 space-y-2 border-t pt-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="软件名称 (如: Word)"
              className="w-full px-2 py-1 text-sm border rounded"
            />
            <input
              value={newProcess}
              onChange={(e) => setNewProcess(e.target.value)}
              placeholder="进程名 (如: WINWORD.EXE)"
              className="w-full px-2 py-1 text-sm border rounded"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                添加
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 w-full py-1 text-sm text-blue-500 hover:text-blue-600 border-t pt-3"
          >
            + 添加新软件
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add binding button to TodoItem**

Modify `src/components/todo/TodoItem.tsx` — add import and button in the action bar:

```tsx
// Add to imports
import { BindingEditor } from "../binding/BindingEditor";

// Add state inside component
const [showBinding, setShowBinding] = useState(false);

// Add button in the action bar (after sub-task button, before delete):
<button
  onClick={() => setShowBinding(true)}
  className="text-xs text-gray-400 hover:text-gray-600"
  title="关联软件"
>
  📎
</button>

// Add at end of component, before closing fragment:
{showBinding && <BindingEditor todoId={todo.id} boundAppIds={[]} onClose={() => setShowBinding(false)} onRefresh={() => {}} />}
```

Note: Full `boundAppIds` and `onRefresh` integration requires `getTodoWithDetails` — refine during implementation if needed.

- [ ] **Step 4: Verify binding editor opens**

Run:
```bash
cd d:/Project/scene-todo && npm run tauri dev
```

Expected: Hover a todo, click 📎 — dialog opens. Can create a new app and toggle binding.

- [ ] **Step 5: Commit**

```bash
git add src/components/binding/ src/hooks/useApps.ts src/components/todo/TodoItem.tsx
git commit -m "feat: add software binding editor with app CRUD"
```
