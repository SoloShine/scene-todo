# SceneTodo — Project Instructions

## Commit Policy

After completing a feature or fix, commit immediately. One logical change per commit. Do not wait for batch phase milestones.

## Tech Stack

- Tauri 2.0 + Rust (backend) + React + TypeScript (frontend)
- SQLite via rusqlite, Win32 API for window monitoring
- Tailwind CSS v4, shadcn/ui, Recharts for charts

## Code Conventions

### Rust (src-tauri/src/)
- Repo functions: `&Database` first arg, return `Result<T, String>`
- Row mapping: standalone `fn row_to_xxx(row: &Row)` helpers
- Models derive `Debug, Clone, Serialize, Deserialize`
- Error messages: short `format!("Verb: {}", e)`
- Dynamic SET clause for partial updates (see `app_repo::update_app` pattern)

### React (src/)
- Hooks in `src/hooks/` — useState/useEffect/useCallback, return state + actions
- API layer in `src/lib/invoke.ts` — thin wrappers around `invoke()`
- Components follow existing directory structure (sidebar/, scene/, stats/, binding/, widget/, todo/)

### Database
- Migrations in `src-tauri/migrations/`, registered in `db.rs`
- `_migrations` table tracks applied migrations
- Keep old tables temporarily when migrating (e.g., `todo_app_bindings`)

## Project Structure

```
src-tauri/src/
  commands/    — Tauri command handlers (thin, delegate to repo)
  models/      — Data structs (Scene, Todo, App, Tag, Group, etc.)
  services/    — Business logic + data access (repo, monitor, tracker)
src/
  components/  — UI components by feature area
  hooks/       — React hooks for data management
  lib/         — API invoke layer
  types/       — TypeScript interfaces (mirror Rust models)
```

## Design Docs

Scene tracking design: `docs/superpowers/specs/2026-04-18-scene-tracking-design.md`
