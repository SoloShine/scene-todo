import { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listTodosByApp, updateTodo, createTodo, hideWidget, bindTodoToScene, setWidgetPassthrough } from "../../lib/invoke";
import type { TodoWithDetails } from "../../types";
import { WidgetTodoItem } from "./WidgetTodoItem";

interface SceneInfo {
  id: number;
  name: string;
  icon: string | null;
  color: string;
}

interface WidgetProps {
  appId: number;
  appName: string;
  scenes: SceneInfo[];
}

const TITLE_BAR_H = 28;
const QUICK_ADD_H = 32;

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

export function Widget({ appId, scenes }: WidgetProps) {
  const [todos, setTodos] = useState<TodoWithDetails[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [quickAdd, setQuickAdd] = useState("");
  const [opacity, setOpacity] = useState(readOpacity);
  const [passthrough, setPassthrough] = useState(false);
  const [showSceneDropdown, setShowSceneDropdown] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const outerRef = useRef<HTMLDivElement>(null);
  const todoListRef = useRef<HTMLDivElement>(null);
  const titleBarRef = useRef<HTMLDivElement>(null);
  const quickAddRef = useRef<HTMLDivElement>(null);
  const filterRowRef = useRef<HTMLDivElement>(null);
  const lastNeededH = useRef(0);

  // --- Persistence ---
  const defaultSceneKey = `widget-default-scene-${appId}`;
  const filterScenesKey = `widget-filter-scenes-${appId}`;

  const [defaultSceneId, setDefaultSceneId] = useState<number | null>(() => {
    const saved = localStorage.getItem(defaultSceneKey);
    if (saved) {
      const id = parseInt(saved, 10);
      return scenes.some(s => s.id === id) ? id : null;
    }
    return null;
  });

  const [filterSceneIds, setFilterSceneIds] = useState<number[] | null>(() => {
    const saved = localStorage.getItem(filterScenesKey);
    if (saved) {
      try {
        const ids: number[] = JSON.parse(saved);
        const valid = ids.filter(id => scenes.some(s => s.id === id));
        return valid.length > 0 ? valid : null;
      } catch { return null; }
    }
    return null;
  });

  useEffect(() => {
    localStorage.setItem(defaultSceneKey, String(defaultSceneId ?? ""));
  }, [defaultSceneId, appId]);

  useEffect(() => {
    localStorage.setItem(filterScenesKey, JSON.stringify(filterSceneIds ?? []));
  }, [filterSceneIds, appId]);

  // --- Derived ---
  const effectiveDefaultSceneId = defaultSceneId ?? scenes[0]?.id ?? null;
  const activeFilterIds = filterSceneIds ?? scenes.map(s => s.id);
  const defaultScene = scenes.find(s => s.id === effectiveDefaultSceneId);
  const remainingScenes = scenes.length > 1 ? scenes.length - 1 : 0;

  const filteredTodos = todos.filter(t =>
    t.bound_scene_ids.some(id => activeFilterIds.includes(id))
  );

  // --- Data fetching ---
  const refresh = useCallback(async () => {
    try {
      const data = await listTodosByApp(appId);
      setTodos(data);
      // Only hide if truly no todos (not just filtered out)
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

  // Close scene dropdown on outside click
  useEffect(() => {
    if (!showSceneDropdown) return;
    const handler = () => setShowSceneDropdown(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [showSceneDropdown]);

  // --- Auto-size ---
  useLayoutEffect(() => {
    const outerEl = outerRef.current;
    const borderH = outerEl ? (outerEl.offsetHeight - outerEl.clientHeight) : 0;
    const tbH = titleBarRef.current?.offsetHeight ?? TITLE_BAR_H;
    const filterH = filterRowRef.current?.offsetHeight ?? 0;
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
    const qaH = quickAddRef.current?.offsetHeight ?? 0;

    // Collapse flex to measure true content height (avoid scrollHeight >= clientHeight feedback)
    const savedFlex = el.style.flex;
    el.style.flex = "none";
    const todoH = el.scrollHeight;
    el.style.flex = savedFlex;

    const needed = tbH + filterH + todoH + qaH + borderH;
    const minH = tbH + filterH + qaH + borderH + 20;
    if (Math.abs(needed - lastNeededH.current) > 1) {
      lastNeededH.current = needed;
      invoke("resize_widget", { appId, height: needed, minHeight: minH, maxHeight: needed });
    }
  }, [filteredTodos, collapsed, passthrough, appId, showFilterPanel]);

  // --- Handlers ---
  const handleToggle = async (id: number) => {
    await updateTodo({ id, status: "completed" });
    await refresh();
  };

  const handleQuickAdd = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && quickAdd.trim()) {
      const todo = await createTodo({ title: quickAdd.trim() });
      if (effectiveDefaultSceneId !== null) {
        await bindTodoToScene(todo.id, effectiveDefaultSceneId);
      }
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

  const pendingCount = filteredTodos.reduce(
    (sum, t) => sum + 1 + t.sub_tasks.filter(s => s.status === "pending").length,
    0
  );

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
      {/* Title bar */}
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

          {/* Scene selector */}
          <div className="relative min-w-0 flex-1">
            <button
              onClick={(e) => {
                if (scenes.length > 1) {
                  e.stopPropagation();
                  setShowSceneDropdown(!showSceneDropdown);
                }
              }}
              className={`text-[11px] text-gray-700 font-medium truncate flex items-center gap-0.5 ${
                scenes.length > 1 ? "cursor-pointer hover:text-gray-900" : ""
              }`}
            >
              <span>{defaultScene?.name ?? "SceneTodo"}</span>
              {scenes.length > 1 && (
                <span className="text-[9px] text-gray-400 flex-shrink-0">▾</span>
              )}
              {remainingScenes > 0 && (
                <span className="text-[9px] text-gray-400 flex-shrink-0">+{remainingScenes}</span>
              )}
              <span className="text-[10px] text-gray-400 flex-shrink-0">({pendingCount})</span>
            </button>

            {showSceneDropdown && scenes.length > 1 && (
              <div
                className="absolute top-full left-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-0.5 min-w-[120px] max-w-[220px]"
                onClick={(e) => e.stopPropagation()}
              >
                {scenes.map(scene => (
                  <button
                    key={scene.id}
                    onClick={() => {
                      setDefaultSceneId(scene.id);
                      setShowSceneDropdown(false);
                    }}
                    className={`w-full text-left px-2 py-1 text-[11px] hover:bg-gray-50 flex items-center gap-1 ${
                      scene.id === effectiveDefaultSceneId ? "bg-blue-50 text-blue-600" : "text-gray-700"
                    }`}
                  >
                    {scene.id === effectiveDefaultSceneId && (
                      <span className="text-[9px]">✓</span>
                    )}
                    {scene.icon && <span>{scene.icon}</span>}
                    <span className="truncate">{scene.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handlePassthrough}
          className="text-[11px] px-1 rounded flex-shrink-0 text-gray-400 hover:text-blue-500 hover:bg-gray-100 transition-colors"
          title="点击穿透：鼠标可穿透浮窗操作下方应用"
        >
          📍
        </button>
      </div>

      {/* Collapsible filter row */}
      {!collapsed && scenes.length > 1 && (
        <div ref={filterRowRef}>
          <div className="px-2">
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5 w-full py-0.5"
            >
              {showFilterPanel ? "▾" : "▸"} 筛选场景
            </button>
          </div>
          {showFilterPanel && (
            <div className="px-2 pb-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {scenes.map(scene => (
                <label key={scene.id} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeFilterIds.includes(scene.id)}
                    onChange={() => {
                      setFilterSceneIds(prev => {
                        const current = prev ?? scenes.map(s => s.id);
                        return current.includes(scene.id)
                          ? current.filter(id => id !== scene.id)
                          : [...current, scene.id];
                      });
                    }}
                    className="w-3 h-3 rounded accent-blue-500"
                  />
                  {scene.icon && <span className="text-[10px]">{scene.icon}</span>}
                  <span className="text-[10px] text-gray-600">{scene.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Todo list */}
      {!collapsed && (
        <div
          ref={todoListRef}
          style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
          className="px-2 pb-1 space-y-0.5"
        >
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
            <p className="text-xs text-gray-400 text-center py-2">
              当前筛选无待办
            </p>
          )}
          {todos.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">
              No associated todos
            </p>
          )}
        </div>
      )}

      {/* Quick add */}
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
