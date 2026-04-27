import { useState, useEffect, useRef, useCallback } from "react";
import { Sidebar } from "./components/sidebar/Sidebar";
import { TodoList } from "./components/todo/TodoList";
import { Settings } from "./components/settings/Settings";
import { SceneEditor } from "./components/scene/SceneEditor";
import { StatsView } from "./components/stats/StatsView";
import { About } from "./components/settings/About";
import { startWindowMonitor, setWidgetDefaultSize, cleanupOldSessions, saveWidgetOffset, exitApp, hideMainWindow } from "./lib/invoke";
import { notify } from "./lib/toast";
import { listen } from "@tauri-apps/api/event";
import { Toaster } from "@/components/ui/sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { TodoFilters } from "./types";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { ReminderPopup } from "./components/todo/ReminderPopup";
import type { TodoListHandle } from "./components/todo/TodoList";

type CloseAction = "prompt" | "hide" | "exit";

export default function App() {
  const [filters, setFilters] = useState<TodoFilters>({});
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [editingSceneId, setEditingSceneId] = useState<number | null>(null);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeAction, setCloseAction] = useState<"hide" | "exit">("hide");
  const [rememberClose, setRememberClose] = useState(false);

  useEffect(() => {
    startWindowMonitor().catch((e) => {
      console.error("Failed to start window monitor:", e);
      notify.error("窗口监控启动失败");
    });
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
          cleanupOldSessions(retentionDays).catch(() => {
            notify.error("清理历史数据失败");
          });
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
    } catch (e) { console.warn("Failed to load settings:", e); }
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

  const handleSmartView = useCallback((view: string) => {
    setShowSettings(false);
    setShowStats(false);
    setShowAbout(false);
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
  }, []);

  const todoListRef = useRef<TodoListHandle>(null)

  const shortcutActions = useCallback(() => ({
    newTodo: () => todoListRef.current?.focusTodoForm(),
    search: () => todoListRef.current?.focusSearch(),
    viewAll: () => handleSmartView("all"),
    viewToday: () => handleSmartView("today"),
    settings: () => { setShowSettings((s) => !s); setShowStats(false); setShowAbout(false); },
    escape: () => {
      setShowSettings(false)
      setShowStats(false)
      setShowAbout(false)
      setShowCloseDialog(false)
      setEditingSceneId(null)
    },
  }), [handleSmartView])

  useKeyboardShortcuts(shortcutActions())

  const handleSelectGroup = (groupId: number | null) => {
    setShowSettings(false);
    setShowStats(false);
    setShowAbout(false);
    setSelectedGroupId(groupId);
    setSelectedTagIds([]);
    setSelectedSceneId(null);
    setFilters(groupId ? { group_id: groupId } : {});
  };

  const handleToggleTag = (tagId: number) => {
    setShowSettings(false);
    setShowStats(false);
    setShowAbout(false);
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
    setShowAbout(false);
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
        onOpenSettings={() => { setShowSettings((s) => !s); setShowStats(false); setShowAbout(false); }}
        onOpenStats={() => { setShowStats((s) => !s); setShowSettings(false); setShowAbout(false); }}
        onOpenAbout={() => { setShowAbout((s) => !s); setShowSettings(false); setShowStats(false); }}
      />
      <main className="flex-1 overflow-auto">
        {showAbout ? (
          <About />
        ) : showSettings ? (
          <Settings />
        ) : showStats ? (
          <StatsView />
        ) : (
          <TodoList ref={todoListRef} filters={filters} selectedSceneId={selectedSceneId} />
        )}
      </main>
      {editingSceneId !== null && (
        <SceneEditor sceneId={editingSceneId} onClose={() => setEditingSceneId(null)} />
      )}

      <Dialog open={showCloseDialog} onOpenChange={(v) => { if (!v) setShowCloseDialog(false); }}>
        <DialogContent className="w-72">
          <DialogHeader>
            <DialogTitle className="text-sm">关闭确认</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">希望如何处理？</p>
          <div className="space-y-2 my-2">
            <Label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="closeAction" value="hide" checked={closeAction === "hide"} onChange={() => setCloseAction("hide")} className="accent-[var(--accent-base)]" />
              <span className="text-xs text-foreground">隐藏到系统托盘</span>
            </Label>
            <Label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="closeAction" value="exit" checked={closeAction === "exit"} onChange={() => setCloseAction("exit")} className="accent-[var(--accent-base)]" />
              <span className="text-xs text-foreground">退出程序</span>
            </Label>
          </div>
          <Label className="flex items-center gap-2 cursor-pointer">
            <Checkbox id="rememberClose" checked={rememberClose} onCheckedChange={(v) => setRememberClose(!!v)} />
            <span className="text-[11px] text-muted-foreground">记住选择，不再询问</span>
          </Label>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCloseDialog(false)}>取消</Button>
            <Button size="sm" onClick={() => {
              if (rememberClose) {
                const saved = JSON.parse(localStorage.getItem("scene-todo-settings") || "{}");
                saved.closeAction = closeAction;
                localStorage.setItem("scene-todo-settings", JSON.stringify(saved));
                window.dispatchEvent(new Event("storage"));
              }
              setShowCloseDialog(false);
              if (closeAction === "exit") exitApp();
              else hideMainWindow();
            }}>确认</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster position="bottom-right" richColors closeButton />
      <ReminderPopup />
    </div>
  );
}
