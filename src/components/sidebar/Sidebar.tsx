import { SmartViews } from "./SmartViews";
import { GroupList } from "./GroupList";
import { TagList } from "./TagList";
import { SceneList } from "./SceneList";

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
  return (
    <aside className="w-60 border-r border-gray-200 bg-white flex flex-col">
      <div className="p-3 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-800">SceneTodo</h1>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        <SmartViews onSmartView={onSmartView} />
        <SceneList
          selectedSceneId={selectedSceneId}
          onSelectScene={onSelectScene}
          onEditScene={onEditScene}
        />
        <GroupList
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
        />
        <TagList
          selectedTagIds={selectedTagIds}
          onToggleTag={onToggleTag}
        />
      </nav>
      <div className="p-2 border-t border-gray-200 space-y-0.5">
        <button
          onClick={onOpenStats}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 rounded hover:bg-gray-100"
        >
          <span>&#128202;</span>
          <span>统计</span>
        </button>
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 rounded hover:bg-gray-100"
        >
          <span>&#9881;</span>
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}
