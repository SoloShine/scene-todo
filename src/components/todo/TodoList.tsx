import { useState, useMemo, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { List, CalendarDays, ChevronDown, ChevronRight, ClipboardList, Search as SearchIcon } from "lucide-react";
import { useTodos } from "../../hooks/useTodos";
import { TodoForm } from "./TodoForm";
import type { TodoFormHandle } from "./TodoForm";
import { TodoItem, parseDateLocal } from "./TodoItem";
import { CalendarView } from "./CalendarView";
import * as api from "../../lib/invoke";
import { notify } from "../../lib/toast";
import { Skeleton } from "../ui/skeleton";
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { TodoFilters, TodoWithDetails } from "../../types";

type StatusFilter = "" | "pending" | "overdue" | "completed" | "abandoned";
type TodoGroup = "overdue" | "today" | "upcoming" | "undated" | "completed";

interface TodoListProps {
  filters: TodoFilters;
  selectedSceneId?: number | null;
}

export interface TodoListHandle {
  focusSearch: () => void
  focusTodoForm: () => void
}

const GROUP_CONFIG: { key: TodoGroup; label: string; color: string }[] = [
  { key: "overdue", label: "过期", color: "text-destructive" },
  { key: "today", label: "今天", color: "text-blue-500" },
  { key: "upcoming", label: "未开始", color: "text-muted-foreground" },
  { key: "undated", label: "无日期", color: "text-muted-foreground" },
  { key: "completed", label: "已结束", color: "text-[oklch(0.600_0.150_160)]" },
];

function getGroup(todo: TodoWithDetails): TodoGroup {
  if (todo.status === "completed" || todo.status === "abandoned") return "completed";
  if (!todo.due_date) return "undated";
  const d = parseDateLocal(todo.due_date);
  if (!d) return "undated";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d < today) return "overdue";
  if (d.getTime() === today.getTime()) return "today";
  return "upcoming";
}

function getEffectiveStatus(t: { status: string; due_date: string | null }): string {
  if (t.status === "completed") return "completed";
  if (t.status === "abandoned") return "abandoned";
  if (t.due_date) {
    const d = parseDateLocal(t.due_date);
    if (d) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (d < today) return "overdue";
    }
  }
  return "pending";
}

function localTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export const TodoList = forwardRef<TodoListHandle, TodoListProps>(
  function TodoList({ filters, selectedSceneId }, ref) {
  const { todos: filteredTodos, loading, create, toggleStatus, remove, refresh } = useTodos(filters);
  const [sceneTodos, setSceneTodos] = useState<TodoWithDetails[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null)
  const todoFormRef = useRef<TodoFormHandle>(null)

  useImperativeHandle(ref, () => ({
    focusSearch: () => searchInputRef.current?.focus(),
    focusTodoForm: () => todoFormRef.current?.focus(),
  }))

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

  useEffect(() => { refreshSceneTodos(); }, [refreshSceneTodos]);

  const todos = selectedSceneId ? sceneTodos : filteredTodos;

  const handleToggle = async (id: number, status: "pending" | "completed") => {
    await toggleStatus(id, status);
    if (selectedSceneId) refreshSceneTodos();
  };

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
    }, 150)
  };
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set())
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [viewKey, setViewKey] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<TodoGroup>>(new Set(["completed"]));

  const switchView = (mode: "list" | "calendar") => {
    if (mode !== viewMode) {
      setViewMode(mode)
      setViewKey((k) => k + 1)
      setSelectedDate(null)
    }
  }

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

  const matchesFilter = (t: { title: string; description?: string | null; priority: string; status: string; due_date: string | null }) => {
    if (searchText && !t.title.toLowerCase().includes(searchText.toLowerCase()) && !(t.description || "").toLowerCase().includes(searchText.toLowerCase())) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterStatus && getEffectiveStatus(t) !== filterStatus) return false;
    return true;
  };

  const filtered = todos.filter((todo) => {
    // Subtasks are rendered under their parent — skip them as top-level items
    const parentInList = todo.parent_id && todos.some((t) => t.id === todo.parent_id);
    if (parentInList) return false;
    if (matchesFilter(todo)) return true;
    return todo.sub_tasks.some((sub) => matchesFilter(sub));
  });

  const grouped = useMemo(() => {
    const map = new Map<TodoGroup, TodoWithDetails[]>();
    for (const g of GROUP_CONFIG) map.set(g.key, []);
    for (const todo of filtered) {
      const group = getGroup(todo);
      map.get(group)!.push(todo);
    }
    return map;
  }, [filtered]);

  const toggleGroup = (key: TodoGroup) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const todosForDate = selectedDate
    ? todos.filter((t) => t.due_date && t.due_date.startsWith(selectedDate))
    : [];

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

  const statusOptions: { key: StatusFilter; label: string }[] = [
    { key: "", label: "全部" },
    { key: "pending", label: "待办" },
    { key: "overdue", label: "过期" },
    { key: "completed", label: "完成" },
    { key: "abandoned", label: "已放弃" },
  ];

  const renderTodo = (todo: TodoWithDetails) => {
    const visibleSubs = filterPriority || searchText || filterStatus
      ? todo.sub_tasks.filter((sub) => matchesFilter(sub))
      : todo.sub_tasks;
    return (
      <div key={todo.id}>
        <TodoItem
          todo={todo}
          editing={editingId === todo.id}
          animatingOut={deletingIds.has(todo.id)}
          onStartEdit={() => setEditingId(todo.id)}
          onEndEdit={() => setEditingId(null)}
          onToggle={handleToggle}
          onDelete={(id) => setDeleteId(id)}
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
                onDelete={(id) => setDeleteId(id)}
                onAddSubTask={handleAddSubTask}
                onRefresh={() => { refresh(); if (selectedSceneId) refreshSceneTodos(); }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <TodoForm ref={todoFormRef} onSubmit={handleCreate} />

      {/* Filter bar */}
      <div className="px-3 py-1.5 border-b border-surface-divider bg-background/50 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <Input
              data-testid="todo-search-input"
              ref={searchInputRef}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索..."
              className="w-full pl-7 pr-2 py-1 text-xs"
            />
          </div>
          <div className="flex items-center gap-0.5 bg-accent/50 rounded p-0.5">
            <button
              data-testid="view-toggle-list"
              onClick={() => switchView("list")}
              className={`p-1 rounded transition-colors ${viewMode === "list" ? "bg-theme text-theme-text font-medium shadow-sm rounded-md" : "text-muted-foreground hover:bg-accent rounded-md"}`}
              title="列表视图"
            >
              <List size={14} />
            </button>
            <button
              data-testid="view-toggle-calendar"
              onClick={() => switchView("calendar")}
              className={`p-1 rounded transition-colors ${viewMode === "calendar" ? "bg-theme text-theme-text font-medium shadow-sm rounded-md" : "text-muted-foreground hover:bg-accent rounded-md"}`}
              title="日历视图"
            >
              <CalendarDays size={14} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {statusOptions.map((s) => (
              <button
                key={s.key}
                data-testid={`status-filter-${s.key || "all"}`}
                onClick={() => setFilterStatus(s.key)}
                className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                  s.key === "overdue"
                    ? filterStatus === s.key ? "bg-destructive text-white" : "text-destructive/70 hover:bg-destructive/10"
                    : filterStatus === s.key ? "bg-theme text-theme-text" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="w-px h-3 bg-surface-border" />
          <div className="flex items-center gap-1">
            {(["", "high", "medium", "low"] as const).map((p) => (
              <button
                key={p}
                data-testid={`priority-filter-${p || "all"}`}
                onClick={() => setFilterPriority(p)}
                className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                  filterPriority === p ? "bg-theme text-theme-text" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {p === "" ? "全部" : p === "high" ? "高" : p === "medium" ? "中" : "低"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" key={viewKey}>
        <div className={viewKey > 0 ? "view-fade-enter" : ""}>
        {viewMode === "list" ? (
          filtered.length === 0 ? (
            todos.length === 0 ? (
              <EmptyState data-testid="empty-state" icon={<ClipboardList />} title="还没有待办事项" description="在上方输入框按回车快速添加" />
            ) : (
              <EmptyState data-testid="empty-state" icon={<SearchIcon />} title="没有找到匹配的待办" description="试试换个关键词搜索" />
            )
          ) : (
            GROUP_CONFIG.map(({ key, label, color }) => {
              const items = grouped.get(key);
              if (!items || items.length === 0) return null;
              const isCollapsed = collapsed.has(key);
              return (
                <div key={key}>
                  <button
                    onClick={() => toggleGroup(key)}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent transition-colors border-b border-surface-divider"
                  >
                    {isCollapsed ? <ChevronRight size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
                    <span className={`text-xs font-medium ${color}`}>{label}</span>
                    <span className="text-[10px] text-muted-foreground">{items.length}</span>
                  </button>
                  {!isCollapsed && items.map(renderTodo)}
                </div>
              );
            })
          )
        ) : (
          <>
            <CalendarView
              todos={todos}
              onDateSelect={setSelectedDate}
              selectedDate={selectedDate}
            />
            {selectedDate && (
              <div className="border-t border-surface-border">
                <div className="flex items-center justify-between px-3 py-1.5 bg-background">
                  <span className="text-xs font-medium text-muted-foreground">{selectedDate} 的待办</span>
                  <button data-testid="cal-clear-filter" onClick={() => setSelectedDate(null)} className="text-xs text-muted-foreground hover:text-foreground">清除筛选</button>
                </div>
                {todosForDate.length === 0 ? (
                  <EmptyState icon={<ClipboardList />} title="该日无待办" />
                ) : (
                  todosForDate.map(renderTodo)
                )}
              </div>
            )}
          </>
        )}
        </div>
      </div>
      <ConfirmDialog
        open={deleteId !== null}
        title="删除待办"
        description="确定要删除此待办吗？此操作不可撤销。"
        variant="danger"
        confirmText="删除"
        onConfirm={() => { if (deleteId) handleDelete(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
  }
)
