import { useState } from "react";
import type { Todo } from "../../types";
import { BindingEditor } from "../binding/BindingEditor";

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: number, status: "pending" | "completed") => void;
  onDelete: (id: number) => void;
  onAddSubTask: (parentId: number, title: string) => void;
  onRefresh?: () => void;
}

const priorityColors: Record<string, string> = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-green-500",
};

export function TodoItem({ todo, onToggle, onDelete, onAddSubTask, onRefresh }: TodoItemProps) {
  const [showSubInput, setShowSubInput] = useState(false);
  const [subTitle, setSubTitle] = useState("");
  const [showBinding, setShowBinding] = useState(false);
  const isCompleted = todo.status === "completed";

  const handleAddSub = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && subTitle.trim()) {
      onAddSubTask(todo.id, subTitle.trim());
      setSubTitle("");
      setShowSubInput(false);
    }
  };

  return (
    <div className="group flex items-start gap-2 px-3 py-2 hover:bg-gray-50 transition-colors">
      <button
        onClick={() => onToggle(todo.id, todo.status as "pending" | "completed")}
        className={`mt-0.5 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
          isCompleted
            ? "bg-green-500 border-green-500 text-white"
            : "border-gray-300 hover:border-gray-500"
        }`}
      >
        {isCompleted && <span className="text-xs">&#10003;</span>}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm ${isCompleted ? "line-through text-gray-400" : "text-gray-800"}`}>
            {todo.title}
          </span>
          <span className={`text-xs ${priorityColors[todo.priority] || "text-gray-400"}`}>
            {todo.priority === "high" ? "!!" : todo.priority === "medium" ? "!" : ""}
          </span>
        </div>
        {todo.description && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{todo.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setShowSubInput(true)}
          className="text-xs text-gray-400 hover:text-gray-600"
          title="添加子任务"
        >
          +子
        </button>
        <button
          onClick={() => setShowBinding(true)}
          className="text-xs text-gray-400 hover:text-gray-600"
          title="关联软件"
        >
          &#128206;
        </button>
        <button
          onClick={() => onDelete(todo.id)}
          className="text-xs text-gray-400 hover:text-red-500"
        >
          &times;
        </button>
      </div>

      {showSubInput && (
        <div className="absolute left-8 mt-6">
          <input
            value={subTitle}
            onChange={(e) => setSubTitle(e.target.value)}
            onKeyDown={handleAddSub}
            onBlur={() => { if (!subTitle.trim()) setShowSubInput(false); }}
            placeholder="子任务名称..."
            autoFocus
            className="px-2 py-1 text-sm border border-gray-200 rounded w-48"
          />
        </div>
      )}

      {showBinding && <BindingEditor todoId={todo.id} onClose={() => setShowBinding(false)} onRefresh={() => { onRefresh?.(); }} />}
    </div>
  );
}
