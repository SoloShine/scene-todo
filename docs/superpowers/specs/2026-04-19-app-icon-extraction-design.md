# App Icon Extraction Design

## Goal

Extract application icons from running processes using Win32 API, save as PNG, and display them in the UI (settings page and stats/scene views).

## Architecture

### Backend (Rust)

**Icon extraction pipeline:**

1. When window monitor detects a new process, resolve its full exe path via `QueryFullProcessImageNameW`
2. Use `ExtractIconExW` to get the HICON, then GDI (`GetIconInfo` + `BITMAP` + PNG encoder) to save as PNG
3. Save to `{app_data_dir}/icons/{app_id}.png`
4. Update `apps.icon_path` in SQLite with the relative path

**New Rust dependencies:**
- `image` crate for PNG encoding (or use raw GDI bitmap→PNG)

**New command:**
- `extract_app_icon(app_id: i64)` — manually trigger icon extraction for an app
- `get_icon_path(app_id: i64) -> Option<String>` — return the icon file path for frontend

**Auto-extraction:** Integrated into existing window monitoring flow — when a new app is detected and has no icon_path, extract automatically.

### Database

No schema changes needed — `apps.icon_path` column already exists (`TEXT, nullable`).

### Frontend

**Tauri asset protocol:** Use `convertFileSrc()` from `@tauri-apps/api` to convert local file paths into webview-loadable URLs.

**Display locations:**
- **Settings page** — app list shows actual icons instead of placeholder
- **Stats/Scene views** — scene cards and time breakdowns show app icons

## Implementation Steps

1. Add Rust icon extraction module (`src-tauri/src/services/icon_extractor.rs`)
2. Add `extract_app_icon` and `refresh_all_icons` Tauri commands
3. Hook into window monitor to auto-extract on new app detection
4. Update frontend components to display icons via asset protocol
5. Add "refresh icons" button in Settings for manual re-extraction
