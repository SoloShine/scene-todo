import { useState, useEffect, useCallback } from "react";
import { listTodosByApp, updateTodo, createTodo, hideWidget } from "../../lib/invoke";
import type { TodoWithDetails } from "../../types";
import { WidgetTodoItem } from "./WidgetTodoItem";

interface WidgetProps {
  appId: number;
  appName: string;
}

export function Widget({ appId, appName }: WidgetProps) {
  const [todos, setTodos] = useState<TodoWithDetails[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [quickAdd, setQuickAdd] = useState("");
  const [opacity, setOpacity] = useState(85);

  const refresh = useCallback(async () => {
    try {
      const data = await listTodosByApp(appId);
      setTodos(data);
      // Auto-hide when no pending todos
      if (data.length === 0) {
        await hideWidget(appId);
      }
    } catch {
      // ignore
    }
  }, [appId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("overlay-todo-settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setOpacity(parsed.widgetOpacity ?? 85);
      }
    } catch {
      // ignore
    }
  }, []);

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

  const pendingCount = todos.reduce(
    (sum, t) => sum + 1 + t.sub_tasks.filter((s) => s.status === "pending").length,
    0
  );

  const bg = `rgba(245, 245, 245, ${opacity / 100})`;

  return (
    <div
      className="overflow-hidden"
      style={{ width: "100%", height: "100%", background: bg }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 cursor-move"
        data-tauri-drag-region
        style={{ background: `rgba(255, 255, 255, ${Math.min((opacity + 5) / 100, 1)})` }}
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
        <div className="px-2 pb-1 space-y-0.5 max-h-48 overflow-y-auto">
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
            className="w-full px-2 py-1 text-xs rounded outline-none focus:ring-1 focus:ring-blue-300"
            style={{ background: `rgba(255, 255, 255, 0.6)` }}
          />
        </div>
      )}
    </div>
  );
}
