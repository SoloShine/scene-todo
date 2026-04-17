import { useState, useEffect, useCallback, useRef } from "react";
import type { Todo, CreateTodo, UpdateTodo, TodoFilters } from "../types";
import * as api from "../lib/invoke";

export function useTodos(filters: TodoFilters = {}) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const refresh = useCallback(async () => {
    try {
      const data = await api.listTodos(filtersRef.current);
      setTodos(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  const create = async (input: CreateTodo) => {
    const todo = await api.createTodo(input);
    await refresh();
    return todo;
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
