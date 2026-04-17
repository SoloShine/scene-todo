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
| track_time | INTEGER | 是否追踪时间，默认 1（BOOLEAN） |
| created_at | TEXT | 创建时间 |

#### scene_apps（场景-应用关联，多对多）

| 字段 | 类型 | 说明 |
|------|------|------|
| scene_id | INTEGER FK → scenes.id | 场景 ID，ON DELETE CASCADE |
| app_id | INTEGER FK → apps.id | 应用 ID，ON DELETE CASCADE |
| priority | INTEGER | 匹配优先级，默认 0（值越大越优先）。UI 中通过拖拽排序 App 列表来间接设置，用户无需关心数值 |
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

### 场景冲突解决策略

当同一 App 属于多个 Scene 时，按以下优先级依次判断：

1. **最近活跃 Scene 优先**：WindowMonitor 维护 `last_active_scene_id`，前台 App 切换时优先归属到上次活跃的 Scene
2. **scene_apps.priority 次之**：若最近活跃 Scene 不包含当前 App，按 `priority` 降序选择（默认 0，值越大越优先）
3. **手动切换兜底**：系统托盘菜单增加「当前场景」子菜单，用户可手动指定当前 Scene；手动选择会更新 `last_active_scene_id`，后续自动检测优先沿用

冲突解决流程：

```
前台窗口变化 → 查找 App 所属的所有 Scene
  → 最近活跃 Scene 是否包含此 App？→ 是 → 使用该 Scene
                                      → 否 → 按 priority 降序取第一个
                                              → 发射 foreground-changed(scene_id, ...)
```

### 时间追踪性能与隐私

**批量写入**：WindowMonitor 在内存中维护当前 session，不每次切换都写 DB。每 5 秒或在应用退出时 flush 到数据库。减少频繁 DB 写入。

**按场景开关追踪**：`scenes.track_time` 字段控制是否记录该场景的时间。用户可在场景编辑器中关闭不想追踪的场景（如浏览器、聊天工具）。

**数据保留策略**：Settings 中增加「数据保留天数」配置（默认 90 天）。启动时检查并清理过期 time_sessions 记录。

**全局暂停**：系统托盘菜单增加「暂停追踪」选项，暂停期间不记录任何 time_session。状态持久化，重启后保持。

### 数据迁移

迁移脚本 `002_scene_tracking.sql`：

1. 创建 `scenes`、`scene_apps`、`todo_scene_bindings`、`time_sessions` 四张新表
2. **完整性检查**：只处理 `apps` 表中有至少一条 `todo_app_bindings` 记录的有效 App，跳过孤立 App
3. 为每个有效 App 自动创建同名 Scene（单 App 场景）
4. **去重处理**：若多个 App 的 display_name 或 name 相同，Scene 名称加后缀（如 "VS Code"、"VS Code (2)"）
5. 插入 `scene_apps` 将每个 App 关联到其自动创建的 Scene，priority 默认 0
6. 将 `todo_app_bindings` 数据迁移到 `todo_scene_bindings`（通过自动创建的 Scene 映射）
7. **迁移验证**：迁移后执行验证查询，确认记录数一致：`SELECT COUNT(*) FROM todo_app_bindings` == `SELECT COUNT(*) FROM todo_scene_bindings`
8. 保留 `todo_app_bindings` 表暂时不删除（后续版本清理）

### 子任务继承逻辑更新

现有代码中子任务会继承父任务的 App 绑定。迁移后更新为：

- `get_todo_with_details()` 中，`bound_scene_ids` 的查询逻辑：若 todo 无直接绑定，向上查找 parent 的 `bound_scene_ids`
- Widget 查询改为：`SELECT t.* FROM todos t JOIN todo_scene_bindings tsb ON t.id = tsb.todo_id WHERE tsb.scene_id = ? AND t.status = 'pending'`
- 同时包含子任务继承的待办：`SELECT t.* FROM todos t WHERE t.parent_id IN (SELECT todo_id FROM todo_scene_bindings WHERE scene_id = ?) AND t.status = 'pending'`

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
2. 查找新 App 所属的 Scene（按冲突解决策略）
3. 创建新 time_session（scene_id, app_id, started_at = now），仅当 `scene.track_time == 1` 时记录
4. 发射增强版 `foreground-changed` 事件，新增字段：
   - `scene_id: Option<i64>`
   - `scene_name: Option<String>`

新增状态维护：
- `last_active_scene_id: Arc<Mutex<Option<i64>>>` — 最近活跃 Scene，用于冲突解决
- `current_session: Arc<Mutex<Option<TimeSession>>>` — 当前进行中的 session，内存持有
- `pause_tracking: Arc<Mutex<bool>>` — 全局追踪暂停状态

### WidgetManager 改造

