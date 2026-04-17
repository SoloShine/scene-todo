import { useState, useMemo } from "react";
import { List, CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import { useTodos } from "../../hooks/useTodos";
import { TodoForm } from "./TodoForm";
import { TodoItem, parseDateLocal } from "./TodoItem";
import { CalendarView } from "./CalendarView";
import type { TodoFilters, TodoWithDetails } from "../../types";

type StatusFilter = "" | "pending" | "overdue" | "completed";
type TodoGroup = "overdue" | "today" | "upcoming" | "undated" | "completed";

interface TodoListProps {
  filters: TodoFilters;
  selectedSceneId?: number | null;
}

const GROUP_CONFIG: { key: TodoGroup; label: string; color: string }[] = [
  { key: "overdue", label: "过期", color: "text-red-500" },
  { key: "today", label: "今天", color: "text-blue-500" },
  { key: "upcoming", label: "未开始", color: "text-gray-500" },
  { key: "undated", label: "无日期", color: "text-gray-400" },
  { key: "completed", label: "已结束", color: "text-green-500" },
];

function getGroup(todo: TodoWithDetails): TodoGroup {
  if (todo.status === "completed") return "completed";
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

export function TodoList({ filters, selectedSceneId: _selectedSceneId }: TodoListProps) {
  const { todos, loading, create, toggleStatus, remove, refresh } = useTodos(filters);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<TodoGroup>>(new Set(["completed"]));

  const handleCreate = (title: string) => {
    create({ title, due_date: localTodayKey() + "T23:59" });
  };

  const handleAddSubTask = (parentId: number, title: string) => {
    create({ title, parent_id: parentId, due_date: localTodayKey() + "T23:59" });
  };

  const matchesFilter = (t: { title: string; description?: string | null; priority: string; status: string; due_date: string | null }) => {
    if (searchText && !t.title.toLowerCase().includes(searchText.toLowerCase()) && !(t.description || "").toLowerCase().includes(searchText.toLowerCase())) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterStatus && getEffectiveStatus(t) !== filterStatus) return false;
    return true;
  };

  const filtered = todos.filter((todo) => {
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
    return <div className="p-4 text-sm text-gray-500">加载中...</div>;
  }

  const statusOptions: { key: StatusFilter; label: string }[] = [
    { key: "", label: "全部" },
    { key: "pending", label: "待办" },
    { key: "overdue", label: "过期" },
    { key: "completed", label: "完成" },
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
          onStartEdit={() => setEditingId(todo.id)}
          onEndEdit={() => setEditingId(null)}
          onToggle={toggleStatus}
          onDelete={remove}
          onAddSubTask={handleAddSubTask}
          onRefresh={refresh}
        />
        {visibleSubs.length > 0 && (
          <div className="ml-6">
            {visibleSubs.map((sub) => (
              <TodoItem
                key={sub.id}
                todo={sub}
                editing={editingId === sub.id}
                onStartEdit={() => setEditingId(sub.id)}
                onEndEdit={() => setEditingId(null)}
                onToggle={toggleStatus}
                onDelete={remove}
                onAddSubTask={handleAddSubTask}
                onRefresh={refresh}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <TodoForm onSubmit={handleCreate} />

      {/* Filter bar */}
      <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50/50 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索..."
              className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md outline-none focus:border-blue-300"
            />
          </div>
          <div className="flex items-center gap-0.5 bg-gray-100 rounded p-0.5">
            <button
              onClick={() => { setViewMode("list"); setSelectedDate(null); }}
              className={`p-1 rounded transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-gray-700" : "text-gray-400"}`}
              title="列表视图"
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`p-1 rounded transition-colors ${viewMode === "calendar" ? "bg-white shadow-sm text-gray-700" : "text-gray-400"}`}
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
                onClick={() => setFilterStatus(s.key)}
                className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                  s.key === "overdue"
                    ? filterStatus === s.key ? "bg-red-500 text-white" : "text-red-400 hover:bg-red-50"
                    : filterStatus === s.key ? "bg-blue-500 text-white" : "text-gray-400 hover:bg-gray-100"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="w-px h-3 bg-gray-200" />
          <div className="flex items-center gap-1">
            {(["", "high", "medium", "low"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                  filterPriority === p ? "bg-blue-500 text-white" : "text-gray-400 hover:bg-gray-100"
                }`}
              >
                {p === "" ? "全部" : p === "high" ? "高" : p === "medium" ? "中" : "低"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {viewMode === "list" ? (
          filtered.length === 0 ? (
            <div className="p-4 text-sm text-gray-400 text-center">
              {todos.length === 0 ? "没有待办事项" : "没有匹配的待办"}
            </div>
          ) : (
            GROUP_CONFIG.map(({ key, label, color }) => {
              const items = grouped.get(key);
              if (!items || items.length === 0) return null;
              const isCollapsed = collapsed.has(key);
              return (
                <div key={key}>
                  <button
                    onClick={() => toggleGroup(key)}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-gray-50 transition-colors border-b border-gray-100"
                  >
                    {isCollapsed ? <ChevronRight size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
                    <span className={`text-xs font-medium ${color}`}>{label}</span>
                    <span className="text-[10px] text-gray-300">{items.length}</span>
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
              <div className="border-t border-gray-200">
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50">
                  <span className="text-xs font-medium text-gray-600">{selectedDate} 的待办</span>
                  <button onClick={() => setSelectedDate(null)} className="text-xs text-gray-400 hover:text-gray-600">清除筛选</button>
                </div>
                {todosForDate.length === 0 ? (
                  <div className="p-4 text-sm text-gray-400 text-center">该日无待办</div>
                ) : (
                  todosForDate.map(renderTodo)
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
