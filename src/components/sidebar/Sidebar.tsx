import { SmartViews } from "./SmartViews";
import { GroupList } from "./GroupList";
import { TagList } from "./TagList";

interface SidebarProps {
  onSmartView: (view: string) => void;
  selectedGroupId: number | null;
  onSelectGroup: (groupId: number | null) => void;
  selectedTagIds: number[];
  onToggleTag: (tagId: number) => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  onSmartView, selectedGroupId, onSelectGroup,
  selectedTagIds, onToggleTag, onOpenSettings,
}: SidebarProps) {
  return (
    <aside className="w-60 border-r border-gray-200 bg-white flex flex-col">
      <div className="p-3 border-b border-gray-200">
        <h1 className="text-lg font-bold text-gray-800">SceneTodo</h1>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        <SmartViews onSmartView={onSmartView} />
        <GroupList
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
        />
        <TagList
          selectedTagIds={selectedTagIds}
          onToggleTag={onToggleTag}
        />
      </nav>
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 rounded hover:bg-gray-100"
        >
          <span>⚙</span>
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}
