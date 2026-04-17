# Phase 4: Window Monitor + Widget System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Win32 foreground window monitoring, process-to-app matching, floating widget lifecycle management, and the widget React UI.

**Architecture:** Rust background thread polls foreground window (200ms) via Win32 API. On change, emits Tauri event. WidgetManager listens and creates/shows/hides Tauri WebviewWindows positioned relative to target app window. Widget frontend is a separate React entry point with compact todo display.

**Tech Stack:** Rust, windows-rs (Win32 API), Tauri 2.0 multi-window, React, TypeScript

**Parent:** [2026-04-16-scene-todo.md](2026-04-16-scene-todo.md)

**Depends on:** Phase 2 (backend CRUD, especially `find_app_by_process` and `list_todos_by_app`)

---

### Task 15: Process Matcher Service

**Files:**
- Modify: `src-tauri/src/services/process_matcher.rs`

- [ ] **Step 1: Write process matcher with tests**

File: `src-tauri/src/services/process_matcher.rs`
```rust
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;

/// Extract the process name (e.g. "WINWORD.EXE") from a window handle.
/// Returns None if the handle is invalid or the process cannot be opened.
pub fn get_process_name_from_hwnd(hwnd: windows::Win32::Foundation::HWND) -> Option<String> {
    use windows::Win32::System::Threading::{
        GetWindowThreadProcessId, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::Foundation::CloseHandle;

    unsafe {
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 { return None; }

        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 260];
        let len = windows::Win32::System::Threading::QueryFullProcessImageNameW(
            handle,
            windows::Win32::System::Threading::PROCESS_NAME_FORMAT::default(),
            &mut buf,
        );
        let _ = CloseHandle(handle);

        if let Ok(len) = len {
            let path = OsString::from_wide(&buf[..len as usize]);
            let path_str = path.to_string_lossy();
            // Extract just the filename
            path_str
                .rsplit('\\')
                .next()
                .map(|s| s.to_uppercase())
        } else {
            None
        }
    }
}

/// Get the window title text from a window handle.
pub fn get_window_title(hwnd: windows::Win32::Foundation::HWND) -> Option<String> {
    use windows::Win32::UI::WindowsAndMessaging::{GetWindowTextLengthW, GetWindowTextW};

    unsafe {
        let len = GetWindowTextLengthW(hwnd);
        if len == 0 { return None; }

        let mut buf = vec![0u16; (len + 1) as usize];
        GetWindowTextW(hwnd, &mut buf);
        let title = OsString::from_wide(&buf[..len as usize]);
        Some(title.to_string_lossy().into_owned())
    }
}

/// Get the position and size of a window.
pub fn get_window_rect(hwnd: windows::Win32::Foundation::HWND) -> Option<(i32, i32, i32, i32)> {
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::GetWindowRect;

    unsafe {
        let mut rect = RECT::default();
        GetWindowRect(hwnd, &mut rect).ok()?;
        Some((rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_name_from_current_window() {
        // Get the console/terminal window — should return a valid process name
        // This test may return None in some environments; that's acceptable.
        let hwnd = unsafe {
            windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow()
        };
        let name = get_process_name_from_hwnd(hwnd);
        // We just verify it doesn't panic; the result depends on environment
        println!("Current foreground process: {:?}", name);
    }

    #[test]
    fn test_get_window_rect_current() {
        let hwnd = unsafe {
            windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow()
        };
        let rect = get_window_rect(hwnd);
        println!("Foreground window rect: {:?}", rect);
    }
}
```

- [ ] **Step 2: Run tests**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo test --lib services::process_matcher -- --nocapture
```

Expected: Tests pass and print debug info (results depend on environment).

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/services/process_matcher.rs
git commit -m "feat: add Win32 process name and window info extraction"
```

---

### Task 16: Window Monitor Service

**Files:**
- Modify: `src-tauri/src/services/window_monitor.rs`

- [ ] **Step 1: Write window monitor service**

