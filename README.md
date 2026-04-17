# SceneTodo

桌面待办事项应用，核心功能是将待办以浮动 Widget 形态挂载到关联的桌面软件窗口上。切换到某软件时自动显示关联待办，切走后自动隐藏。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Tauri 2.0 |
| 后端 | Rust |
| 前端 | React 18 + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| 数据库 | SQLite (rusqlite) |
| 窗口监控 | Win32 API (windows-rs) |
| 构建 | Vite |

## 功能

- 待办 CRUD（创建、编辑、删除、子任务）
- 分组与嵌套分组
- 标签（多标签筛选）
- 优先级与截止日期
- 软件关联（手动关联 exe 进程名）
- 浮动 Widget（自动显示/隐藏/跟随目标窗口）
- Widget 内操作（勾选完成、快速添加）
- 系统托盘（最小化隐藏、暂停 Widget、退出）
- 设置页（开机自启、透明度、Widget 尺寸）

## 项目结构

```
scene-todo/
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs               # 入口
│   │   ├── lib.rs                # Tauri 配置（状态、托盘、命令注册）
│   │   ├── commands/             # Tauri 命令（前端可调用）
│   │   ├── services/             # 业务逻辑
│   │   │   ├── db.rs             # SQLite 连接与迁移
│   │   │   ├── todo_repo.rs      # 待办 CRUD
│   │   │   ├── group_repo.rs     # 分组 CRUD
│   │   │   ├── tag_repo.rs       # 标签 CRUD
│   │   │   ├── app_repo.rs       # 软件档案 + 绑定 CRUD
│   │   │   ├── window_monitor.rs # 前台窗口监控
│   │   │   ├── process_matcher.rs# Win32 进程识别
│   │   │   └── widget_manager.rs # Widget 窗口生命周期
│   │   └── models/               # 数据模型
│   └── migrations/
│       └── 001_init.sql          # 初始建表
│
├── src/                          # React 前端
│   ├── App.tsx                   # 主布局
│   ├── components/
│   │   ├── sidebar/              # 侧边栏（智能视图、分组、标签）
│   │   ├── todo/                 # 待办列表
│   │   ├── widget/               # 浮动 Widget
│   │   ├── binding/              # 软件关联编辑器
│   │   └── settings/             # 设置页
│   ├── hooks/                    # React Hooks
│   ├── lib/invoke.ts             # Tauri invoke 类型安全封装
│   └── types/index.ts            # TypeScript 类型定义
│
├── widget.html                   # Widget 窗口入口
├── vite.config.ts
└── package.json
```

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run tauri dev

# 构建
npm run tauri build
```

## 数据模型

6 张表：`groups`、`tags`、`todos`、`todo_tags`、`apps`、`todo_app_bindings`，支持外键级联和 WAL 模式。

## 窗口监控流程

1. Rust 后台线程每 200ms 轮询前台窗口
2. 检测到前台窗口变化时，提取进程名
3. 匹配已注册的软件档案，通过 Tauri 事件通知前端
4. WidgetManager 创建/显示/隐藏对应的浮动 Widget
5. Widget 定位在目标窗口右上角，支持拖拽记忆位置

## 目标平台

Windows 优先（使用 Win32 API），后续可扩展 macOS。
