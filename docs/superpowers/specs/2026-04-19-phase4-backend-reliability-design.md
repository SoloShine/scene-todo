# Phase 4: 后端稳定性优化

**日期**: 2026-04-19
**前置**: Phase 1-3 完成（前端已稳定）
**范围**: N+1 查询优化、Widget 生命周期、数据安全

## 目标

1. 消除 N+1 查询，提升数据量增长后的性能
2. 修复 Widget 内存泄漏，实现 Widget 复用
3. 加强数据安全 — 导入校验、事务保障、Session 持久化

## 一、N+1 查询优化

### 问题分析

| 位置 | 问题 | 影响 |
|------|------|------|
| `todo_repo.rs:list_todos_with_details` (line ~196) | 循环调用 `get_todo_with_details` | N 个 todo 产生 3N+1 次查询 |
| `todo_repo.rs:list_todos_by_app` (line ~191) | 循环调用 `get_todo_with_details` | 同上 |
| `todo_repo.rs:get_todo_with_details` (line ~115) | 3 次独立查询（todo + tags + subtasks + scenes） | 每个详情 3-4 次查询 |
| `app_repo.rs:find_app_by_process` (line ~97) | 每次调用加载全部 apps | 每 200ms 轮询调用一次 |

### 优化方案

#### 1. `list_todos_with_details` — 批量查询

将循环查询改为 3 次批量查询：

```rust
pub fn list_todos_with_details(conn: &Connection, filters: &TodoFilters) -> Result<Vec<TodoWithDetails>> {
    // 1. 查询所有匹配的 todos（已有）
    let todos = list_todos(conn, filters)?;

    if todos.is_empty() { return Ok(vec![]); }

    let ids: Vec<String> = todos.iter().map(|t| t.id.to_string()).collect();
    let id_list = ids.join(",");

    // 2. 批量查询 tags: SELECT tt.todo_id, t.* FROM tags t JOIN todo_tags tt ...
    let tags = batch_query_tags(conn, &id_list)?;

    // 3. 批量查询 subtasks: SELECT * FROM todos WHERE parent_id IN (...)
    let subtasks = batch_query_subtasks(conn, &id_list)?;

    // 4. 批量查询 scene bindings: SELECT tsb.todo_id, sb.scene_id FROM ...
    let scenes = batch_query_scenes(conn, &id_list)?;

    // 5. 组装
    Ok(todos.into_iter().map(|todo| {
        let todo_tags = tags.get(&todo.id).cloned().unwrap_or_default();
        let todo_subtasks = subtasks.get(&todo.id).cloned().unwrap_or_default();
        let todo_scenes = scenes.get(&todo.id).cloned().unwrap_or_default();
        TodoWithDetails { todo, tags: todo_tags, sub_tasks: todo_subtasks, bound_scene_ids: todo_scenes }
    }).collect())
}
```

查询次数从 3N+1 降为 4 次（固定）。

#### 2. `list_todos_by_app` — 同样改为批量

与上面相同的批量模式，先获取 ID 列表，再批量查详情。

#### 3. `find_app_by_process` — 内存缓存

在 `WindowMonitor` 中缓存 app 列表，避免每次轮询都查数据库：

```rust
struct WindowMonitor {
    // ... 现有字段
    app_cache: Vec<App>,      // 新增：缓存的 app 列表
    cache_valid: bool,         // 新增：缓存是否有效
}
```

当 app 列表变更时（CRUD 操作），通过事件通知 monitor 刷新缓存。或者简单地每次启动时加载 + 定期刷新（如每 30 秒）。

## 二、Widget 生命周期

### 问题分析

| 问题 | 位置 | 影响 |
|------|------|------|
| Widget 每次切换创建新的 | `widget_manager.rs:handle_foreground_change` | 内存泄漏，旧 Widget 隐藏不销毁 |
| 删除 App 时不清理 Widget | `app_repo.rs:delete_app` | 孤儿 Widget |
| Widget URL 编码手写 | `widget_manager.rs:182-191` | 可能有编码问题 |

### 优化方案

#### 1. Widget 复用池

```rust
struct WidgetManager {
    // 现有
    webview_windows: HashMap<u32, WebviewWindow>,  // app_id -> window

    // 新增：Widget 池
    widget_pool: HashMap<u32, WebviewWindow>,  // 缓存已创建的 Widget
}
```

`handle_foreground_change` 逻辑改为：
1. 如果 pool 中有该 app 的 Widget → 显示并更新内容
2. 如果没有 → 创建新 Widget 并放入 pool
3. 切换到其他 app → 隐藏当前 Widget（不销毁）

Widget 内容更新通过 Tauri 事件通知前端刷新数据，而不是重建 URL。

#### 2. App 删除时清理

在 `app_repo.rs:delete_app` 或 `app_cmd.rs` 中，删除 app 后调用 WidgetManager 销毁对应 Widget：