File: `src-tauri/src/services/window_monitor.rs`
```rust
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::AppHandle;
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

use crate::services::db::Database;
use crate::services::process_matcher;
use crate::services::app_repo;

/// Event emitted to the frontend when the foreground window changes
/// and matches a registered app.
#[derive(Debug, Clone, serde::Serialize)]
pub struct ForegroundChanged {
    pub process_name: String,
    pub app_id: Option<i64>,
    pub app_name: Option<String>,
    pub hwnd: isize,
}

/// State tracked by the window monitor.
pub struct WindowMonitor {
    app_handle: AppHandle,
    db: Arc<Database>,
    running: Arc<Mutex<bool>>,
    last_hwnd: Arc<Mutex<isize>>,
}

impl WindowMonitor {
    pub fn new(app_handle: AppHandle, db: Arc<Database>) -> Self {
        Self {
            app_handle,
            db,
            running: Arc::new(Mutex::new(false)),
            last_hwnd: Arc::new(Mutex::new(0)),
        }
    }

    /// Start monitoring in a background thread.
    /// Polls foreground window every 200ms.
    pub fn start(&self) {
        let mut running = self.running.lock().unwrap();
        if *running { return; }
        *running = true;

        let app_handle = self.app_handle.clone();
        let db = self.db.clone();
        let running_flag = self.running.clone();
        let last_hwnd = self.last_hwnd.clone();

        std::thread::spawn(move || {
            loop {
                {
                    let r = running_flag.lock().unwrap();
                    if !*r { break; }
                }

                let foreground: HWND = unsafe { GetForegroundWindow() };
                let current_hwnd = foreground.0 as isize;

                {
                    let mut last = last_hwnd.lock().unwrap();
                    if *last != current_hwnd && current_hwnd != 0 {
                        *last = current_hwnd;

                        // Get process name
                        if let Some(process_name) = process_matcher::get_process_name_from_hwnd(foreground) {
                            // Look up if this process matches a registered app
                            let db_conn = db.conn.lock().unwrap();
                            let matched_app = app_repo::find_app_by_process_conn(&db_conn, &process_name);
                            drop(db_conn);

                            let event = ForegroundChanged {
                                process_name: process_name.clone(),
                                app_id: matched_app.as_ref().map(|a| a.id),
                                app_name: matched_app.as_ref().map(|a| a.name.clone()),
                                hwnd: current_hwnd,
                            };

                            let _ = app_handle.emit("foreground-changed", &event);
                        }
                    }
                }

                std::thread::sleep(Duration::from_millis(200));
            }
        });
    }

    pub fn stop(&self) {
        let mut running = self.running.lock().unwrap();
        *running = false;
    }

    pub fn is_running(&self) -> bool {
        *self.running.lock().unwrap()
    }
}
```

- [ ] **Step 2: Add `find_app_by_process_conn` to app_repo**

Add to `src-tauri/src/services/app_repo.rs`:
```rust
/// Find app by process name using an existing connection (avoids deadlock when called from monitor).
pub fn find_app_by_process_conn(conn: &rusqlite::Connection, process_name: &str) -> Option<App> {
    let apps: Vec<App> = conn.prepare(
        "SELECT id, name, process_names, icon_path, display_name FROM apps"
    ).ok()?
    .query_map([], row_to_app).ok()?
    .filter_map(|r| r.ok()).collect();

    for app in apps {
        if let Ok(names) = serde_json::from_str::<Vec<String>>(&app.process_names) {
            if names.iter().any(|n| n.eq_ignore_ascii_case(process_name)) {
                return Some(app);
            }
        }
    }
    None
}
```

- [ ] **Step 3: Verify compilation**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo check
```

Expected: Compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/services/window_monitor.rs src-tauri/src/services/app_repo.rs
git commit -m "feat: add window monitor with foreground change detection"
```

---

### Task 17: Widget Manager Service

**Files:**
- Modify: `src-tauri/src/services/widget_manager.rs`

- [ ] **Step 1: Write widget manager**