- Widget 标识从 `widget-{app_id}` 改为 `widget-scene-{scene_id}`
- 按 scene_id 创建/显示 Widget
- **同 Scene 内 App 切换**：不重建 Widget，但重新定位到新 App 窗口位置（平滑移动过渡）
- **Widget 偏移量策略**：保持 per-app 的 offset 记录（`save_widget_offset`），Scene 内切换 App 时使用目标 App 的偏移量。若目标 App 无记录，使用当前 Widget 的屏幕绝对位置
- Widget URL 改为 `/widget?scene_id={id}&scene_name={encoded_name}`
- 查询该 Scene 下所有待办（通过 `todo_scene_bindings`，含子任务继承）

### 新增 Tauri Commands

**Scene 管理**：
- `create_scene(CreateScene) → Scene`
- `list_scenes() → Vec<Scene>`
- `update_scene(UpdateScene) → Scene`
- `delete_scene(id: i64) → ()`
- `add_app_to_scene(scene_id: i64, app_id: i64, priority: i32) → ()`
- `remove_app_from_scene(scene_id: i64, app_id: i64) → ()`
- `get_active_scene() → Option<Scene>` — 获取当前活跃 Scene
- `set_active_scene(scene_id: i64) → ()` — 手动切换当前 Scene

**时间统计**：
- `get_time_summary(range_start: String, range_end: String) → Vec<SceneTimeSummary>`
  - `SceneTimeSummary { scene_id, scene_name, color, total_secs, percentage }`
  - 返回结果最后一项为"未分类"：`scene_id = -1, scene_name = "其他", color = "#9CA3AF"`，聚合所有 `scene_id IS NULL` 的 session
- `get_time_detail(scene_id: i64, range_start: String, range_end: String) → Vec<AppTimeDetail>`
  - `AppTimeDetail { app_id, app_name, total_secs }`
- `get_time_sessions(range_start: String, range_end: String, limit: i64) → Vec<TimeSession>`
- `set_tracking_paused(paused: bool) → ()` — 全局暂停/恢复追踪
- `get_tracking_status() → TrackingStatus` — 当前追踪状态（paused/active + current scene）

### 新增 Models

```rust
// Scene
Scene { id, name, icon, color, sort_order, track_time, created_at }
CreateScene { name, icon, color, track_time }
UpdateScene { id, name, icon, color, sort_order, track_time }

// Time tracking
TimeSession { id, scene_id, app_id, started_at, ended_at, duration_secs }
SceneTimeSummary { scene_id, scene_name, color, total_secs, percentage }
AppTimeDetail { app_id, app_name, total_secs }
TrackingStatus { paused, current_scene_id, current_scene_name, session_started_at }
```

## 前端变更

### 场景管理 UI

**侧边栏新增「场景」区域**（`SceneList.tsx`）：
- 显示所有场景列表，样式类似现有 GroupList
- 每个场景显示图标 + 名称
- 点击场景 → 筛选该场景关联的 Todo
- 右键/编辑 → 打开场景编辑器

**场景编辑器**（`SceneEditor.tsx`）：
- 场景名称 + emoji 图标 + 颜色选择
- 「追踪时间」开关（对应 scenes.track_time）
- 已关联 App 列表，支持添加/移除，支持调整 priority
- **拖拽排序设置优先级**：App 列表支持拖拽排序，排列顺序即为 priority 值（越靠前优先级越高）。用户无需理解数值含义
- 支持通过窗口抓取添加新 App 到场景

### BindingEditor 改造

- 标题从「关联软件」改为「关联场景」
- 选择目标从 App 列表变为 Scene 列表
- 仍支持窗口抓取：抓取后自动匹配到包含该 App 的 Scene，若有多个则弹出选择；或提示创建新场景

### 统计页面（`StatsView.tsx`）

独立页面，侧边栏底部入口（与 Settings 并列）。

**布局**：
- 顶部：日期范围选择器（今天 / 本周 / 本月 / 自定义）
- **今日实时概览**：当前活跃场景 + 今日已追踪总时间 + 活跃场景时长（实时更新）
- 主体左：时间分布环形图（按 Scene 占比，Recharts）。**scene_id 为 NULL 的"未分类"时间显示为灰色「其他」类别**
- 主体右：场景排行列表（名称 + 时间 + 百分比进度条）。「其他」类别始终显示在列表末尾
- 下方：时间线视图（自定义 SVG/CSS 实现横向条形图，24 小时轴，每个场景一个色块）
- 点击场景展开：各 App 的时间明细

**图表库**：
- 环形图 + 排行列表：Recharts
- 时间线视图：自定义 SVG 实现（Recharts BarChart 对此场景灵活性不足，自定义方案支持不连续时间段、场景颜色映射、hover tooltip）

### Widget 微调

- Widget 标题显示 Scene 图标 + 名称（替代 App 名称）
- URL 参数从 `app_id/app_name` 改为 `scene_id/scene_name`
- 查询待办通过 `todo_scene_bindings` 而非 `todo_app_bindings`

