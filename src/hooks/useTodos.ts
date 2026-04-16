import { useState, useEffect, useCallback } from "react";
import type { Todo, CreateTodo, UpdateTodo, TodoFilters } from "../types";
import * as api from "../lib/invoke";

export function useTodos(filters: TodoFilters = {}) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listTodos(filters);
      setTodos(data);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (input: CreateTodo) => {
    await api.createTodo(input);
    await refresh();
  };

  const update = async (input: UpdateTodo) => {
    await api.updateTodo(input);
    await refresh();
  };

  const toggleStatus = async (id: number, status: "pending" | "completed") => {
    await api.updateTodo({
      id,
      status: status === "pending" ? "completed" : "pending",
    });
    await refresh();
  };

  const remove = async (id: number) => {
    await api.deleteTodo(id);
    await refresh();
  };

  const getDetails = async (id: number) => {
    return api.getTodoWithDetails(id);
  };

  return { todos, loading, create, update, toggleStatus, remove, getDetails, refresh };
}