File: `src-tauri/src/services/widget_manager.rs`
```rust
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow};
use windows::Win32::Foundation::HWND;

use crate::services::process_matcher;
use crate::services::window_monitor::ForegroundChanged;

/// Tracks which widgets are currently visible and their positions relative to target windows.
pub struct WidgetManager {
    /// Map from app_id to widget window label
    active_widgets: Mutex<HashMap<i64, String>>,
    /// Map from app_id to stored position offset (x, y) relative to target window top-right
    widget_offsets: Mutex<HashMap<i64, (i32, i32)>>,
}

impl WidgetManager {
    pub fn new() -> Self {
        Self {
            active_widgets: Mutex::new(HashMap::new()),
            widget_offsets: Mutex::new(HashMap::new()),
        }
    }

    /// Handle a foreground-changed event.
    /// - If an app matched, show its widget (create if needed).
    /// - Hide all other widgets.
    pub fn handle_foreground_change(
        &self,
        app_handle: &AppHandle,
        event: &ForegroundChanged,
    ) {
        // Hide all currently visible widgets
        let active = self.active_widgets.lock().unwrap();
        for (_, label) in active.iter() {
            if let Some(win) = app_handle.get_webview_window(label) {
                let _ = win.hide();
            }
        }
        drop(active);

        // If a matched app, show/create its widget
        if let (Some(app_id), Some(app_name), hwnd_value) =
            (event.app_id, &event.app_name, event.hwnd)
        {
            let target_hwnd = HWND(hwnd_value as *mut _);
            let label = format!("widget-{}", app_id);

            let mut active = self.active_widgets.lock().unwrap();

            // Create widget window if it doesn't exist yet
            if !active.contains_key(&app_id) {
                let url = format!("/widget?app_id={}&app_name={}", app_id, app_name);
                let widget_window = WebviewWindow::builder(
                    app_handle,
                    &label,
                    WebviewUrl::App(url.into()),
                )
                .title(&format!("{} - Widget", app_name))
                .inner_size(280.0, 320.0)
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .transparent(true)
                .build();

                match widget_window {
                    Ok(win) => {
                        // Position widget relative to target window
                        self.position_widget(&win, target_hwnd, app_id);
                        active.insert(app_id, label);
                    }
                    Err(e) => {
                        eprintln!("Failed to create widget window: {}", e);
                        return;
                    }
                }
            } else {
                // Show existing widget
                if let Some(win) = app_handle.get_webview_window(&label) {
                    let _ = win.show();
                    self.position_widget(&win, target_hwnd, app_id);
                }
            }
        }
    }

    /// Position a widget window relative to the target window's top-right corner.
    fn position_widget(
        &self,
        widget: &WebviewWindow,
        target_hwnd: HWND,
        app_id: i64,
    ) {
        if let Some((_x, _y, w, _h)) = process_matcher::get_window_rect(target_hwnd) {
            let offset = self.widget_offsets.lock().unwrap()
                .get(&app_id)
                .copied()
                .unwrap_or((-290, 10));  // Default: top-right, 10px margin

            let widget_x = w + offset.0;
            let widget_y = offset.1;
            let _ = widget.set_position(tauri::Position::Physical(
                tauri::PhysicalPosition::new(widget_x, widget_y),
            ));
        }
    }

    /// Save a widget's offset position for a given app.
    pub fn save_offset(&self, app_id: i64, offset: (i32, i32)) {
        self.widget_offsets.lock().unwrap().insert(app_id, offset);
    }

    /// Destroy a specific widget.
    pub fn destroy_widget(&self, app_handle: &AppHandle, app_id: i64) {
        let mut active = self.active_widgets.lock().unwrap();
        if let Some(label) = active.remove(&app_id) {
            if let Some(win) = app_handle.get_webview_window(&label) {
                let _ = win.close();
            }
        }
    }
}
```

- [ ] **Step 2: Wire window monitor and widget manager into Tauri state**

Modify `src-tauri/src/lib.rs` — update the `setup` closure:

