import { useState, useEffect } from "react";
import { Sidebar } from "./components/sidebar/Sidebar";
import { TodoList } from "./components/todo/TodoList";
import { Settings } from "./components/settings/Settings";
import { SceneEditor } from "./components/scene/SceneEditor";
import { StatsView } from "./components/stats/StatsView";
import { startWindowMonitor, setWidgetDefaultSize, cleanupOldSessions } from "./lib/invoke";
import type { TodoFilters } from "./types";

export default function App() {
  const [filters, setFilters] = useState<TodoFilters>({});
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [editingSceneId, setEditingSceneId] = useState<number | null>(null);

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
    } catch {}
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
          <Settings onClose={() => setShowSettings(false)} />
        ) : showStats ? (
          <StatsView />
        ) : (
          <TodoList filters={filters} selectedSceneId={selectedSceneId} />
        )}
      </main>
      {editingSceneId !== null && (
        <SceneEditor sceneId={editingSceneId} onClose={() => setEditingSceneId(null)} />
      )}
    </div>
  );
}
