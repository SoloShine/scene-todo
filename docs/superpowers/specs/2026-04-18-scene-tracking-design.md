# SceneTodo — 场景化追踪深化设计

## 背景

SceneTodo MVP 已完成核心功能：Todo CRUD、分组标签、App 绑定、浮动 Widget、系统托盘。当前的"场景"概念是 **App = 场景**（一个应用进程对应一组待办）。

本设计将"场景"升级为一等实体，支持多 App 组合场景，并加入自动时间追踪和统计。

## 设计目标

1. **Scene 作为一等实体**：多个 App 可组合为一个场景，Todo 绑定 Scene 而非单个 App
2. **自动时间追踪**：后台静默记录每个前台窗口停留时间，无需手动操作
3. **独立统计页面**：按场景聚合的时间分布图表和历史趋势

## 数据模型变更

### 新增表

#### scenes（场景）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| name | TEXT NOT NULL | 场景名称 |
| icon | TEXT | emoji 或图标标识 |
| color | TEXT | 颜色标识（hex），默认 '#6B7280' |
| sort_order | INTEGER | 排序权重，默认 0 |
| created_at | TEXT | 创建时间 |

#### scene_apps（场景-应用关联，多对多）

| 字段 | 类型 | 说明 |
|------|------|------|
| scene_id | INTEGER FK → scenes.id | 场景 ID，ON DELETE CASCADE |
| app_id | INTEGER FK → apps.id | 应用 ID，ON DELETE CASCADE |
| PRIMARY KEY (scene_id, app_id) | | |

#### todo_scene_bindings（待办-场景关联，多对多）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| todo_id | INTEGER FK → todos.id | 待办 ID，ON DELETE CASCADE |
| scene_id | INTEGER FK → scenes.id | 场景 ID，ON DELETE CASCADE |
| UNIQUE(todo_id, scene_id) | | |

#### time_sessions（时间追踪记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| scene_id | INTEGER FK → scenes.id | 场景 ID，ON DELETE SET NULL |
| app_id | INTEGER FK → apps.id | 应用 ID，ON DELETE SET NULL |
| started_at | TEXT NOT NULL | 会话开始时间 |
| ended_at | TEXT | 会话结束时间（NULL 表示进行中） |
| duration_secs | INTEGER | 持续秒数（ended_at - started_at） |

### 索引

- `idx_time_sessions_scene_id` ON time_sessions(scene_id)
- `idx_time_sessions_started_at` ON time_sessions(started_at)
- `idx_time_sessions_app_id` ON time_sessions(app_id)

### 数据迁移

迁移脚本 `002_scene_tracking.sql`：

1. 创建 `scenes`、`scene_apps`、`todo_scene_bindings`、`time_sessions` 四张新表
2. 为 `apps` 表中每个现有 App 自动创建同名 Scene（单 App 场景）
3. 插入 `scene_apps` 将每个 App 关联到其自动创建的 Scene
4. 将 `todo_app_bindings` 数据迁移到 `todo_scene_bindings`（通过自动创建的 Scene 映射）
5. 保留 `todo_app_bindings` 表暂时不删除（后续版本清理）

### 语义变化

| 之前 | 之后 |
|------|------|
| Todo 绑定 App | Todo 绑定 Scene |
| 切到某 App → 显示该 App 的 Widget | 切到某 Scene 下任意 App → 显示该 Scene 的 Widget |
| App = 场景 | Scene 可包含多个 App |

示例：「开发场景」包含 VS Code + Terminal + Chrome → 三个 App 任意一个在前台，Widget 显示同一组 Todo。

## 后端变更

### WindowMonitor 改造

现有行为：每 200ms 轮询前台窗口，检测到进程变化 → 发射 `foreground-changed` 事件。

新增行为：

1. 检测到前台变化时，结束当前 time_session（写入 ended_at + duration_secs）
2. 查找新 App 所属的 Scene（通过 `scene_apps` 表，取第一个匹配）
3. 创建新 time_session（scene_id, app_id, started_at = now）
4. 发射增强版 `foreground-changed` 事件，新增字段：
   - `scene_id: Option<i64>`
   - `scene_name: Option<String>`

### WidgetManager 改造

- 按 scene_id 创建/显示 Widget，而非 app_id
- 同一 Scene 下不同 App 切换不触发 Widget 重建
- Widget URL 改为 `/widget?scene_id={id}&scene_name={encoded_name}`
- 查询该 Scene 下所有待办（通过 `todo_scene_bindings`）

### 新增 Tauri Commands

**Scene 管理**：
- `create_scene(CreateScene) → Scene`
- `list_scenes() → Vec<Scene>`
- `update_scene(UpdateScene) → Scene`
- `delete_scene(id: i64) → ()`
- `add_app_to_scene(scene_id: i64, app_id: i64) → ()`
- `remove_app_from_scene(scene_id: i64, app_id: i64) → ()`

**时间统计**：
- `get_time_summary(range_start: String, range_end: String) → Vec<SceneTimeSummary>`
  - `SceneTimeSummary { scene_id, scene_name, total_secs, percentage }`
- `get_time_detail(scene_id: i64, range_start: String, range_end: String) → Vec<AppTimeDetail>`
  - `AppTimeDetail { app_id, app_name, total_secs }`
- `get_time_sessions(range_start: String, range_end: String, limit: i64) → Vec<TimeSession>`

### 新增 Models

