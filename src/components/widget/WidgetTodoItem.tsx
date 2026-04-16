import type { Todo } from "../../types";

interface WidgetTodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
}

export function WidgetTodoItem({ todo, onToggle }: WidgetTodoItemProps) {
  const isCompleted = todo.status === "completed";

  return (
    <div className="flex items-center gap-2 py-1 px-2 hover:bg-white/50 rounded">
      <button
        onClick={() => onToggle(todo.id)}
        className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
          isCompleted
            ? "bg-green-500 border-green-500"
            : "border-gray-400 hover:border-gray-600"
        }`}
      >
        {isCompleted && <span className="text-white text-[10px]">&#10003;</span>}
      </button>
      <span
        className={`text-xs ${
          isCompleted ? "line-through text-gray-400" : "text-gray-800"
        }`}
      >
        {todo.title}
      </span>
    </div>
  );
}
