import { useState } from "react";
import { useTags } from "../../hooks/useTags";

interface TagListProps {
  selectedTagIds: number[];
  onToggleTag: (tagId: number) => void;
}

export function TagList({ selectedTagIds, onToggleTag }: TagListProps) {
  const { tags, create, remove } = useTags();
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
        <h3 className="text-xs font-semibold text-gray-500 uppercase">标签</h3>
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
            placeholder="标签名称..."
            autoFocus
            className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
          />
        </div>
      )}

      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => onToggleTag(tag.id)}
          className={`group w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors ${
            selectedTagIds.includes(tag.id)
              ? "bg-blue-50 text-blue-700"
              : "hover:bg-gray-100"
          }`}
        >
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: tag.color }}
          />
          <span className="flex-1 truncate text-left">{tag.name}</span>
          <span
            onClick={(e) => { e.stopPropagation(); remove(tag.id); }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
          >
            &times;
          </span>
        </button>
      ))}
    </div>
  );
}