```rust
use std::sync::Arc;
use services::db::Database;
use services::window_monitor::WindowMonitor;
use services::widget_manager::WidgetManager;

.setup(|app| {
    let db_path = Database::app_db_path(&app.handle())?;
    let database = Database::open(&db_path)?;
    let db_arc = Arc::new(database);
    app.manage(db_arc.clone());

    let widget_mgr = WidgetManager::new();
    app.manage(widget_mgr);

    // Start window monitor
    let monitor = WindowMonitor::new(app.handle().clone(), db_arc);
    app.manage(monitor);

    // Listen for foreground changes and manage widgets
    let app_handle = app.handle().clone();
    app.listen("foreground-changed", move |event| {
        if let Ok(fg_event) = serde_json::from_str::<ForegroundChanged>(event.payload()) {
            let widget_mgr = app_handle.state::<WidgetManager>();
            widget_mgr.handle_foreground_change(&app_handle, &fg_event);
        }
    });

    Ok(())
})
```

- [ ] **Step 3: Add start/stop commands**

Add to `src-tauri/src/commands/app_cmd.rs`:
```rust
use crate::services::window_monitor::WindowMonitor;

#[tauri::command]
pub fn start_window_monitor(monitor: State<WindowMonitor>) -> Result<(), String> {
    monitor.start();
    Ok(())
}

#[tauri::command]
pub fn stop_window_monitor(monitor: State<WindowMonitor>) -> Result<(), String> {
    monitor.stop();
    Ok(())
}
```

Register them in `lib.rs`:
```rust
commands::app_cmd::start_window_monitor,
commands::app_cmd::stop_window_monitor,
```

- [ ] **Step 4: Verify compilation**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo check
```

Expected: Compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/widget_manager.rs src-tauri/src/services/window_monitor.rs src-tauri/src/lib.rs src-tauri/src/commands/app_cmd.rs
git commit -m "feat: add widget manager with lifecycle and positioning"
```

---

### Task 18: Widget Frontend Component

**Files:**
- Create: `src/components/widget/Widget.tsx`
- Create: `src/components/widget/WidgetTodoItem.tsx`
- Modify: `src/App.tsx` — add routing for widget URL
- Create: `src/widget-entry.tsx` — separate entry point for widget windows

- [ ] **Step 1: Add React Router for main vs widget views**

Run:
```bash
npm install react-router-dom
```

- [ ] **Step 2: Create widget entry point**

File: `src/widget-entry.tsx`
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { Widget } from "./components/widget/Widget";
import "./index.css";

// Widget windows get app_id and app_name from URL params
const params = new URLSearchParams(window.location.search);
const appId = parseInt(params.get("app_id") || "0", 10);
const appName = params.get("app_name") || "Unknown";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Widget appId={appId} appName={appName} />
  </React.StrictMode>
);
```

- [ ] **Step 3: Write WidgetTodoItem component**

File: `src/components/widget/WidgetTodoItem.tsx`
```tsx
import type { Todo } from "../../types";

interface WidgetTodoItemProps {
  todo: Todo;
  onToggle: (id: number) => void;
}

