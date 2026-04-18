import { useState, useEffect } from "react";
import { Sidebar } from "./components/sidebar/Sidebar";
import { TodoList } from "./components/todo/TodoList";
import { Settings } from "./components/settings/Settings";
import { SceneEditor } from "./components/scene/SceneEditor";
import { StatsView } from "./components/stats/StatsView";
import { startWindowMonitor, setWidgetDefaultSize, cleanupOldSessions, saveWidgetOffset, exitApp, hideMainWindow } from "./lib/invoke";
import { listen } from "@tauri-apps/api/event";
import type { TodoFilters } from "./types";

type CloseAction = "prompt" | "hide" | "exit";

export default function App() {
  const [filters, setFilters] = useState<TodoFilters>({});
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [editingSceneId, setEditingSceneId] = useState<number | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);

  useEffect(() => {
    startWindowMonitor().catch((e) =>
      console.error("Failed to start window monitor:", e)
    );
    try {
      const saved = localStorage.getItem("scene-todo-settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        const size = parsed.widgetSize ?? "medium";
        const sizeMap: Record<string, [number, number]> = {
          small: [200, 240],
          medium: [260, 300],
          large: [340, 400],
        };
        const [w, h] = sizeMap[size] || sizeMap.medium;
        setWidgetDefaultSize(w, h);

        // Cleanup old time sessions based on retention setting
        const retentionDays = parsed.retentionDays ?? 90;
        if (typeof retentionDays === "number" && retentionDays > 0) {
          cleanupOldSessions(retentionDays).catch(() => {});
        }
      }

      // Send saved widget offsets to backend on startup
      const savedOffsets = localStorage.getItem("scene-todo-widget-offsets");
      if (savedOffsets) {
        const offsets = JSON.parse(savedOffsets);
        for (const [appId, off] of Object.entries(offsets)) {
          const { x, y } = off as { x: number; y: number };
          saveWidgetOffset(Number(appId), x, y).catch(() => {});
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    const unlisten = listen("close-requested", () => {
      const saved = localStorage.getItem("scene-todo-settings");
      const closeAction: CloseAction = saved ? JSON.parse(saved).closeAction ?? "prompt" : "prompt";
      if (closeAction === "hide") {
        hideMainWindow();
      } else if (closeAction === "exit") {
        exitApp();
      } else {
        setShowCloseDialog(true);
      }
    });
    return () => { unlisten.then((f) => f()); };
  }, []);

  const handleSmartView = (view: string) => {
    setShowSettings(false);
    setShowStats(false);
    setSelectedGroupId(null);
    setSelectedTagIds([]);
    setSelectedSceneId(null);
    switch (view) {
      case "all":
        setFilters({});
        break;
      case "today":
        const now = new Date();
        setFilters({ due_before: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}` });
        break;
    }
  };

  const handleSelectGroup = (groupId: number | null) => {
    setShowSettings(false);
    setShowStats(false);
    setSelectedGroupId(groupId);
    setSelectedTagIds([]);
    setSelectedSceneId(null);
    setFilters(groupId ? { group_id: groupId } : {});
  };

  const handleToggleTag = (tagId: number) => {
    setShowSettings(false);
    setShowStats(false);
    setSelectedGroupId(null);
    setSelectedTagIds((prev) => {
      const next = prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId];
      setFilters(next.length > 0 ? { tag_id: next[0] } : {});
      return next;
    });
  };

  const handleSelectScene = (sceneId: number | null) => {
    setShowSettings(false);
    setShowStats(false);
    setSelectedGroupId(null);
    setSelectedTagIds([]);
    setSelectedSceneId(sceneId);
    setFilters({});
  };

  const handleEditScene = (sceneId: number) => {
    setEditingSceneId(sceneId);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        onSmartView={handleSmartView}
        selectedGroupId={selectedGroupId}
        onSelectGroup={handleSelectGroup}
        selectedTagIds={selectedTagIds}
        onToggleTag={handleToggleTag}
        selectedSceneId={selectedSceneId}
        onSelectScene={handleSelectScene}
        onEditScene={handleEditScene}
        onOpenSettings={() => { setShowSettings((s) => !s); setShowStats(false); }}
        onOpenStats={() => { setShowStats((s) => !s); setShowSettings(false); }}
      />
      <main className="flex-1 overflow-auto">
        {showSettings ? (
          <Settings />
        ) : showStats ? (

          <StatsView />
        ) : (
          <TodoList filters={filters} selectedSceneId={selectedSceneId} />
        )}
      </main>
      {editingSceneId !== null && (
        <SceneEditor sceneId={editingSceneId} onClose={() => setEditingSceneId(null)} />
      )}

      {/* Close confirmation dialog */}
      {showCloseDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border border-surface-border p-5 w-72 shadow-xl">
            <h3 className="text-sm font-semibold text-foreground mb-3">关闭确认</h3>
            <p className="text-xs text-muted-foreground mb-4">希望如何处理？</p>
            <div className="space-y-2 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="closeAction" value="hide" defaultChecked className="accent-[var(--accent-base)]" />
                <span className="text-xs text-foreground">隐藏到系统托盘</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="closeAction" value="exit" className="accent-[var(--accent-base)]" />
                <span className="text-xs text-foreground">退出程序</span>
              </label>
            </div>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" id="rememberClose" className="accent-[var(--accent-base)]" />
              <span className="text-[11px] text-muted-foreground">记住选择，不再询问</span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCloseDialog(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-surface-border hover:bg-accent"
              >
                取消
              </button>
              <button
                onClick={() => {
                  const form = document.querySelector('input[name="closeAction"]:checked') as HTMLInputElement;
                  const action = form?.value ?? "hide";
                  const remember = (document.getElementById("rememberClose") as HTMLInputElement)?.checked;
                  if (remember) {
                    const saved = JSON.parse(localStorage.getItem("scene-todo-settings") || "{}");
                    saved.closeAction = action;
                    localStorage.setItem("scene-todo-settings", JSON.stringify(saved));
                  }
                  setShowCloseDialog(false);
                  if (action === "exit") exitApp();
                  else hideMainWindow();
                }}
                className="px-3 py-1.5 text-xs rounded-lg bg-theme text-theme-text hover:opacity-90"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
