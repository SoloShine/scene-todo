import { invoke } from "@tauri-apps/api/core";
import type {
  Todo, TodoWithDetails, Group, Tag, App,
  CreateTodo, UpdateTodo, CreateGroup, UpdateGroup,
  CreateTag, UpdateTag, CreateApp, UpdateApp, TodoFilters,
  Scene, CreateScene, UpdateScene, SceneApp,
  TimeSession, SceneTimeSummary, AppTimeDetail, TrackingStatus,
} from "../types";

export const createTodo = (input: CreateTodo) =>
  invoke<Todo>("create_todo", { input });

export const listTodos = (filters: TodoFilters = {}) =>
  invoke<Todo[]>("list_todos", { filters });

export const listTodosWithDetails = (filters: TodoFilters = {}) =>
  invoke<TodoWithDetails[]>("list_todos_with_details", { filters });

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

export const startWindowCapture = () =>
  invoke<{ process_name: string; window_title: string }>("start_window_capture");

export const saveWidgetOffset = (appId: number, offsetX: number, offsetY: number) =>
  invoke<void>("save_widget_offset", { appId, offsetX, offsetY });

export const setWidgetDefaultSize = (width: number, height: number) =>
  invoke<void>("set_widget_default_size", { width, height });

export const hideWidget = (appId: number) =>
  invoke<void>("hide_widget", { appId });

// Scene management
export const createScene = (input: CreateScene) =>
  invoke<Scene>("create_scene", { input });

export const listScenes = () =>
  invoke<Scene[]>("list_scenes");

export const updateScene = (input: UpdateScene) =>
  invoke<Scene>("update_scene", { input });

export const deleteScene = (id: number) =>
  invoke<void>("delete_scene", { id });

export const addAppToScene = (sceneId: number, appId: number, priority: number) =>
  invoke<void>("add_app_to_scene", { sceneId, appId, priority });

export const removeAppFromScene = (sceneId: number, appId: number) =>
  invoke<void>("remove_app_from_scene", { sceneId, appId });

export const listSceneApps = (sceneId: number) =>
  invoke<SceneApp[]>("list_scene_apps", { sceneId });

export const bindTodoToScene = (todoId: number, sceneId: number) =>
  invoke<void>("bind_todo_to_scene", { todoId, sceneId });

export const unbindTodoFromScene = (todoId: number, sceneId: number) =>
  invoke<void>("unbind_todo_from_scene", { todoId, sceneId });

export const listTodosByScene = (sceneId: number) =>
  invoke<TodoWithDetails[]>("list_todos_by_scene", { sceneId });

// Time statistics
export const getTimeSummary = (rangeStart: string, rangeEnd: string) =>
  invoke<SceneTimeSummary[]>("get_time_summary", { rangeStart, rangeEnd });

export const getTimeDetail = (sceneId: number, rangeStart: string, rangeEnd: string) =>
  invoke<AppTimeDetail[]>("get_time_detail", { sceneId, rangeStart, rangeEnd });

export const getTimeSessions = (rangeStart: string, rangeEnd: string, limit: number) =>
  invoke<TimeSession[]>("get_time_sessions", { rangeStart, rangeEnd, limit });

// Tracking control
export const setTrackingPaused = (paused: boolean) =>
  invoke<void>("set_tracking_paused", { paused });

export const getTrackingStatus = () =>
  invoke<TrackingStatus>("get_tracking_status");

export const getActiveScene = () =>
  invoke<Scene | null>("get_active_scene");

export const setActiveScene = (sceneId: number) =>
  invoke<void>("set_active_scene", { sceneId });

// Data cleanup
export const cleanupOldSessions = (retentionDays: number) =>
  invoke<number>("cleanup_old_sessions", { retentionDays });
