import { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listTodosByApp, updateTodo, createTodo, hideWidget, bindTodoToScene, setWidgetPassthrough } from "../../lib/invoke";
import type { TodoWithDetails } from "../../types";
import { WidgetTodoItem } from "./WidgetTodoItem";

interface WidgetProps {
  appId: number;
  appName: string;
  sceneNames: string[];
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

const TITLE_BAR_H = 28;
const QUICK_ADD_H = 32;

export function Widget({ appId, sceneNames }: WidgetProps) {
  const [todos, setTodos] = useState<TodoWithDetails[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [quickAdd, setQuickAdd] = useState("");
  const [opacity, setOpacity] = useState(readOpacity);
  const [passthrough, setPassthrough] = useState(false);
  const outerRef = useRef<HTMLDivElement>(null);
  const todoListRef = useRef<HTMLDivElement>(null);
  const titleBarRef = useRef<HTMLDivElement>(null);
  const quickAddRef = useRef<HTMLDivElement>(null);
  const lastNeededH = useRef(0);

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

  useEffect(() => {
    document.documentElement.style.setProperty("background", "transparent", "important");
    document.body.style.setProperty("background", "transparent", "important");
    const root = document.getElementById("root");
    if (root) root.style.setProperty("background", "transparent", "important");

    const onStorage = () => setOpacity(readOpacity());
    window.addEventListener("storage", onStorage);

    const onPassthroughDisabled = () => setPassthrough(false);
    window.addEventListener("passthrough-disabled", onPassthroughDisabled);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("passthrough-disabled", onPassthroughDisabled);
    };
  }, []);

  // Auto-size: sync measurement after DOM commit, skip if unchanged
  useLayoutEffect(() => {
    const outerEl = outerRef.current;
    const borderH = outerEl ? (outerEl.offsetHeight - outerEl.clientHeight) : 0;
    const tbH = (titleBarRef.current?.offsetHeight ?? TITLE_BAR_H);
    if (collapsed) {
      const h = tbH + borderH;
      if (lastNeededH.current !== h) {
        lastNeededH.current = h;
        invoke("resize_widget", { appId, height: h, minHeight: h, maxHeight: h });
      }
      return;
    }
    const el = todoListRef.current;
    if (!el) return;
    // useLayoutEffect fires after DOM commit; reading scrollHeight forces
    // a synchronous reflow, giving accurate measurements.
    const todoH = el.scrollHeight;
    const qaH = quickAddRef.current?.offsetHeight ?? 0;
    const needed = tbH + todoH + qaH + borderH;
    // minH includes a small floor for todo area so scrollbar can render
    const minH = tbH + qaH + borderH + 20;
    console.log(
      `[Widget ${appId}] tbH=${tbH} todoScrollH=${todoH} qaH=${qaH} borderH=${borderH}` +
      ` needed=${needed} minH=${minH} todos=${todos.length}`
    );
    if (needed !== lastNeededH.current) {
      lastNeededH.current = needed;
      invoke("resize_widget", { appId, height: needed, minHeight: minH, maxHeight: needed });
    }
  }, [todos, collapsed, passthrough, appId]);

  const handleToggle = async (id: number) => {
    await updateTodo({ id, status: "completed" });
    await refresh();
  };

  const handleQuickAdd = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && quickAdd.trim()) {
      const todo = await createTodo({ title: quickAdd.trim() });
      await bindTodoToScene(todo.id, appId);
      setQuickAdd("");
      await refresh();
    }
  };

  const handlePassthrough = async () => {
    if (!passthrough) {
      setPassthrough(true);
      await setWidgetPassthrough(appId, true);
    }
  };

  const pendingCount = todos.reduce(
    (sum, t) => sum + 1 + t.sub_tasks.filter((s) => s.status === "pending").length,
    0
  );

  const title = sceneNames.length > 0 ? sceneNames.join(" · ") : "SceneTodo";
  const bgAlpha = opacity / 100;

  return (
    <div
      ref={outerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: `rgba(255, 255, 255, ${bgAlpha})`,
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: "10px",
        border: passthrough
          ? "1px dashed rgba(100, 149, 237, 0.5)"
          : "1px solid rgba(200, 200, 200, 0.3)",
        transition: "border 0.2s",
      }}
    >
      {/* Title bar — fixed */}
      <div
        ref={titleBarRef}
        className="flex items-center justify-between px-2 py-1 cursor-move"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-1 min-w-0 flex-1" data-tauri-drag-region>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-500 hover:text-gray-700 text-[10px] flex-shrink-0"
          >
            {collapsed ? "\u25B8" : "\u25BE"}
          </button>
          <span className="text-[11px] text-gray-700 font-medium truncate" title={title}>
            {title}
          </span>
          <span className="text-[10px] text-gray-400 flex-shrink-0">({pendingCount})</span>
        </div>
        <button
          onClick={handlePassthrough}
          className="text-[11px] px-1 rounded flex-shrink-0 text-gray-400 hover:text-blue-500 hover:bg-gray-100 transition-colors"
          title="点击穿透：鼠标可穿透浮窗操作下方应用"
        >
          📍
        </button>
      </div>

      {/* Todo list — fills available space, scrolls when window is small */}
      {!collapsed && (
        <div
          ref={todoListRef}
          style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
          className="px-2 pb-1 space-y-0.5"
        >
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

      {/* Quick add — always at bottom when visible */}
      {!collapsed && !passthrough && (
        <div ref={quickAddRef} className="px-2 pb-2 flex-shrink-0">
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
