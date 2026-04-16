# Overlay Todo — 产品设计文档

## 概述

Overlay Todo 是一款桌面待办事项应用，核心差异化功能是将待办事项以浮动 Widget 形态挂载到关联的桌面软件窗口上。当用户切换到某个软件时，自动显示该软件关联的待办；切换走后自动隐藏。

**目标用户：** 多窗口工作的知识工作者（设计师、开发者、编辑等经常在多个软件间切换的人群）

**产品定位：** MVP 验证优先，验证"上下文关联待办提醒"是否有持续使用价值

**目标平台：** Windows 优先，后续扩展 macOS

## 技术方案

**方案：Tauri 2.0 + Rust + React + TypeScript**

选择理由：
- Rust 后端可直接调用 Win32 API 实现窗口监控和管理
- Web 前端（React）高效构建 UI
- Tauri 2.0 原生支持多窗口管理
- 打包体积小（3-5MB），适合常驻后台工具
- 跨平台成本低，后续 macOS 扩展方便

| 层 | 技术 | 理由 |
|----|------|------|
| 桌面框架 | Tauri 2.0 | 多窗口管理、Rust 原生能力、轻量打包 |
| 后端语言 | Rust | 窗口 API 调用、高性能事件处理 |
| 前端框架 | React + TypeScript | 组件化开发，生态成熟 |
| UI 库 | shadcn/ui (Tailwind) | 轻量、可定制、不臃肿 |
| 数据库 | SQLite (rusqlite) | 本地存储，零配置，单文件 |
| 窗口监控 | windows-rs crate | 微软官方 Rust 绑定，调用 Win32 API |
| 构建 | Vite | 快速 HMR，Tauri 官方推荐 |

关键依赖：`tauri` 2.x、`windows` (Win32 API)、`rusqlite`、`serde`

## 架构

产品由 3 个核心模块组成：

1. **主窗口（管理界面）** — 待办 CRUD、分组标签管理、软件关联编辑、设置
2. **浮动 Widget 窗口（多个实例）** — 每个处于前台的目标软件各一个，展示关联待办
3. **Rust 后端核心** — 窗口监控、Widget 定位跟随、数据持久化、进程匹配

### 数据流

1. 用户在主窗口创建待办，手动关联一个或多个桌面软件（通过进程名识别）
2. Rust 后端持续监控前台窗口变化（200ms 轮询）
3. 当目标软件切到前台时，自动创建/显示对应的浮动 Widget，展示关联待办
4. 当目标软件切到后台时，Widget 自动隐藏
5. 用户可在 Widget 上直接勾选完成待办

## 数据模型

### groups（分组）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| name | TEXT | 分组名称 |
| color | TEXT | 颜色标识（hex） |
| sort_order | INTEGER | 排序权重 |
| parent_id | INTEGER FK | 自关联，支持嵌套分组 |

### tags（标签）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| name | TEXT | 标签名称 |
| color | TEXT | 颜色标识（hex） |

### todos（待办事项）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| title | TEXT | 待办标题 |
| description | TEXT | 详细描述（可空） |
| status | TEXT | 枚举：pending / completed |
| priority | TEXT | 枚举：high / medium / low |
| group_id | INTEGER FK | 所属分组（可空） |
| parent_id | INTEGER FK | 自关联，支持子任务嵌套 |
| sort_order | INTEGER | 排序权重 |
| due_date | DATETIME | 截止日期（可空） |
| created_at | DATETIME | 创建时间 |
| completed_at | DATETIME | 完成时间（可空） |

### todo_tags（待办-标签关联，多对多）

| 字段 | 类型 | 说明 |
|------|------|------|
| todo_id | INTEGER FK | 待办 ID |
| tag_id | INTEGER FK | 标签 ID |

### apps（桌面软件档案）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| name | TEXT | 显示名称 |
| process_names | TEXT | 进程名列表，JSON 数组（如 `["WINWORD.EXE"]`） |
| icon_path | TEXT | 提取的图标路径 |
| display_name | TEXT | 用户友好的名称 |

### todo_app_bindings（待办-软件关联，多对多）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| todo_id | INTEGER FK | 待办 ID |
| app_id | INTEGER FK | 软件 ID |

## 浮动 Widget 行为

### 生命周期

```
目标软件切到前台 → 检测到有关联待办 → 创建/显示 Widget
                                       ↓
                              用户拖拽定位 Widget
                                       ↓
目标软件切到后台 → Widget 隐藏（记住位置）
                                       ↓
目标软件再次前台 → Widget 在原位置重新显示
                                       ↓
目标软件窗口关闭 → Widget 销毁，下次打开时恢复默认位置
```

### 窗口属性

