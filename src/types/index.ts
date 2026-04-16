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
  bound_app_ids: number[];
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
}

export interface TodoFilters {
  status?: string | null;
  group_id?: number | null;
  tag_id?: number | null;
  priority?: string | null;
  parent_id?: number | null;
  due_before?: string | null;
}
