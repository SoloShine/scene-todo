# SceneTodo P0/P1 修复执行指南

这是给 Claude Code 的详细执行指南。请按顺序修改以下文件。

## 重要说明
- 这是 Tauri 2.0 项目，CSP 语法遵循标准 Content-Security-Policy
- Rust 代码中有 `std::sync::Mutex` 和 `rusqlite` 的连接 Mutex 两类
- 项目使用 `unwrap()` 共50处，需要区分对待
- `lib.rs` L175 有一个 `win.eval()` 调用（Tauri 安全的窗口通信方式），CSP 不需要特别处理

---

## 修改 1: CSP 策略 — `src-tauri/tauri.conf.json`

将:
```json
"security": {
  "csp": null
}
```

改为:
```json
"security": {
  "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src ipc: http://ipc.localhost"
}
```

说明:
- `unsafe-inline` 仅用于 style（Tailwind/shadcn 组件需要内联样式）
- 不需要 `asset:` 协议（项目未使用）
- `ipc:` 是 Tauri 2.0 的 IPC 协议
- 无外部资源加载需求（唯一的外部链接是 About.tsx 的 GitHub URL，只是 href 不是资源加载）

---

## 修改 2: data_port.rs 列名转义 — `src-tauri/src/services/data_port.rs`

在 `insert_rows_tx` (L119) 和 `insert_rows` (L158) 函数中：

将:
```rust
let col_list = cols.iter().map(|c| c.as_str()).collect::<Vec<_>>().join(", ");
```

改为:
```rust
let col_list = cols.iter()
    .map(|c| format!("\"{}\"", c.replace('"', "\"\"")))
    .collect::<Vec<_>>()
    .join(", ");
```

注意两个函数都要改（L125 和 L165）。

---

## 修改 3: Mutex unwrap 安全处理 — 多文件

### 规则：
- **db.conn.lock().unwrap()** 在 `lib.rs` 的业务代码中 → 改为 `.lock().map_err(|e| format!("DB lock poisoned: {}", e))?`
- **std::sync::Mutex 的 .lock().unwrap()** 在业务代码中（window_monitor、time_tracker、widget_manager） → 改为 `.lock().unwrap_or_else(|e| { log::warn!("Mutex poisoned, recovering: {}", e); e.into_inner() })`
- **测试代码**中的 unwrap → **不改**
- **db.rs** `run_migrations` 中的 `.lock().map_err(|e| e.to_string())?` → 已经安全，不改

### 文件: `src-tauri/src/lib.rs`

L28: `self.active.lock().unwrap()` (PassthroughState::set) → 
```rust
let mut active = self.active.lock().unwrap_or_else(|e| e.into_inner());
```

L32: `self.active.lock().unwrap()` (PassthroughState::is_any_active) →
```rust
!self.active.lock().unwrap_or_else(|e| e.into_inner()).is_empty()
```

L35: `self.active.lock().unwrap()` (PassthroughState::clear) →
```rust
std::mem::take(&mut *self.active.lock().unwrap_or_else(|e| e.into_inner()))
```

L56: `db_arc.conn.lock().unwrap()` →
```rust
let conn = db_arc.conn.lock().map_err(|e| format!("DB lock: {}", e))?;
```
注意：这在一个返回 `Result` 的 setup 闭包中，所以可以用 `?`。

L65: `db_arc.conn.lock().unwrap()` →
```rust
let conn = db_arc.conn.lock().map_err(|e| format!("DB lock: {}", e))?;
```

### 文件: `src-tauri/src/services/window_monitor.rs`

所有 `self.running.lock().unwrap()` 和其他 `.lock().unwrap()` → `.lock().unwrap_or_else(|e| e.into_inner())`

大约24处，全部替换。

### 文件: `src-tauri/src/services/time_tracker.rs`

所有 `.lock().unwrap()` → `.lock().unwrap_or_else(|e| e.into_inner())`

大约8处。

### 文件: `src-tauri/src/services/widget_manager.rs`

所有 `.lock().unwrap()` → `.lock().unwrap_or_else(|e| e.into_inner())`

大约9处。

### 文件: `src-tauri/src/services/scene_repo.rs`

业务代码中的 `.lock().unwrap()` → `.lock().map_err(|e| format!("DB lock: {}", e))?`

---

## 修改 4: lib.rs setup 拆分 — `src-tauri/src/lib.rs`

将 L48-L202 的 setup 闭包内容拆分为3个函数：

```rust
fn setup_database(app: &tauri::App) -> Result<Arc<Database>, Box<dyn std::error::Error>> {
    let db_path = Database::app_db_path(&app.handle())?;
    let database = Database::open(&db_path)?;
    let db_arc = Arc::new(database);
    app.manage(db_arc.clone());

    // One-time migration: convert old UTC timestamps to local time
    {
        let conn = db_arc.conn.lock().map_err(|e| format!("DB lock: {}", e))?;
        let done: bool = conn.query_row(
            "SELECT COUNT(*) > 0 FROM _migrations WHERE name = 'utc_to_local'",
            [],
            |row| row.get(0),
        ).unwrap_or(false);
        drop(conn);
        if !done {
            let _ = scene_repo::migrate_utc_to_local(&db_arc);
            let conn = db_arc.conn.lock().map_err(|e| format!("DB lock: {}", e))?;
            let _ = conn.execute(
                "INSERT INTO _migrations (name) VALUES ('utc_to_local')",
                [],
            );
        }
    }

    Ok(db_arc)
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // 整个 tray 相关代码（L103-L189）
    // ...保持原有逻辑不变
    Ok(())
}

fn setup_window_handlers(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // L192-L200 的 main window close handler
    if let Some(main_win) = app.get_webview_window("main") {
        let app_handle = app.handle().clone();
        main_win.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = app_handle.emit("close-requested", ());
            }
        });
    }
    Ok(())
}
```

