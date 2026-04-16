import { useState } from "react";
import { Sidebar } from "./components/sidebar/Sidebar";
import { TodoList } from "./components/todo/TodoList";
import type { TodoFilters } from "./types";

export default function App() {
  const [filters, setFilters] = useState<TodoFilters>({});
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const handleSmartView = (view: string) => {
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
    setSelectedGroupId(groupId);
    setSelectedTagIds([]);
    setFilters(groupId ? { group_id: groupId } : {});
  };

  const handleToggleTag = (tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        onSmartView={handleSmartView}
        selectedGroupId={selectedGroupId}
        onSelectGroup={handleSelectGroup}
        selectedTagIds={selectedTagIds}
        onToggleTag={handleToggleTag}
      />
      <main className="flex-1 overflow-auto">
        <TodoList filters={filters} selectedTagIds={selectedTagIds} />
      </main>
    </div>
  );
}
