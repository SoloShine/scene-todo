import { useState, useEffect, useCallback } from "react";
import { listTodosByApp, updateTodo, createTodo, hideWidget, bindTodoToApp } from "../../lib/invoke";
import type { TodoWithDetails } from "../../types";
import { WidgetTodoItem } from "./WidgetTodoItem";

interface WidgetProps {
  appId: number;
  appName: string;
}

function readOpacity(): number {
  try {
    const saved = localStorage.getItem("scene-todo-settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.widgetOpacity ?? 85;
    }
  } catch {}
  return 85;
}

export function Widget({ appId }: WidgetProps) {
  const [todos, setTodos] = useState<TodoWithDetails[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [quickAdd, setQuickAdd] = useState("");
  const [opacity, setOpacity] = useState(readOpacity);

  const refresh = useCallback(async () => {
    try {
      const data = await listTodosByApp(appId);
      setTodos(data);
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

  // Force body transparent + listen for opacity changes from Settings
  useEffect(() => {
    document.documentElement.style.setProperty("background", "transparent", "important");
    document.body.style.setProperty("background", "transparent", "important");
    const root = document.getElementById("root");
    if (root) root.style.setProperty("background", "transparent", "important");

    const onStorage = () => setOpacity(readOpacity());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleToggle = async (id: number) => {
    await updateTodo({ id, status: "completed" });
    await refresh();
  };

  const handleQuickAdd = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && quickAdd.trim()) {
      const todo = await createTodo({ title: quickAdd.trim() });
      await bindTodoToApp(todo.id, appId);
      setQuickAdd("");
      await refresh();
    }
  };

  const pendingCount = todos.reduce(
    (sum, t) => sum + 1 + t.sub_tasks.filter((s) => s.status === "pending").length,
    0
  );

  const bgAlpha = opacity / 100;

  return (
    <div
      className="overflow-hidden"
      style={{
        width: "100%",
        height: "100%",
        background: `rgba(255, 255, 255, ${bgAlpha})`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: "10px",
        border: "1px solid rgba(200, 200, 200, 0.3)",
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 cursor-move"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2" data-tauri-drag-region>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-gray-600 text-xs"
          >
            {collapsed ? "\u25B8" : "\u25BE"}
          </button>
          <span className="text-[10px] text-gray-500">({pendingCount})</span>
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
            style={{ background: "rgba(255, 255, 255, 0.5)" }}
          />
        </div>
      )}
    </div>
  );
}