然后在 setup 闭包中调用：
```rust
.setup(|app| {
    let db_arc = setup_database(app)?;
    
    let time_tracker = Arc::new(TimeTracker::new(db_arc.clone()));
    app.manage(time_tracker.clone());

    let widget_mgr = WidgetManager::new(db_arc.clone());
    app.manage(widget_mgr);

    let passthrough_state = PassthroughState::new();
    app.manage(passthrough_state);

    let monitor = WindowMonitor::new(app.handle().clone(), db_arc, time_tracker);
    app.manage(monitor);

    setup_event_listeners(app);
    setup_tray(app)?;
    setup_window_handlers(app)?;

    Ok(())
})
```

注意：setup 闭包签名是 `FnOnce(&App) -> Result<(), Box<dyn std::error::Error>>`，子函数用同样的返回类型。

---

## 修改 5: App.tsx — useCallback + catch日志

### 5a: 给 handleSmartView 加 useCallback

在文件顶部添加:
```typescript
import { useState, useEffect, useRef, useCallback } from "react";
```
（已经有 useCallback，确认即可）

将:
```typescript
const handleSmartView = (view: string) => {
```

改为:
```typescript
const handleSmartView = useCallback((view: string) => {
    setShowSettings(false);
    setShowStats(false);
    setShowAbout(false);
    setSelectedGroupId(null);
    setSelectedTagIds([]);
    setSelectedSceneId(null);
    switch (view) {
      case "all":
        setFilters({});
        break;
      case "today":
        const now = new Date();
        setFilters({ due_before: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}` });
        break;
    }
}, []);
```

### 5b: catch {} 加日志

L74: `} catch {}` → `} catch (e) { console.warn("Failed to load settings:", e); }`

---

## 修改 6: widget-entry.tsx URL参数验证

替换 L14-29:
```typescript
const params = new URLSearchParams(window.location.search);
const rawAppId = params.get("app_id") || "0";
const appId = parseInt(rawAppId, 10);
if (isNaN(appId) || appId < 0) {
  console.error("Invalid app_id:", rawAppId);
}
const appName = params.get("app_name") || "Unknown";

const scenesRaw = params.get("scenes");
let scenes: SceneInfo[] = [];
try {
  if (scenesRaw) {
    const parsed = JSON.parse(scenesRaw);
    if (Array.isArray(parsed)) {
      scenes = parsed;
    }
  }
} catch {
  console.warn("Invalid scenes parameter, falling back to scene_names");
  const sceneNames = (params.get("scene_names") || "").split(",").filter(Boolean);
  scenes = sceneNames.map((name: string, i: number) => ({
    id: -(i + 1),
    name,
    icon: null,
    color: "#6B7280",
  }));
}
```

---

## 修改 7: ErrorBoundary — 新建 `src/components/ErrorBoundary.tsx`

```tsx
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{ padding: 20, color: "#ef4444", fontFamily: "system-ui" }}>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: 10, padding: "6px 16px", cursor: "pointer" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### 修改 `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./hooks/useTheme";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
```

### 修改 `src/widget-entry.tsx`:

添加 ErrorBoundary 包裹:
```tsx
import { ErrorBoundary } from "./components/ErrorBoundary";
```

在 render 中包裹:
```tsx
ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider>
      <Widget appId={appId} appName={appName} scenes={scenes} />
      <Toaster position="bottom-center" richColors closeButton />
    </ThemeProvider>
  </ErrorBoundary>
);
```

---

## 修改 8: 输入验证 — repo 文件

在以下4个文件中添加验证函数:

### `src-tauri/src/services/todo_repo.rs`
在文件顶部（use 语句后）添加:
```rust
fn validate_title(title: &str) -> Result<(), String> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err("标题不能为空".into());
    }
    if trimmed.len() > 500 {
        return Err("标题过长（最多500字符）".into());
    }
    Ok(())
}
```
在 `create_todo` 函数开头添加: `validate_title(&input.title)?;`
在 `update_todo` 函数中，如果有 title 更新则验证。

### `src-tauri/src/services/group_repo.rs`
添加类似的 `validate_name` 并在 create/update 中调用。

### `src-tauri/src/services/tag_repo.rs`
同上。

### `src-tauri/src/services/app_repo.rs`
同上。

---

## 修改 9: Settings.tsx catch日志

将所有 `.catch(() => {})` 改为 `.catch((e) => { console.warn("Operation failed:", e); })`

涉及行: L37 (isAutostartEnabled)

L74 App.tsx 的 `catch {}` 已经在修改5中处理。

---

## 执行顺序

1. 先改 CSP（P0-2）和 SQL注入（P0-1）— 最关键的安全修复
2. 改 Mutex unwrap（P1-1）— 防止运行时 panic
3. 拆分 setup 函数（P1-2）
4. 前端修复：ErrorBoundary、useCallback、catch日志、URL验证
5. 输入验证

每改完一批后运行 `cargo check` 和 `npm run build` 验证编译通过。
