# Changelog

## [1.0.0] - 2026-04-20

### Highlights

SceneTodo 首个正式版本 — 一款基于场景的 Windows 桌面任务管理工具，自动追踪应用使用时间，将任务与工作场景关联。

SceneTodo v1.0.0 — A scene-based Windows desktop task manager that automatically tracks app usage time and associates tasks with work contexts.

---

### Features / 新功能

#### Task Management / 任务管理

- Todo CRUD with inline editing, search, and filters
- Nested sub-tasks support
- Calendar view with date picker, grouped sections, and status filter
- Group and tag organization with sidebar management
- Auto-bind scene on todo creation
- 任务增删改查，支持内联编辑、搜索、过滤
- 嵌套子任务
- 日历视图，含日期选择器、分组展示、状态过滤
- 分组和标签管理
- 创建任务时自动绑定当前场景

#### Scene Tracking / 场景追踪

- Win32 window monitor with foreground change detection
- TimeTracker service for automatic session recording
- Scene-based time statistics with multi-dimension timeline (day/week/month)
- Data retention and automatic cleanup
- Win32 窗口监控，检测前台窗口切换
- TimeTracker 服务自动记录使用时段
- 多维度时间线统计（日/周/月视图）
- 数据保留策略与自动清理

#### Floating Widget / 悬浮小组件

- Glassmorphism floating widget with current scene tasks
- Quick-add todo from widget
- Click-through passthrough mode
- Widget follows associated app window when moved
- Scene selector and multi-scene filter
- Adjustable opacity (0-100) with real-time preview
- Auto-fit height with DPI awareness
- 毛玻璃风格浮动窗口，显示当前场景任务
- 小组件内快速添加任务
- 穿透模式（鼠标点击穿透）
- 跟随关联应用窗口移动
- 场景选择器和多场景过滤
- 可调节透明度 (0-100)，实时预览
- 自适应高度，支持 DPI 缩放

#### Software Binding / 软件绑定

- Bind applications to scenes via process name matching
- App capture from running processes in editor and settings
- Per-app widget toggle
- App icon extraction from exe files with base64 storage
- Manual icon import via file picker
- 通过进程名将应用绑定到场景
- 在编辑器和设置中捕获运行中的应用
- 按应用开关小组件
- 从 exe 文件提取应用图标（base64 存储）
- 手动导入图标

#### Theme & Appearance / 主题与外观

- Dark/light mode with multiple accent color presets
- Custom CSS theme system with CSS variables
- Windows title bar dark mode via DWM API
- Themed scrollbars, cards, and charts
- Entry/exit animations for todo items
- Fade transitions on view switches
- Smooth collapse/expand sidebar sections
- Custom SceneTodo logo and branding
- 深色/浅色模式，多种强调色预设
- 基于 CSS 变量的自定义主题系统
- 通过 DWM API 实现 Windows 标题栏暗色模式
- 主题化滚动条、卡片、图表
- Todo 条目入场/退出动画
- 视图切换渐变过渡
- 侧边栏平滑折叠/展开
- 自定义 SceneTodo Logo 和品牌

#### System Integration / 系统集成

- System tray with show/pause/quit menu
- OS-level autostart via Tauri plugin
- Global keyboard shortcuts: Ctrl+N (new todo), Ctrl+F (search), Ctrl+1/2 (switch view), Esc (close)
- Pause polling when window is hidden (smart resource usage)
- Data export/import with full backup and restore
- Import validation with structural and referential checks
- Import wrapped in database transaction
- Session crash recovery (persist current timing session to database)
- 系统托盘（显示/暂停/退出）
- 通过 Tauri 插件实现开机自启动
- 全局快捷键：Ctrl+N（新建任务）、Ctrl+F（搜索）、Ctrl+1/2（切换视图）、Esc（关闭）
- 窗口隐藏时暂停轮询，节省资源
- 数据导出/导入，完整备份与恢复
- 导入数据校验（结构和引用完整性检查）
- 导入操作使用数据库事务保护
- 会话崩溃恢复（将当前计时会话持久化到数据库）

#### UI Components / UI 组件

- shadcn/ui integration (Dialog, Input, Badge, Select, Checkbox, Popover, Separator, Sonner)
- Toast notifications across all operations
- ConfirmDialog for destructive actions
- EmptyState components
- Skeleton loading states
- Error handling across all components
- About page with usage guide and GitHub link
- 集成 shadcn/ui 组件库
- 全局 Toast 操作反馈
- 危险操作确认对话框
- 空状态组件
- 骨架屏加载状态
- 全组件错误处理
- 关于页面（使用指南和 GitHub 链接）

---

### Performance / 性能优化

- Replace N+1 queries with batch queries in todo listing
- Batch-optimize scene-based todo queries
- In-memory app cache in WindowMonitor (refreshes every 30s)
- N+1 查询替换为批量查询
- 场景任务查询批量优化
- WindowMonitor 内存应用缓存（30 秒刷新）

---

### Testing / 测试

- E2E testing with WebDriverIO 9 + tauri-driver
- Test coverage: Todo CRUD, Scene management, Settings, Theme
- Test specs for TC-01 through TC-07
- WebDriverIO 9 + tauri-driver 端到端测试
- 覆盖：任务增删改查、场景管理、设置、主题
- TC-01 至 TC-07 测试用例

---

### Architecture / 架构

- SQLite database with migration system
- Rust backend: models, repositories, services (monitor, tracker, widget)
- React frontend: hooks, components by feature area, type-safe invoke layer
- GitHub Actions release workflow (Windows-only, auto-build on tag push)
- Version bump script (syncs package.json, Cargo.toml, tauri.conf.json)
- SQLite 数据库迁移系统
- Rust 后端：模型、仓库、服务（监控、追踪、小组件）
- React 前端：Hooks、按功能组织的组件、类型安全的 invoke 层
- GitHub Actions 发版工作流（仅 Windows，tag 推送时自动构建）
- 版本号同步脚本（同步 package.json、Cargo.toml、tauri.conf.json）
