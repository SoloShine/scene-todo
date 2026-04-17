import { useState } from "react";
import { useTodos } from "../../hooks/useTodos";
import { TodoForm } from "./TodoForm";
import { TodoItem } from "./TodoItem";
import type { TodoFilters } from "../../types";

interface TodoListProps {
  filters: TodoFilters;
}

export function TodoList({ filters }: TodoListProps) {
  const { todos, loading, create, toggleStatus, remove, refresh } = useTodos(filters);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("");

  const handleCreate = (title: string) => {
    create({ title });
  };

  const handleAddSubTask = (parentId: number, title: string) => {
    create({ title, parent_id: parentId });
  };

  const matchesFilter = (t: { title: string; description?: string | null; priority: string }) => {
    if (searchText && !t.title.toLowerCase().includes(searchText.toLowerCase()) && !(t.description || "").toLowerCase().includes(searchText.toLowerCase())) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  };

  const filtered = todos.filter((todo) => {
    if (matchesFilter(todo)) return true;
    return todo.sub_tasks.some((sub) => matchesFilter(sub));
  });

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">加载中...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <TodoForm onSubmit={handleCreate} />

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 bg-gray-50/50">
        <div className="flex-1 relative">
          <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索..."
            className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded-md outline-none focus:border-blue-300"
          />
        </div>
        <div className="flex items-center gap-1">
          {(["", "high", "medium", "low"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                filterPriority === p
                  ? "bg-blue-500 text-white"
                  : "text-gray-400 hover:bg-gray-100"
              }`}
            >
              {p === "" ? "全部" : p === "high" ? "高" : p === "medium" ? "中" : "低"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-sm text-gray-400 text-center">
            {todos.length === 0 ? "没有待办事项" : "没有匹配的待办"}
          </div>
        ) : (
          filtered.map((todo) => {
            const visibleSubs = filterPriority || searchText
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
          })
        )}
      </div>
    </div>
  );
}