### 系统托盘增强

- 新增「当前场景」子菜单，显示所有场景列表，可手动切换（带 check 标记）
- 新增「暂停追踪」选项（toggle）

## TypeScript 类型变更

```typescript
// 新增
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
| migrations/002_scene_tracking.sql | 新增 | 数据库迁移脚本（含验证查询） |
| models/scene.rs | 新增 | Scene + 时间追踪模型 |
| commands/scene_cmd.rs | 新增 | Scene CRUD + 时间统计 + 追踪控制命令 |
| services/scene_repo.rs | 新增 | Scene 数据访问层 |
| services/time_tracker.rs | 新增 | 时间追踪服务（session 批量写入、内存持有） |
| services/window_monitor.rs | 修改 | 集成时间追踪、冲突解决策略、增强事件 |
| services/widget_manager.rs | 修改 | 按 Scene 管理 Widget、同场景内平滑重定位 |
| services/app_repo.rs | 修改 | 新增按 Scene 查询待办方法 |
| services/todo_repo.rs | 修改 | todo_scene_bindings 查询、子任务继承更新 |
| commands/app_cmd.rs | 修改 | 移除直接绑定，改为通过 Scene |
| lib.rs | 修改 | 注册新命令、系统托盘增强 |

### React 前端（src/）

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| types/index.ts | 修改 | 新增 Scene、TimeSession、TrackingStatus 等类型 |
| hooks/useScenes.ts | 新增 | Scene CRUD hook |
| hooks/useTimeStats.ts | 新增 | 时间统计 hook |
| lib/invoke.ts | 修改 | 新增 Scene、时间统计、追踪控制 API |
| components/sidebar/SceneList.tsx | 新增 | 侧边栏场景列表 |
| components/sidebar/Sidebar.tsx | 修改 | 集成场景列表 + 统计入口 |
| components/scene/SceneEditor.tsx | 新增 | 场景编辑器（含追踪开关、优先级） |
| components/scene/ScenePicker.tsx | 新增 | 场景选择器（用于绑定） |
| components/stats/StatsView.tsx | 新增 | 统计页面主组件（含实时概览） |
| components/stats/TimeDistribution.tsx | 新增 | 时间分布环形图（Recharts） |
| components/stats/SceneTimeline.tsx | 新增 | 场景时间线（自定义 SVG） |
| components/stats/RealtimeOverview.tsx | 新增 | 今日实时概览组件 |
| components/binding/BindingEditor.tsx | 修改 | 从选 App 改为选 Scene，多 Scene 弹出选择 |
| components/widget/Widget.tsx | 修改 | 接收 scene 参数，显示场景图标+名称 |
| components/settings/Settings.tsx | 修改 | 新增数据保留天数配置 |
| App.tsx | 修改 | 新增统计页面路由 |

## 实施分阶段

### Phase 1：数据模型 + 迁移 + 验证
- 创建迁移脚本（含完整性检查、去重、验证查询）
- 新增 Scene model + repo
- 数据迁移逻辑
- **验证点**：迁移脚本正确执行、记录数一致、数据无损

### Phase 2a：后端 Scene CRUD
- Scene 命令（CRUD + App 管理 + priority）
- 冲突解决策略实现
- 手动切换 Scene 命令

### Phase 2b：后端时间追踪
- TimeTracker 服务（内存 session、批量 flush）
- 集成到 WindowMonitor（含 track_time 检查、全局暂停）
- 时间统计查询命令
- 数据清理逻辑

### Phase 3：前端 Scene 管理
- SceneList + SceneEditor（含追踪开关）
- BindingEditor 改造

### Phase 4：Widget 改造
- WidgetManager 按 Scene 管理（独立阶段，核心行为变化）
- 同 Scene 内 App 切换平滑重定位
- Widget UI 更新（场景图标+名称）
- 增加测试覆盖

### Phase 5：统计页面
- StatsView + 实时概览
- 时间分布环形图（Recharts）
- 时间线视图（自定义 SVG）
- 日期范围选择器
- Settings 新增数据保留天数

### Phase 6：系统集成 + 清理
- 系统托盘增强（当前场景菜单、暂停追踪）
- 端到端流程验证
- 清理旧 todo_app_bindings 代码
- 性能测试

## 未来方向（Out of Scope for this iteration）

以下功能记录为后续迭代方向，不在本次实现范围：

| 功能 | 说明 |
|------|------|
| 智能场景建议 | 检测用户频繁同时使用的 App 组合，提示创建场景 |
| 场景切换全局热键 | 快捷键快速切换当前场景 |
| 统计数据导出 | CSV/PDF 导出时间统计 |
| 多显示器支持 | Scene 关联的 App 在副屏时，Widget 定位需处理坐标映射 |
| 多维度场景触发 | 除 App 外增加时间段、日历事件等触发条件 |
| 场景工作流/模板 | 每个场景有专属的待办模板和展示布局 |
