export interface Todo {
  id: number;
  title: string;
  description: string | null;
  status: "pending" | "completed";
  priority: "high" | "medium" | "low";
  group_id: number | null;
  parent_id: number | null;
  sort_order: number;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface TodoWithDetails extends Todo {
  tags: Tag[];
  sub_tasks: Todo[];
  bound_scene_ids: number[];
}

export interface Group {
  id: number;
  name: string;
  color: string;
  sort_order: number;
  parent_id: number | null;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface App {
  id: number;
  name: string;
  process_names: string;
  icon_path: string | null;
  display_name: string | null;
  show_widget: boolean;
}

export interface CreateTodo {
  title: string;
  description?: string | null;
  priority?: "high" | "medium" | "low" | null;
  group_id?: number | null;
  parent_id?: number | null;
  due_date?: string | null;
}

export interface UpdateTodo {
  id: number;
  title?: string | null;
  description?: string | null;
  status?: "pending" | "completed" | null;
  priority?: "high" | "medium" | "low" | null;
  group_id?: number | null;
  due_date?: string | null;
}

export interface CreateGroup {
  name: string;
  color?: string | null;
  parent_id?: number | null;
}

export interface UpdateGroup {
  id: number;
  name?: string | null;
  color?: string | null;
  sort_order?: number | null;
  parent_id?: number | null;
}

export interface CreateTag {
  name: string;
  color?: string | null;
}

export interface UpdateTag {
  id: number;
  name?: string | null;
  color?: string | null;
}

export interface CreateApp {
  name: string;
  process_names: string[];
  display_name?: string | null;
}

export interface UpdateApp {
  id: number;
  name?: string | null;
  process_names?: string[] | null;
  display_name?: string | null;
  show_widget?: boolean | null;
  icon_path?: string | null;
}

export interface TodoFilters {
  status?: string | null;
  group_id?: number | null;
  tag_id?: number | null;
  priority?: string | null;
  parent_id?: number | null;
  due_before?: string | null;
}

// --- Scene types ---
export interface Scene {
  id: number;
  name: string;
  icon: string | null;
  color: string;
  sort_order: number;
  track_time: boolean;
  created_at: string;
}

export interface CreateScene {
  name: string;
  icon?: string | null;
  color?: string | null;
  track_time?: boolean;
}

export interface UpdateScene {
  id: number;
  name?: string | null;
  icon?: string | null;
  color?: string | null;
  sort_order?: number | null;
  track_time?: boolean | null;
}

export interface SceneApp {
  scene_id: number;
  app_id: number;
  priority: number;
}

export interface TimeSession {
  id: number;
  scene_id: number | null;
  app_id: number | null;
  started_at: string;
  ended_at: string | null;
  duration_secs: number | null;
}

export interface SceneTimeSummary {
  scene_id: number;
  scene_name: string;
  color: string;
  total_secs: number;
  percentage: number;
}

export interface AppTimeDetail {
  app_id: number;
  app_name: string;
  total_secs: number;
}

export interface TrackingStatus {
  paused: boolean;
  current_scene_id: number | null;
  current_scene_name: string | null;
  session_started_at: string | null;
}
