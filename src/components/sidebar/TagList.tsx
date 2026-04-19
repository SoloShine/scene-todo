import { useState } from "react";
import { useTags } from "../../hooks/useTags";
import { SectionHeader } from "./SectionHeader";
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "../ui/skeleton";
import { Tag } from "lucide-react"

interface TagListProps {
  selectedTagIds: number[];
  onToggleTag: (tagId: number) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function TagList({ selectedTagIds, onToggleTag, collapsed, onToggleCollapse }: TagListProps) {
  const { tags, loading, create, remove } = useTags();
  const [newName, setNewName] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await create({ name: newName.trim() });
    setNewName("");
    setShowInput(false);
  };

  const targetTag = tags.find(t => t.id === deleteId);

  return (
    <div>
      <SectionHeader title="标签" count={tags.length} collapsed={collapsed} onToggle={onToggleCollapse} onAdd={() => setShowInput(true)} />
      {!collapsed && (
        <div className="px-2 pb-1">
          {showInput && (
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              onBlur={() => { if (!newName.trim()) setShowInput(false); }}
              placeholder="标签名称..."
              autoFocus
              className="w-full text-xs mb-1"
            />
          )}
          {loading ? (
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-5 w-12 rounded-full" />
              ))}
            </div>
          ) : (
            <>
              {tags.length === 0 && !showInput && (
                <EmptyState
                  icon={<Tag />}
                  title="还没有标签"
                  description="点击上方 + 创建标签来标记待办"
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
                      onClick={(e) => { e.stopPropagation(); setDeleteId(tag.id); }}
                      className="opacity-0 group-hover:opacity-100 ml-0.5 text-[9px] hover:text-destructive"
                      style={{ color: tag.color + "80" }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <ConfirmDialog
        open={deleteId !== null}
        title="删除标签"
        description={targetTag ? `确定要删除标签「${targetTag.name}」吗？关联的待办将移除该标签。` : ""}
        variant="danger"
        confirmText="删除"
        onConfirm={() => { if (deleteId) remove(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
