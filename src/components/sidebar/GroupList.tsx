import { useState } from "react";
import { useGroups } from "../../hooks/useGroups";
import { SectionHeader } from "./SectionHeader";

interface GroupListProps {
  selectedGroupId: number | null;
  onSelectGroup: (groupId: number | null) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function GroupList({ selectedGroupId, onSelectGroup, collapsed, onToggleCollapse }: GroupListProps) {
  const { groups, create, remove } = useGroups();
  const [newName, setNewName] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await create({ name: newName.trim() });
    setNewName("");
    setShowInput(false);
  };

  return (
    <div>
      <SectionHeader title="分组" count={groups.length} collapsed={collapsed} onToggle={onToggleCollapse} onAdd={() => setShowInput(true)} />
      {!collapsed && (
        <div className="px-1 pb-1">
          {showInput && (
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              onBlur={() => { if (!newName.trim()) setShowInput(false); }}
              placeholder="分组名称..."
              autoFocus
              className="w-full px-2 py-1 text-xs border border-surface-border bg-background focus:border-theme-border outline-none rounded-md mb-0.5"
            />
          )}
          <button
            onClick={() => onSelectGroup(null)}
            className={`w-full flex items-center gap-2 px-2 py-1 text-xs rounded transition-colors ${
              selectedGroupId === null ? "bg-theme-bg text-theme" : "hover:bg-accent text-muted-foreground"
            }`}
          >
            全部待办
          </button>
          {groups.map((group) => (
            <div
              key={group.id}
              className={`group flex items-center gap-2 px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
                selectedGroupId === group.id ? "bg-theme-bg text-theme" : "hover:bg-accent text-muted-foreground"
              }`}
              onClick={() => onSelectGroup(group.id)}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/20" style={{ backgroundColor: group.color }} />
              <span className="flex-1 truncate">{group.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); remove(group.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground/70 hover:text-destructive text-[10px]"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
