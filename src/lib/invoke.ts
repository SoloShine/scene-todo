import { invoke } from "@tauri-apps/api/core";
import type {
  Todo, TodoWithDetails, Group, Tag, App,
  CreateTodo, UpdateTodo, CreateGroup, UpdateGroup,
  CreateTag, UpdateTag, CreateApp, UpdateApp, TodoFilters,
} from "../types";

export const createTodo = (input: CreateTodo) =>
  invoke<Todo>("create_todo", { input });

export const listTodos = (filters: TodoFilters = {}) =>
  invoke<Todo[]>("list_todos", { filters });

export const getTodo = (id: number) =>
  invoke<Todo>("get_todo", { id });

export const updateTodo = (input: UpdateTodo) =>
  invoke<Todo>("update_todo", { input });

export const deleteTodo = (id: number) =>
  invoke<void>("delete_todo", { id });

export const getTodoWithDetails = (id: number) =>
  invoke<TodoWithDetails>("get_todo_with_details", { id });

export const listTodosByApp = (appId: number) =>
  invoke<TodoWithDetails[]>("list_todos_by_app", { appId });

export const addTagToTodo = (todoId: number, tagId: number) =>
  invoke<void>("add_tag_to_todo", { todoId, tagId });

export const removeTagFromTodo = (todoId: number, tagId: number) =>
  invoke<void>("remove_tag_from_todo", { todoId, tagId });

export const createGroup = (input: CreateGroup) =>
  invoke<Group>("create_group", { input });

export const listGroups = () =>
  invoke<Group[]>("list_groups");

export const updateGroup = (input: UpdateGroup) =>
  invoke<Group>("update_group", { input });

export const deleteGroup = (id: number) =>
  invoke<void>("delete_group", { id });

export const createTag = (input: CreateTag) =>
  invoke<Tag>("create_tag", { input });

export const listTags = () =>
  invoke<Tag[]>("list_tags");

export const updateTag = (input: UpdateTag) =>
  invoke<Tag>("update_tag", { input });

export const deleteTag = (id: number) =>
  invoke<void>("delete_tag", { id });

export const createApp = (input: CreateApp) =>
  invoke<App>("create_app", { input });

export const listApps = () =>
  invoke<App[]>("list_apps");

export const updateApp = (input: UpdateApp) =>
  invoke<App>("update_app", { input });

export const deleteApp = (id: number) =>
  invoke<void>("delete_app", { id });

export const bindTodoToApp = (todoId: number, appId: number) =>
  invoke<void>("bind_todo_to_app", { todoId, appId });

export const unbindTodoFromApp = (todoId: number, appId: number) =>
  invoke<void>("unbind_todo_from_app", { todoId, appId });

export const startWindowMonitor = () =>
  invoke<void>("start_window_monitor");

export const stopWindowMonitor = () =>
  invoke<void>("stop_window_monitor");
