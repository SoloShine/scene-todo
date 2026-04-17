import { useState, useEffect } from "react";
import { Sidebar } from "./components/sidebar/Sidebar";
import { TodoList } from "./components/todo/TodoList";
import { Settings } from "./components/settings/Settings";
import { startWindowMonitor, setWidgetDefaultSize } from "./lib/invoke";
import type { TodoFilters } from "./types";

export default function App() {
  const [filters, setFilters] = useState<TodoFilters>({});
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    startWindowMonitor().catch((e) =>
      console.error("Failed to start window monitor:", e)
    );
    // Sync initial widget size to backend
    try {
      const saved = localStorage.getItem("overlay-todo-settings");
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
      }
    } catch {}
  }, []);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const handleSmartView = (view: string) => {
    setShowSettings(false);
    setSelectedGroupId(null);
    setSelectedTagIds([]);
    switch (view) {
      case "all":
        setFilters({});
        break;
      case "today":
        setFilters({ due_before: new Date().toISOString().split("T")[0] });
        break;
      case "important":
        setFilters({ priority: "high" });
        break;
    }
  };

  const handleSelectGroup = (groupId: number | null) => {
    setShowSettings(false);
    setSelectedGroupId(groupId);
    setSelectedTagIds([]);
    setFilters(groupId ? { group_id: groupId } : {});
  };

  const handleToggleTag = (tagId: number) => {
    setShowSettings(false);
    setSelectedGroupId(null);
    setSelectedTagIds((prev) => {
      const next = prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId];
      setFilters(next.length > 0 ? { tag_id: next[0] } : {});
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        onSmartView={handleSmartView}
        selectedGroupId={selectedGroupId}
        onSelectGroup={handleSelectGroup}
        selectedTagIds={selectedTagIds}
        onToggleTag={handleToggleTag}
        onOpenSettings={() => setShowSettings((s) => !s)}
      />
      <main className="flex-1 overflow-auto">
        {showSettings ? (
          <Settings onClose={() => setShowSettings(false)} />
        ) : (
          <TodoList filters={filters} />
        )}
      </main>
    </div>
  );
}