```rust
// Scene
Scene { id, name, icon, color, sort_order, created_at }
CreateScene { name, icon, color }
UpdateScene { id, name, icon, color, sort_order }

// Time tracking
TimeSession { id, scene_id, app_id, started_at, ended_at, duration_secs }
SceneTimeSummary { scene_id, scene_name, color, total_secs, percentage }
AppTimeDetail { app_id, app_name, total_secs }
```

## 前端变更

### 场景管理 UI

**侧边栏新增「场景」区域**（`SceneList.tsx`）：
- 显示所有场景列表，样式类似现有 GroupList
- 点击场景 → 筛选该场景关联的 Todo
- 右键/编辑 → 打开场景编辑器

**场景编辑器**（`SceneEditor.tsx`）：
- 场景名称 + emoji 图标 + 颜色选择
- 已关联 App 列表，支持添加/移除
- 支持通过窗口抓取添加新 App 到场景

### BindingEditor 改造

- 标题从「关联软件」改为「关联场景」
- 选择目标从 App 列表变为 Scene 列表
- 仍支持窗口抓取：抓取后自动匹配到包含该 App 的 Scene，或提示创建新场景

### 统计页面（`StatsView.tsx`）

独立页面，侧边栏底部入口（与 Settings 并列）。

**布局**：
- 顶部：日期范围选择器（今天 / 本周 / 本月 / 自定义）
- 主体左：时间分布环形图（按 Scene 占比）
- 主体右：场景排行列表（名称 + 时间 + 百分比进度条）
- 下方：时间线视图（横向条形图，展示一天中各场景的时间块）
- 点击场景展开：各 App 的时间明细

**图表库**：Recharts（轻量、React 生态、支持饼图/环形图/条形图）。

### Widget 微调

- Widget 标题显示 Scene 名称和图标
- URL 参数从 `app_id/app_name` 改为 `scene_id/scene_name`
- 查询待办通过 `todo_scene_bindings` 而非 `todo_app_bindings`

## TypeScript 类型变更

```typescript
// 新增
export interface Scene {
  id: number;
  name: string;
  icon: string | null;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface CreateScene {
  name: string;
  icon?: string | null;
  color?: string | null;
}

export interface UpdateScene {
  id: number;
  name?: string | null;
  icon?: string | null;
  color?: string | null;
  sort_order?: number | null;
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

// TodoWithDetails 变更
export interface TodoWithDetails extends Todo {
  tags: Tag[];
  sub_tasks: Todo[];
  bound_scene_ids: number[]; // 替代 bound_app_ids
}
```

## 文件变更预估

### Rust 后端（src-tauri/src/）

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| migrations/002_scene_tracking.sql | 新增 | 数据库迁移脚本 |
| models/scene.rs | 新增 | Scene + 时间追踪模型 |
| commands/scene_cmd.rs | 新增 | Scene CRUD + 时间统计命令 |
| services/scene_repo.rs | 新增 | Scene 数据访问层 |
| services/time_tracker.rs | 新增 | 时间追踪服务（session 记录） |
| services/window_monitor.rs | 修改 | 集成时间追踪，增强事件 |
| services/widget_manager.rs | 修改 | 按 Scene 管理 Widget |
| services/app_repo.rs | 修改 | 新增按 Scene 查询待办方法 |
| services/todo_repo.rs | 修改 | todo_scene_bindings 查询 |
| commands/app_cmd.rs | 修改 | 移除直接绑定，改为通过 Scene |
| lib.rs | 修改 | 注册新命令 |

### React 前端（src/）

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| types/index.ts | 修改 | 新增 Scene、TimeSession 等类型 |
| hooks/useScenes.ts | 新增 | Scene CRUD hook |
| hooks/useTimeStats.ts | 新增 | 时间统计 hook |
| lib/invoke.ts | 修改 | 新增 Scene 和时间统计 API |
| components/sidebar/SceneList.tsx | 新增 | 侧边栏场景列表 |
| components/sidebar/Sidebar.tsx | 修改 | 集成场景列表 + 统计入口 |
| components/scene/SceneEditor.tsx | 新增 | 场景编辑器 |
| components/scene/ScenePicker.tsx | 新增 | 场景选择器（用于绑定） |
| components/stats/StatsView.tsx | 新增 | 统计页面主组件 |
| components/stats/TimeDistribution.tsx | 新增 | 时间分布图表 |
| components/stats/SceneTimeline.tsx | 新增 | 场景时间线 |
| components/binding/BindingEditor.tsx | 修改 | 从选 App 改为选 Scene |
| components/widget/Widget.tsx | 修改 | 接收 scene 参数 |
| App.tsx | 修改 | 新增统计页面路由 |

## 实施分阶段建议

### Phase 1：数据模型 + 迁移
- 创建迁移脚本
- 新增 Scene model + repo
- 数据迁移逻辑

### Phase 2：后端 Scene CRUD + 时间追踪
- Scene 命令（CRUD + App 管理）
- 时间追踪服务（集成到 WindowMonitor）
- 时间统计查询命令

### Phase 3：前端 Scene 管理
- SceneList + SceneEditor
- BindingEditor 改造
- WidgetManager 改造（按 Scene）

### Phase 4：统计页面
- StatsView + 图表组件
- 时间分布 + 时间线
- 日期范围选择器

### Phase 5：集成测试 + 清理
- 端到端流程验证
- 清理旧 todo_app_bindings 代码
- 性能测试
