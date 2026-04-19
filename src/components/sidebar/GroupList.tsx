import { useState } from "react";
import { useGroups } from "../../hooks/useGroups";
import { SectionHeader } from "./SectionHeader";
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "../ui/skeleton";
import { FolderOpen } from "lucide-react"

interface GroupListProps {
  selectedGroupId: number | null;
  onSelectGroup: (groupId: number | null) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function GroupList({ selectedGroupId, onSelectGroup, collapsed, onToggleCollapse }: GroupListProps) {
  const { groups, loading, create, remove } = useGroups();
  const [newName, setNewName] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await create({ name: newName.trim() });
    setNewName("");
    setShowInput(false);
  };

  const targetGroup = groups.find(g => g.id === deleteId);

  return (
    <div>
      <SectionHeader title="分组" count={groups.length} collapsed={collapsed} onToggle={onToggleCollapse} onAdd={() => setShowInput(true)} />
      <div className={`section-collapse ${collapsed ? "section-collapsed" : "section-expanded"}`}>
        <div className="px-1 pb-1">
          {showInput && (
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              onBlur={() => { if (!newName.trim()) setShowInput(false); }}
              placeholder="分组名称..."
              autoFocus
              className="w-full text-xs mb-0.5"
            />
          )}
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => onSelectGroup(null)}
                className={`w-full flex items-center gap-2 px-2 py-1 text-xs rounded transition-colors ${
                  selectedGroupId === null ? "bg-theme-bg text-theme" : "hover:bg-accent text-muted-foreground"
                }`}
              >
                全部待办
              </button>
              {groups.length === 0 && !showInput && (
                <EmptyState
                  icon={<FolderOpen />}
                  title="还没有分组"
                  description="点击上方 + 创建分组来整理待办"
                />
              )}
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
                    onClick={(e) => { e.stopPropagation(); setDeleteId(group.id); }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground/70 hover:text-destructive text-[10px]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={deleteId !== null}
        title="删除分组"
        description={targetGroup ? `确定要删除分组「${targetGroup.name}」吗？组内待办将变为未分组。` : ""}
        variant="danger"
        confirmText="删除"
        onConfirm={() => { if (deleteId) remove(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
