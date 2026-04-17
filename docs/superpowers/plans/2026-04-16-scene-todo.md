# SceneTodo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> This plan is split into 5 phase documents. Execute them in order. Each phase has its own header with Goal, Architecture, and Tech Stack.

**Goal:** Build a desktop todo app that overlays context-aware todo widgets onto associated desktop application windows.

**Architecture:** Tauri 2.0 app with Rust backend (SQLite + Win32 API) and React/TypeScript frontend. Three core modules: main management window, floating widget windows, and Rust backend services for window monitoring and widget positioning.

**Tech Stack:** Tauri 2.0, Rust, React 18, TypeScript, shadcn/ui (Tailwind CSS), SQLite (rusqlite), windows-rs (Win32 API), Vite

**Spec:** `docs/superpowers/specs/2026-04-16-scene-todo-design.md`

---

## File Structure

### Rust Backend (`src-tauri/`)

| File | Responsibility |
|------|----------------|
| `src-tauri/Cargo.toml` | Rust dependencies: tauri 2.x, rusqlite, windows-rs, serde |
| `src-tauri/tauri.conf.json` | Tauri config: permissions, windows, system tray |
| `src-tauri/src/main.rs` | Entry point — launch Tauri app |
| `src-tauri/src/lib.rs` | Tauri lib setup — register commands, manage state, DB init |
| `src-tauri/src/models/mod.rs` | Re-export all models |
| `src-tauri/src/models/todo.rs` | Todo struct + TodoStatus, Priority enums |
| `src-tauri/src/models/group.rs` | Group struct |
| `src-tauri/src/models/tag.rs` | Tag struct |
| `src-tauri/src/models/app.rs` | App (desktop software profile) + TodoAppBinding structs |
| `src-tauri/src/services/mod.rs` | Re-export all services |
| `src-tauri/src/services/db.rs` | SQLite connection pool, migrations, schema init |
| `src-tauri/src/services/todo_repo.rs` | Todo CRUD database operations |
| `src-tauri/src/services/group_repo.rs` | Group CRUD database operations |
| `src-tauri/src/services/tag_repo.rs` | Tag CRUD database operations |
| `src-tauri/src/services/app_repo.rs` | App + Binding CRUD database operations |
| `src-tauri/src/services/window_monitor.rs` | Win32 foreground window change detection |
| `src-tauri/src/services/process_matcher.rs` | Match running process to registered apps |
| `src-tauri/src/services/widget_manager.rs` | Widget window lifecycle management |
| `src-tauri/src/commands/mod.rs` | Re-export all commands |
| `src-tauri/src/commands/todo_cmd.rs` | Tauri commands: todo CRUD |
| `src-tauri/src/commands/group_cmd.rs` | Tauri commands: group CRUD |
| `src-tauri/src/commands/tag_cmd.rs` | Tauri commands: tag CRUD |
| `src-tauri/src/commands/app_cmd.rs` | Tauri commands: app + binding CRUD |
| `src-tauri/migrations/001_init.sql` | Initial schema |

### Frontend (`src/`)

| File | Responsibility |
|------|----------------|
| `src/main.tsx` | React entry — mount App, import styles |
| `src/App.tsx` | Root layout — sidebar + content area |
| `src/index.css` | Tailwind directives + global styles |
| `src/types/index.ts` | TypeScript interfaces matching Rust models |
| `src/lib/invoke.ts` | Type-safe wrapper around `@tauri-apps/api invoke` |
| `src/components/sidebar/Sidebar.tsx` | Sidebar shell |
| `src/components/sidebar/SmartViews.tsx` | "All / Today / Important" filter buttons |
| `src/components/sidebar/GroupList.tsx` | Group tree with CRUD |
| `src/components/sidebar/TagList.tsx` | Tag list with multi-select filter |
| `src/components/todo/TodoList.tsx` | Main todo list |
| `src/components/todo/TodoItem.tsx` | Single todo row |
| `src/components/todo/TodoForm.tsx` | Quick-add + expandable form |
| `src/components/widget/Widget.tsx` | Floating widget for one app |
| `src/components/widget/WidgetTodoItem.tsx` | Widget todo row |
| `src/components/binding/BindingEditor.tsx` | Dialog to bind apps to todo |
| `src/components/settings/Settings.tsx` | Settings page |
| `src/hooks/useTodos.ts` | Hook for todo CRUD |
| `src/hooks/useGroups.ts` | Hook for group CRUD |
| `src/hooks/useTags.ts` | Hook for tag CRUD |
| `src/hooks/useApps.ts` | Hook for app + binding CRUD |

### Root Config

| File | Responsibility |
|------|----------------|
| `package.json` | NPM dependencies |
| `vite.config.ts` | Vite config with Tauri plugin |
| `tsconfig.json` | TypeScript config |
| `tailwind.config.js` | Tailwind config |
| `components.json` | shadcn/ui config |
| `index.html` | HTML shell for Vite |

---

## Plan Files

Each phase is in a separate document. Execute them in order.

| Phase | File | Description |
|-------|------|-------------|
| 1 | [phase1-scaffold-db.md](phase1-scaffold-db.md) | Project scaffold, dependencies, SQLite, models, Tauri state |
| 2 | [phase2-backend-crud.md](phase2-backend-crud.md) | Repo layer + Tauri commands for all entities |
| 3 | [phase3-main-window.md](phase3-main-window.md) | React app shell, sidebar, todo list, groups, tags UI |
| 4 | [phase4-widget-system.md](phase4-widget-system.md) | Win32 window monitor, process matcher, widget manager, widget UI |
| 5 | [phase5-integration.md](phase5-integration.md) | System tray, settings, autostart, polish |

---

## Dependency Graph

```
Phase 1 (scaffold + DB)
  └─► Phase 2 (backend CRUD)
       └─► Phase 3 (main window UI)
       └─► Phase 4 (widget system) ← depends on Phase 2 for data
            └─► Phase 5 (integration)
```

Phase 3 and Phase 4 can be developed in parallel after Phase 2 is complete.