```rust
pub fn delete_app_cmd(app_id: u32, state: State<'_, AppState>) -> Result<(), String> {
    // 销毁关联的 Widget
    state.widget_manager.destroy_widget(app_id);
    // 删除 app 数据
    app_repo::delete_app(&state.db, app_id)?;
    Ok(())
}
```

#### 3. URL 编码

使用 `urlencoding::encode()` 替代手写编码。添加 `urlencoding` 依赖，或使用 Rust 标准库的 `percent_encoding` crate。

## 三、数据安全

### 3.1 导入数据校验

#### 现状

`data_port.rs:import_all` 直接 `DELETE ALL` + 插入 JSON 数据，无任何校验。

#### 方案

在 `import_all` 中添加校验：

```rust
fn validate_import_data(data: &serde_json::Value) -> Result<(), String> {
    // 1. 检查必需的表存在
    let required = ["todos", "groups", "tags", "apps", "scenes"];
    for table in &required {
        if !data.as_object().map(|o| o.contains_key(*table)).unwrap_or(false) {
            return Err(format!("Missing required table: {}", table));
        }
    }

    // 2. 检查每个表是数组
    for table in &required {
        if !data[table].is_array() {
            return Err(format!("Table {} must be an array", table));
        }
    }

    // 3. 检查 schema version（如果有）
    if let Some(version) = data.get("version") {
        if version.as_u64().unwrap_or(0) > 1 {
            return Err("Unsupported data version".into());
        }
    }

    Ok(())
}
```

在 `import_all` 开头调用校验，校验失败直接返回错误。

### 3.2 事务包装

#### 现状

`import_all` 中禁用 FK 检查后逐表删除 + 插入，如果中途失败数据库处于不一致状态。

#### 方案

将整个 import 包在事务中：

```rust
pub fn import_all(conn: &Connection, json: &str) -> Result<(), String> {
    let data: serde_json::Value = serde_json::from_str(json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    validate_import_data(&data)?;

    let tx = conn.unchecked_transaction()
        .map_err(|e| format!("Begin tx: {}", e))?;

    // 禁用 FK 检查
    tx.execute_batch("PRAGMA foreign_keys = OFF")
        .map_err(|e| format!("Disable FK: {}", e))?;

    // 删除 + 插入各表
    for table in &TABLE_ORDER {
        tx.execute(&format!("DELETE FROM {}", table), [])
            .map_err(|e| format!("Clear {}: {}", table, e))?;
        if let Some(rows) = data.get(*table).and_then(|v| v.as_array()) {
            for row in rows {
                insert_row(&tx, table, row)?;
            }
        }
    }

    // 重新启用 FK 检查
    tx.execute_batch("PRAGMA foreign_keys = ON")
        .map_err(|e| format!("Enable FK: {}", e))?;

    tx.commit().map_err(|e| format!("Commit: {}", e))?;
    Ok(())
}
```

如果中途任何步骤失败，事务自动回滚，数据库回到导入前状态。

### 3.3 Session 持久化

#### 现状

`TimeTracker` 的当前 session 只存在于内存中的 `PendingSession`。应用崩溃时会丢失当前 session。

#### 方案

在数据库中添加一个 `current_session` 表来持久化：

```sql
-- migration 004_current_session.sql
CREATE TABLE IF NOT EXISTS current_session (
    id INTEGER PRIMARY KEY CHECK (id = 1),  -- 单行表
    scene_id INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    FOREIGN KEY (scene_id) REFERENCES scenes(id)
);
```

`start_session` 时写入 `current_session` 表。`end_current_session` 时删除该行并写入 `time_sessions`。启动时检查是否有残留的 `current_session`，如果有则按结束处理（计算时长写入 `time_sessions`）。

## 四、文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src-tauri/migrations/004_current_session.sql` | Session 持久化表 |
| `src-tauri/src/services/import_validator.rs` | 导入数据校验模块 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src-tauri/src/services/todo_repo.rs` | N+1 查询改为批量查询 |
| `src-tauri/src/services/app_repo.rs` | 内存缓存 |
| `src-tauri/src/services/widget_manager.rs` | Widget 复用池 + 清理 |
| `src-tauri/src/services/data_port.rs` | 导入校验 + 事务包装 |
| `src-tauri/src/services/time_tracker.rs` | Session 持久化 |
| `src-tauri/src/services/window_monitor.rs` | App 缓存 + 防抖 |
| `src-tauri/src/services/db.rs` | 注册新迁移 |
| `src-tauri/src/commands/app_cmd.rs` | 删除 App 时清理 Widget |
| `src-tauri/src/services/mod.rs` | 添加新模块 |

### 依赖变更

| 包 | 说明 |
|----|------|
| `urlencoding` 或 `percent-encoding` | URL 编码 |

## 五、性能预期

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 100 个待办的详情查询 | ~300 次 DB 查询 | 4 次 |
| WindowMonitor 匹配 | 每次查 DB | 内存查找 |
| App 切换 Widget | 创建新窗口 | 显示已有窗口 |
| 导入失败 | 数据库不一致 | 自动回滚 |
| 崩溃恢复 | 丢失当前 session | 从 DB 恢复 |
