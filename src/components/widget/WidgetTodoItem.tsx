import type { Todo } from "../../types";

interface WidgetTodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
}

export function WidgetTodoItem({ todo, onToggle }: WidgetTodoItemProps) {
  const isCompleted = todo.status === "completed";

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-[rgba(99,102,241,0.06)] transition-colors">
      <button
        onClick={() => onToggle(todo.id)}
        className={
          isCompleted
            ? "w-3.5 h-3.5 rounded-[3px] bg-theme flex-shrink-0 flex items-center justify-center"
            : "w-3.5 h-3.5 rounded-[3px] border-[1.5px] border-theme-border/70 hover:border-theme flex-shrink-0 transition-colors"
        }
      >
        {isCompleted && <span className="text-white text-[7px]">✓</span>}
      </button>
      <span
        className={
          isCompleted
            ? "text-[11px] text-gray-400 line-through"
            : "text-[11px] text-[#1e1b4b]"
        }
      >
        {todo.title}
      </span>
      {todo.priority === "high" && !isCompleted && (
        <div className="w-1 h-1 rounded-full bg-destructive flex-shrink-0" />
      )}
    </div>
  );
}
