import { useState, useEffect } from "react";
import { useGroups } from "../../hooks/useGroups";
import { useTags } from "../../hooks/useTags";
import * as api from "../../lib/invoke";
import type { Tag } from "../../types";

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
    api.getTodoWithDetails(todoId).then((d) => setTodoTags(d.tags));
  }, [todoId]);

  const handleGroupChange = async (gid: number | null) => {
    setGroupId(gid);
    await api.updateTodo({ id: todoId, group_id: gid });
    onRefresh();
  };

  const handleTagToggle = async (tagId: number) => {
    if (todoTags.some((t) => t.id === tagId)) {
      await api.removeTagFromTodo(todoId, tagId);
      setTodoTags((prev) => prev.filter((t) => t.id !== tagId));
    } else {
      await api.addTagToTodo(todoId, tagId);
      const tag = allTags.find((t) => t.id === tagId);
      if (tag) setTodoTags((prev) => [...prev, tag]);
    }
    onRefresh();
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute bg-card rounded-xl shadow-xl border border-surface-border w-56 p-3 space-y-3"
        onClick={(e) => e.stopPropagation()}
        style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
      >
        {/* Group selector */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-1">分组</h4>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            <button
              onClick={() => handleGroupChange(null)}
              className={`w-full text-left text-xs px-2 py-1 rounded ${
                groupId === null ? "bg-blue-50 text-blue-700" : "hover:bg-accent"
              }`}
            >
              无分组
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => handleGroupChange(g.id)}
                className={`w-full text-left text-xs px-2 py-1 rounded flex items-center gap-2 ${
                  groupId === g.id ? "bg-blue-50 text-blue-700" : "hover:bg-accent"
                }`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
                {g.name}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-surface-border" />

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
                <input
                  type="checkbox"
                  checked={todoTags.some((t) => t.id === tag.id)}
                  onChange={() => handleTagToggle(tag.id)}
                  className="rounded border-surface-border"
                />
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="text-xs">{tag.name}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
