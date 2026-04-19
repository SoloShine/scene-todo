import { useState, useEffect, useCallback, useRef } from "react";
import type { CreateTodo, UpdateTodo, TodoFilters, TodoWithDetails } from "../types";
import * as api from "../lib/invoke";
import { notify } from "../lib/toast";
import { usePageVisibility } from "./usePageVisibility";

export function useTodos(filters: TodoFilters = {}) {
  const [todos, setTodos] = useState<TodoWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoad = useRef(true);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const visible = usePageVisibility();

  const refresh = useCallback(async () => {
    try {
      const data = await api.listTodosWithDetails(filtersRef.current);
      setTodos(data);
    } finally {
      if (initialLoad.current) {
        setLoading(false);
        initialLoad.current = false;
      }
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    initialLoad.current = true;
    setLoading(true);
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [filters, refresh, visible]);

  const create = async (input: CreateTodo) => {
    try {
      const todo = await api.createTodo(input);
      await refresh();
      notify.success("待办已创建");
      return todo;
    } catch (e) {
      notify.error("创建待办失败");
      throw e;
    }
  };

  const update = async (input: UpdateTodo) => {
    try {
      await api.updateTodo(input);
      await refresh();
      notify.success("待办已更新");
    } catch (e) {
      notify.error("更新待办失败");
      throw e;
    }
  };

  const toggleStatus = async (id: number, status: "pending" | "completed") => {
    try {
      await api.updateTodo({
        id,
        status: status === "pending" ? "completed" : "pending",
      });
      await refresh();
    } catch (e) {
      notify.error("操作失败");
      throw e;
    }
  };

  const remove = async (id: number) => {
    try {
      await api.deleteTodo(id);
      await refresh();
      notify.success("待办已删除");
    } catch (e) {
      notify.error("删除待办失败");
      throw e;
    }
  };

  const getDetails = async (id: number) => {
    return api.getTodoWithDetails(id);
  };

  return { todos, loading, create, update, toggleStatus, remove, getDetails, refresh };
}
