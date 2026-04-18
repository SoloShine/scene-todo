import { useState } from "react";
import { SmartViews } from "./SmartViews";
import { GroupList } from "./GroupList";
import { TagList } from "./TagList";
import { SceneList } from "./SceneList";

const STORAGE_KEY = "scene-todo-sidebar-state";

function loadCollapseState(): { scenes: boolean; groups: boolean; tags: boolean } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { scenes: false, groups: false, tags: false };
}

function saveCollapseState(state: { scenes: boolean; groups: boolean; tags: boolean }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

interface SidebarProps {
  onSmartView: (view: string) => void;
  selectedGroupId: number | null;
  onSelectGroup: (groupId: number | null) => void;
  selectedTagIds: number[];
  onToggleTag: (tagId: number) => void;
  selectedSceneId: number | null;
  onSelectScene: (sceneId: number | null) => void;
  onEditScene: (sceneId: number) => void;
  onOpenSettings: () => void;
  onOpenStats: () => void;
}

export function Sidebar({
  onSmartView, selectedGroupId, onSelectGroup,
  selectedTagIds, onToggleTag,
  selectedSceneId, onSelectScene, onEditScene,
  onOpenSettings, onOpenStats,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(loadCollapseState);

  const toggleSection = (key: keyof typeof collapsed) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveCollapseState(next);
      return next;
    });
  };

  return (
    <aside className="w-60 border-r border-sidebar-border bg-sidebar flex flex-col">
      <div className="h-[34px] flex-shrink-0" />
      <nav className="flex-1 overflow-y-auto p-1 space-y-2">
        <SmartViews onSmartView={onSmartView} />
        <SceneList
          selectedSceneId={selectedSceneId}
          onSelectScene={onSelectScene}
          onEditScene={onEditScene}
          collapsed={collapsed.scenes}
          onToggleCollapse={() => toggleSection("scenes")}
        />
        <GroupList
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
          collapsed={collapsed.groups}
          onToggleCollapse={() => toggleSection("groups")}
        />
        <TagList
          selectedTagIds={selectedTagIds}
          onToggleTag={onToggleTag}
          collapsed={collapsed.tags}
          onToggleCollapse={() => toggleSection("tags")}
        />
      </nav>
      <div className="p-2 border-t border-sidebar-border flex gap-1">
        <button
          onClick={onOpenStats}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground rounded-md hover:bg-accent transition-colors"
        >
          <span>📊</span>
          <span>统计</span>
        </button>
        <button
          onClick={onOpenSettings}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground rounded-md hover:bg-accent transition-colors"
        >
          <span>⚙</span>
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}
