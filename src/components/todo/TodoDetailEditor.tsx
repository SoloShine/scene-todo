import { useState, useEffect } from "react";
import { useGroups } from "../../hooks/useGroups";
import { useTags } from "../../hooks/useTags";
import * as api from "../../lib/invoke";
import { notify } from "../../lib/toast";
import type { Tag } from "../../types";
import { Popover, PopoverContent } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"

interface TodoDetailEditorProps {
  todoId: number;
  currentGroupId: number | null;
  onClose: () => void;
  onRefresh: () => void;
}

export function TodoDetailEditor({ todoId, currentGroupId, onClose, onRefresh }: TodoDetailEditorProps) {
  const { groups } = useGroups();
  const { tags: allTags } = useTags();
  const [todoTags, setTodoTags] = useState<Tag[]>([]);
  const [groupId, setGroupId] = useState<number | null>(currentGroupId);

  useEffect(() => {
    api.getTodoWithDetails(todoId)
      .then((d) => setTodoTags(d.tags))
      .catch(() => notify.error("加载待办详情失败"));
  }, [todoId]);

  const handleGroupChange = async (gid: number | null) => {
    setGroupId(gid);
    try {
      await api.updateTodo({ id: todoId, group_id: gid });
      onRefresh();
    } catch {
      notify.error("更新分组失败");
    }
  };

  const handleTagToggle = async (tagId: number) => {
    try {
      if (todoTags.some((t) => t.id === tagId)) {
        await api.removeTagFromTodo(todoId, tagId);
        setTodoTags((prev) => prev.filter((t) => t.id !== tagId));
      } else {
        await api.addTagToTodo(todoId, tagId);
        const tag = allTags.find((t) => t.id === tagId);
        if (tag) setTodoTags((prev) => [...prev, tag]);
      }
      onRefresh();
    } catch {
      notify.error("更新标签失败");
    }
  };

  return (
    <Popover open onOpenChange={() => onClose()}>
      <PopoverContent className="w-56 p-3 space-y-3" side="bottom" align="center">
        {/* Group selector */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">分组</h4>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            <button
              onClick={() => handleGroupChange(null)}
              className={`w-full text-left text-xs px-2 py-1 rounded ${
                groupId === null ? "bg-accent text-accent-foreground" : "hover:bg-accent"
              }`}
            >
              无分组
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => handleGroupChange(g.id)}
                className={`w-full text-left text-xs px-2 py-1 rounded flex items-center gap-2 ${
                  groupId === g.id ? "bg-accent text-accent-foreground" : "hover:bg-accent"
                }`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                {g.name}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Tag selector */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">标签</h4>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {allTags.length === 0 && (
              <p className="text-xs text-muted-foreground px-2">暂无标签</p>
            )}
            {allTags.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 px-2 py-1 hover:bg-accent rounded cursor-pointer"
              >
                <Checkbox
                  checked={todoTags.some((t) => t.id === tag.id)}
                  onCheckedChange={() => handleTagToggle(tag.id)}
                />
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="text-xs">{tag.name}</span>
              </label>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