export function WidgetTodoItem({ todo, onToggle }: WidgetTodoItemProps) {
  const isCompleted = todo.status === "completed";

  return (
    <div className="flex items-center gap-2 py-1 px-2 hover:bg-white/50 rounded">
      <button
        onClick={() => onToggle(todo.id)}
        className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${
          isCompleted
            ? "bg-green-500 border-green-500"
            : "border-gray-400 hover:border-gray-600"
        }`}
      >
        {isCompleted && <span className="text-white text-[10px]">&#10003;</span>}
      </button>
      <span className={`text-xs ${
        isCompleted ? "line-through text-gray-400" : "text-gray-800"
      }`}>
        {todo.title}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Write Widget component**

File: `src/components/widget/Widget.tsx`
```tsx
import { useState, useEffect, useCallback } from "react";
import { WidgetTodoItem } from "./WidgetTodoItem";
import { listTodosByApp, updateTodo, createTodo } from "../../lib/invoke";
import type { TodoWithDetails } from "../../types";

interface WidgetProps {
  appId: number;
  appName: string;
}

export function Widget({ appId, appName }: WidgetProps) {
  const [todos, setTodos] = useState<TodoWithDetails[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [quickAdd, setQuickAdd] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await listTodosByApp(appId);
      setTodos(data);
    } catch (e) {
      console.error("Failed to load widget todos:", e);
    }
  }, [appId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleToggle = async (id: number) => {
    await updateTodo({ id, status: "completed" });
    await refresh();
  };

  const handleQuickAdd = async (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && quickAdd.trim()) {
      await createTodo({ title: quickAdd.trim() });
      setQuickAdd("");
      await refresh();
    }
  };

  const pendingCount = todos.reduce((sum, t) => {
    return sum + 1 + t.sub_tasks.filter(s => s.status === "pending").length;
  }, 0);

  return (
    <div className="bg-gray-100/90 backdrop-blur rounded-lg shadow-lg overflow-hidden"
         style={{ width: 260 }}>
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-white/80 cursor-move"
        data-tauri-drag-region
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-gray-600 text-xs"
          >
            {collapsed ? "▸" : "▾"}
          </button>
          <span className="text-xs font-medium text-gray-700">
            {appName}
          </span>
          <span className="text-[10px] text-gray-400">({pendingCount})</span>
        </div>
      </div>

      {/* Todo list */}
      {!collapsed && (
        <div className="p-2 space-y-0.5 max-h-60 overflow-y-auto">
          {todos.map((todo) => (
            <div key={todo.id}>
              <WidgetTodoItem todo={todo.todo} onToggle={handleToggle} />
              {todo.sub_tasks.map((sub) => (
                <div key={sub.id} className="ml-4">
                  <WidgetTodoItem todo={sub} onToggle={handleToggle} />
                </div>
              ))}
            </div>
          ))}
          {todos.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">没有关联待办</p>
          )}
        </div>
      )}

      {/* Quick add */}
      {!collapsed && (
        <div className="px-2 pb-2">
          <input
            value={quickAdd}
            onChange={(e) => setQuickAdd(e.target.value)}
            onKeyDown={handleQuickAdd}
            placeholder="快速添加..."
            className="w-full px-2 py-1 text-xs bg-white/60 rounded border border-gray-200 outline-none focus:border-blue-400"
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Update Vite config to support multiple entry points**

File: `vite.config.ts` — add `build.rollupOptions`:
```typescript
build: {
  rollupOptions: {
    input: {
      main: "./index.html",
      widget: "./widget.html",
    },
  },
},
```

Create `widget.html` at project root:
```html
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>Widget</title></head>
<body><div id="root"></div><script type="module" src="/src/widget-entry.tsx"></script></body>
</html>
```

- [ ] **Step 6: Update main App.tsx to start window monitor on load**

Add to `src/App.tsx` inside the component:
```tsx
import { useEffect } from "react";

// Inside App component:
useEffect(() => {
  // Start monitoring when main window loads
  import("./lib/invoke").then(api => {
    api.invoke("start_window_monitor", {});
  });
}, []);
```

Note: Replace with proper typed invoke in `src/lib/invoke.ts`:
```typescript
export const startWindowMonitor = () => invoke<void>("start_window_monitor");
export const stopWindowMonitor = () => invoke<void>("stop_window_monitor");
```

- [ ] **Step 7: Verify end-to-end flow**

Run:
```bash
cd d:/Project/scene-todo && npm run tauri dev
```

Test flow:
1. Create a todo in main window
2. Create an app "Notepad" with process `["NOTEPAD.EXE"]`
3. Bind the todo to Notepad
4. Open Notepad — Widget should appear with the todo
5. Switch away from Notepad — Widget should hide
6. Switch back to Notepad — Widget should reappear

- [ ] **Step 8: Commit**

```bash
git add src/components/widget/ src/widget-entry.tsx src/widget.html src/App.tsx vite.config.ts
git commit -m "feat: add floating widget UI with todo display and quick add"
```
