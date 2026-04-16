import { useState } from "react";
import { useGroups } from "../../hooks/useGroups";

interface GroupListProps {
  selectedGroupId: number | null;
  onSelectGroup: (groupId: number | null) => void;
}

export function GroupList({ selectedGroupId, onSelectGroup }: GroupListProps) {
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
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-2 py-1">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">分组</h3>
        <button
          onClick={() => setShowInput(true)}
          className="text-gray-400 hover:text-gray-600 text-sm"
        >
          +
        </button>
      </div>

      {showInput && (
        <div className="px-2 pb-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            onBlur={() => { if (!newName.trim()) setShowInput(false); }}
            placeholder="分组名称..."
            autoFocus
            className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
          />
        </div>
      )}

      <button
        onClick={() => onSelectGroup(null)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
          selectedGroupId === null ? "bg-blue-50 text-blue-700" : "hover:bg-gray-100"
        }`}
      >
        全部待办
      </button>

      {groups.map((group) => (
        <div
          key={group.id}
          className={`group flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer transition-colors ${
            selectedGroupId === group.id ? "bg-blue-50 text-blue-700" : "hover:bg-gray-100"
          }`}
          onClick={() => onSelectGroup(group.id)}
        >
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: group.color }}
          />
          <span className="flex-1 truncate">{group.name}</span>
          <button
            onClick={(e) => { e.stopPropagation(); remove(group.id); }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
