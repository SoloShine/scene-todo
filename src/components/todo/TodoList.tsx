import { useTodos } from "../../hooks/useTodos";
import { TodoForm } from "./TodoForm";
import { TodoItem } from "./TodoItem";
import type { TodoFilters } from "../../types";

interface TodoListProps {
  filters: TodoFilters;
  selectedTagIds: number[];
}

export function TodoList({ filters, selectedTagIds }: TodoListProps) {
  const { todos, loading, create, toggleStatus, remove } = useTodos(filters);

  const handleCreate = (title: string) => {
    create({ title });
  };

  const handleAddSubTask = (parentId: number, title: string) => {
    create({ title, parent_id: parentId });
  };

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">加载中...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <TodoForm onSubmit={handleCreate} />
      <div className="flex-1 overflow-y-auto">
        {todos.length === 0 ? (
          <div className="p-4 text-sm text-gray-400 text-center">
            没有待办事项
          </div>
        ) : (
          todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={toggleStatus}
              onDelete={remove}
              onAddSubTask={handleAddSubTask}
            />
          ))
        )}
      </div>
    </div>
  );
}
