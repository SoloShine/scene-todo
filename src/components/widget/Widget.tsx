import { useState, useEffect, useCallback } from "react";
import { WidgetTodoItem } from "./WidgetTodoItem";
import { listTodosByApp, updateTodo, createTodo } from "../../lib/invoke";
import type { TodoWithDetails } from "../../types";

interface WidgetProps {
  appId: number;
  appName: string;
}

export function Widget({ appId, appName }: WidgetProps) {
  const [todos, setTodos] = useState<TodoWithDetails[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [quickAdd, setQuickAdd] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await listTodosByApp(appId);
      setTodos(data);
    } catch (e) {
      console.error("Failed to load widget todos:", e);
    }
  }, [appId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggle = async (id: number) => {
    await updateTodo({ id, status: "completed" });
    await refresh();
  };

  const handleQuickAdd = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && quickAdd.trim()) {
      await createTodo({ title: quickAdd.trim() });
      setQuickAdd("");
      await refresh();
    }
  };

  const pendingCount = todos.reduce((sum, t) => {
    return sum + 1 + t.sub_tasks.filter((s) => s.status === "pending").length;
  }, 0);

  return (
    <div
      className="bg-gray-100/90 backdrop-blur rounded-lg shadow-lg overflow-hidden"
      style={{ width: 260 }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-white/80 cursor-move"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-gray-600 text-xs"
          >
            {collapsed ? "\u25B8" : "\u25BE"}
          </button>
          <span className="text-xs font-medium text-gray-700">{appName}</span>
          <span className="text-[10px] text-gray-400">({pendingCount})</span>
        </div>
      </div>

      {/* Todo list */}
      {!collapsed && (
        <div className="p-2 space-y-0.5 max-h-60 overflow-y-auto">
          {todos.map((todo) => (
            <div key={todo.id}>
              <WidgetTodoItem todo={todo} onToggle={handleToggle} />
              {todo.sub_tasks.map((sub) => (
                <div key={sub.id} className="ml-4">
                  <WidgetTodoItem todo={sub} onToggle={handleToggle} />
                </div>
              ))}
            </div>
          ))}
          {todos.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">
              No associated todos
            </p>
          )}
        </div>
      )}

      {/* Quick add */}
      {!collapsed && (
        <div className="px-2 pb-2">
          <input
            value={quickAdd}
            onChange={(e) => setQuickAdd(e.target.value)}
            onKeyDown={handleQuickAdd}
            placeholder="Quick add..."
            className="w-full px-2 py-1 text-xs bg-white/60 rounded border border-gray-200 outline-none focus:border-blue-400"
          />
        </div>
      )}
    </div>
  );
}
