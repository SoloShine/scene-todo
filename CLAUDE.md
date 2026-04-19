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

## E2E Testing

- **Toolchain:** WebDriverIO 9 + Mocha + tauri-driver (Tauri's WebDriver bridge)
- **Prerequisites:** `tauri-driver` (`cargo install tauri-driver --locked`), `msedgedriver` in PATH (Windows: `winget install Microsoft.EdgeDriver`)
- **Test location:** `e2e/specs/*.spec.ts`
- **Config:** `e2e/wdio.conf.ts` — auto-builds debug binary, spawns tauri-driver
- **Running:** `cd e2e && npm test` (all) or `npm run test:todo` / `test:scene` / `test:settings`
- **Element selection:** Use `data-testid` attributes (e.g., `[data-testid^="todo-title-"]`)
- **Test data:** Use unique prefixed titles (`Date.now().toString(36)`) to avoid collision with persisted DB data
- **Test case spec:** `docs/superpowers/specs/2026-04-19-e2e-testing-design.md` — TC-01 through TC-23

### Adding new tests
1. Add `data-testid="..."` to the target component if not present
2. Create spec in `e2e/specs/`
3. Use `waitForApp()` helper to wait for the app to load
4. Use unique test data (timestamp prefix) for each test case

### Adding new data-testid
- Format: `data-testid="element-name"` or `data-testid={`element-name-${id}`}`
- Add only the attribute — do not change any other code
- Commit separately: `feat: add data-testid to ComponentName for e2e testing`

## Design Docs

Scene tracking design: `docs/superpowers/specs/2026-04-18-scene-tracking-design.md`
