import { useState, useRef, useEffect } from "react";
import { BarChart3, Settings, Info, MoreVertical } from "lucide-react";
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
  onOpenAbout: () => void;
}

export function Sidebar({
  onSmartView, selectedGroupId, onSelectGroup,
  selectedTagIds, onToggleTag,
  selectedSceneId, onSelectScene, onEditScene,
  onOpenSettings, onOpenStats, onOpenAbout,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(loadCollapseState);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const toggleSection = (key: keyof typeof collapsed) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveCollapseState(next);
      return next;
    });
  };

  return (
    <aside className="w-60 border-r border-sidebar-border bg-sidebar flex flex-col">
      <div data-tauri-drag-region className="h-[34px] flex-shrink-0 flex items-center gap-2 px-3 select-none">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-theme to-theme-light flex items-center justify-center text-white text-[10px] font-bold">S</div>
        <span className="text-[10px] text-sidebar-foreground/50 tracking-wide">场景化任务管理</span>
      </div>
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
      <div ref={menuRef} className="relative flex items-center justify-end px-2 py-1.5">
        <button
          data-testid="sidebar-menu-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1 rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent transition-colors"
        >
          <MoreVertical size={14} />
        </button>
        {menuOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-card rounded-lg border border-surface-border shadow-lg py-1 z-50">
            <button
              data-testid="sidebar-menu-stats"
              onClick={() => { setMenuOpen(false); onOpenStats(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
            >
              <BarChart3 size={14} />统计
            </button>
            <button
              data-testid="sidebar-menu-settings"
              onClick={() => { setMenuOpen(false); onOpenSettings(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
            >
              <Settings size={14} />设置
            </button>
            <button
              data-testid="sidebar-menu-about"
              onClick={() => { setMenuOpen(false); onOpenAbout(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
            >
              <Info size={14} />关于
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
