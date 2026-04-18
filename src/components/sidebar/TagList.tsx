import { useState } from "react";
import { useTags } from "../../hooks/useTags";
import { SectionHeader } from "./SectionHeader";

interface TagListProps {
  selectedTagIds: number[];
  onToggleTag: (tagId: number) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function TagList({ selectedTagIds, onToggleTag, collapsed, onToggleCollapse }: TagListProps) {
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
    <div>
      <SectionHeader title="标签" count={tags.length} collapsed={collapsed} onToggle={onToggleCollapse} onAdd={() => setShowInput(true)} />
      {!collapsed && (
        <div className="px-2 pb-1">
          {showInput && (
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              onBlur={() => { if (!newName.trim()) setShowInput(false); }}
              placeholder="标签名称..."
              autoFocus
              className="w-full px-2 py-1 text-xs border border-surface-border bg-background focus:border-theme-border outline-none rounded-md mb-1"
            />
          )}
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag.id}
                className={`group inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] rounded-full cursor-pointer transition-colors ${
                  selectedTagIds.includes(tag.id)
                    ? "ring-1 ring-offset-0.5"
                    : "hover:opacity-80"
                }`}
                style={{
                  backgroundColor: tag.color + "20",
                  color: tag.color,
                  ...(selectedTagIds.includes(tag.id) ? { ringColor: tag.color } : {}),
                }}
                onClick={() => onToggleTag(tag.id)}
              >
                <span>{tag.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); remove(tag.id); }}
                  className="opacity-0 group-hover:opacity-100 ml-0.5 text-[9px] hover:text-destructive"
                  style={{ color: tag.color + "80" }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