| 属性 | 行为 | 实现方式 |
|------|------|---------|
| 层级 | 始终在目标软件窗口之上，不遮挡其他软件 | `HWND_TOPMOST` + 检测前台窗口归属 |
| 跟随 | 目标窗口移动/缩放时，Widget 跟随移动 | 监听 `EVENT_OBJECT_LOCATIONCHANGE` |
| 定位 | 用户可自由拖拽，位置相对目标窗口保存 | 记录 `(目标窗口HWND, 相对offset)` |
| 隐藏 | 目标软件不在前台时自动隐藏 | 监听 `EVENT_SYSTEM_FOREGROUND` |
| 透明度 | 默认 90%，鼠标悬停时 100% | `SetLayeredWindowAttributes` |
| 置顶规则 | 只在目标软件为前台时置顶 | `WS_EX_NOACTIVATE` |

### Widget 内布局（紧凑型）

```
┌─────────────────────────┐
│ 📌 Word 任务 (3)    ▾ ✕ │  ← 标题栏：软件名 + 数量，可折叠/关闭
├─────────────────────────┤
│ ☐ 修改第三章的数据图表    │  ← 待办项，可点击勾选
│ ☐ 补充参考文献           │
│ ☑ 更新封面信息      ✓   │  ← 已完成项，灰色划线
├─────────────────────────┤
│ ＋ 添加待办              │  ← 快速添加入口
└─────────────────────────┘
```

### Widget 中的展示逻辑

- 默认按分组折叠显示关联待办
- 子任务以缩进形式呈现，父任务显示完成进度（如 3/5）
- 标签以小色块展示，可点击筛选

## 主窗口设计

侧边栏 + 内容区布局：

**侧边栏区域：**

| 区域 | 内容 | 交互 |
|------|------|------|
| 智能视图 | 全部 / 今天 / 重要 | 点击切换筛选 |
| 分组 | 工作 / 个人 / 学习... | 增删改、嵌套、拖拽排序 |
| 标签 | 彩色标签列表 | 点击筛选，支持多选 |
| 底部 | 设置入口 | 点击打开设置页 |

**待办列表交互：**

- 每个待办右侧显示已关联的软件小图标，点击编辑关联
- 右键菜单：编辑 / 删除 / 设置优先级 / 关联软件 / 添加子任务
- 拖拽排序
- 快速添加输入框（回车创建）
- 子任务折叠展开

**设置页（MVP）：**

- 开机自启开关
- Widget 默认透明度
- Widget 默认尺寸（小/中/大）
- 已关联软件管理

**系统托盘：**

- 最小化到托盘，不显示在任务栏
- 右键菜单：显示主窗口 / 暂停 Widget / 退出

## 性能目标

- 后台常驻内存 < 50MB
- 前台切换时 Widget 出现延迟 < 300ms
- 窗口事件回调通过 Rust 直接处理，不经过 JS 桥接
- 前台检测频率 200ms

## 项目结构

```
overlay-todo/
├── src-tauri/                    # Rust 后端
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs               # Tauri 入口，系统托盘
│   │   ├── commands/             # Tauri 命令（前端可调用）
│   │   │   ├── todo.rs
│   │   │   ├── group.rs
│   │   │   ├── tag.rs
│   │   │   └── app_binding.rs
│   │   ├── services/             # 业务逻辑
│   │   │   ├── db.rs
│   │   │   ├── window_monitor.rs
│   │   │   ├── widget_manager.rs
│   │   │   └── process_matcher.rs
│   │   └── models/               # 数据模型
│   │       ├── todo.rs
│   │       ├── group.rs
│   │       ├── tag.rs
│   │       └── app.rs
│   └── migrations/
│       └── 001_init.sql
│
├── src/                          # Web 前端
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── sidebar/
│   │   ├── todo/
│   │   ├── widget/
│   │   ├── binding/
│   │   └── settings/
│   ├── hooks/
│   └── styles/
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── tauri.conf.json
```

## MVP 范围

### In Scope

| 功能 | 优先级 |
|------|--------|
| 待办 CRUD | P0 |
| 分组与嵌套 | P0 |
| 标签（多标签、筛选） | P0 |
| 子任务（一层嵌套） | P0 |
| 软件关联（手动关联 exe） | P0 |
| 浮动 Widget（自动显示/隐藏/跟随） | P0 |
| Widget 内操作（勾选完成、快速添加） | P0 |
| 系统托盘 | P0 |
| 设置页（自启、透明度、尺寸） | P1 |
| 优先级与截止日期 | P1 |

### Out of Scope

- 云同步 / 多设备
- 团队协作 / 分享
- 自然语言日期解析
- Widget 内编辑待办详情（只支持勾选和快速添加）
- 快捷键全局绑定
- macOS 支持
- 系统通知推送

### 验证成功标准

1. 能完整走通"创建待办 → 关联 Word → 打开 Word → Widget 出现 → 勾选完成"全流程
2. 10+ 窗口频繁切换下，Widget 不卡顿、不错乱、不崩溃
3. 后台常驻内存 < 50MB，Widget 出现延迟 < 300ms
4. 持续使用 1 周，确认"窗口关联待办"核心交互比普通待办软件更有用
