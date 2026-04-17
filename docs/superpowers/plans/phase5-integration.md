# Phase 5: System Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add system tray, settings page, autostart, and final polish. Verify the full MVP flow works end-to-end.

**Architecture:** System tray via Tauri's built-in tray-icon feature with menu (show/pause/quit). Settings page uses localStorage for MVP persistence. Window close hides to tray instead of quitting. Full E2E verification of the "create todo → bind app → widget appears" flow.

**Tech Stack:** Tauri 2.0 tray-icon plugin, React, TypeScript, localStorage

**Parent:** [2026-04-16-scene-todo.md](2026-04-16-scene-todo.md)

**Depends on:** Phase 4 (widget system complete)

---

### Task 19: System Tray

**Files:**
- Modify: `src-tauri/src/lib.rs` — add tray setup
- Modify: `src-tauri/tauri.conf.json` — enable tray permission

- [ ] **Step 1: Add tray icon setup to lib.rs**

Add to `src-tauri/src/lib.rs` inside `setup` closure, after monitor start:

```rust
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent},
};

// System tray
let show_item = MenuItemBuilder::with_id("show", "显示主窗口").build(app)?;
let pause_item = MenuItemBuilder::with_id("pause", "暂停 Widget").build(app)?;
let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;

let menu = MenuBuilder::new(app)
    .items(&[&show_item, &pause_item, &quit_item])
    .build()?;

let _tray = TrayIconBuilder::new()
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu)
    .tooltip("SceneTodo")
    .on_menu_event(move |app, event| {
        match event.id().as_ref() {
            "show" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "pause" => {
                let monitor = app.state::<WindowMonitor>();
                if monitor.is_running() {
                    monitor.stop();
                    // Update menu text
                    if let Some(tray) = app.tray_by_id("main") {
                        let _ = tray.set_tooltip("SceneTodo (已暂停)");
                    }
                } else {
                    monitor.start();
                    if let Some(tray) = app.tray_by_id("main") {
                        let _ = tray.set_tooltip("SceneTodo");
                    }
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        }
    })
    .on_tray_icon_event(|tray, event| {
        if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
            let app = tray.app_handle();
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }
    })
    .build(app)?;
```

- [ ] **Step 2: Update tauri.conf.json for tray permissions**

File: `src-tauri/tauri.conf.json` — add to `permissions`:
```json
"tray-icon:allow-new",
"tray-icon:allow-set-icon",
"tray-icon:allow-set-menu",
"menu:allow-new",
"menu:allow-append"
```

Also ensure `windows` config hides main window from taskbar on close:
```json
"windows": [
  {
    "label": "main",
    "title": "SceneTodo",
    "width": 900,
    "height": 600,
    "visible": true,
    "decorations": true
  }
]
```

- [ ] **Step 3: Prevent app from closing when main window is closed**

Add window close handler in `setup`:
```rust
// In setup, after tray creation:
if let Some(main_win) = app.get_webview_window("main") {
    let win_clone = main_win.clone();
    main_win.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = win_clone.hide();
        }
    });
}
```

- [ ] **Step 4: Verify tray works**

Run:
```bash
cd d:/Project/scene-todo && npm run tauri dev
```

Expected:
- System tray icon appears
- Clicking tray icon shows/hides main window
- Right-click shows menu with "显示主窗口", "暂停 Widget", "退出"
- Closing main window hides it instead of quitting
- "退出" closes the app

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/tauri.conf.json
git commit -m "feat: add system tray with show/pause/quit menu"
```

---

### Task 20: Settings Page

**Files:**
- Create: `src/components/settings/Settings.tsx`
- Modify: `src/components/sidebar/Sidebar.tsx` — add settings link
- Modify: `src/App.tsx` — add settings view state

- [ ] **Step 1: Write Settings component**

File: `src/components/settings/Settings.tsx`
```tsx
import { useState, useEffect } from "react";
import { useApps } from "../../hooks/useApps";

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const { apps, remove } = useApps();
  const [autoStart, setAutoStart] = useState(false);
  const [widgetOpacity, setWidgetOpacity] = useState(90);
  const [widgetSize, setWidgetSize] = useState<"small" | "medium" | "large">("medium");

  useEffect(() => {
    // Load settings from localStorage (MVP approach)
    const saved = localStorage.getItem("scene-todo-settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      setAutoStart(parsed.autoStart ?? false);
      setWidgetOpacity(parsed.widgetOpacity ?? 90);
      setWidgetSize(parsed.widgetSize ?? "medium");
    }
  }, []);

  const saveSettings = (updates: Record<string, unknown>) => {
    const current = JSON.parse(localStorage.getItem("scene-todo-settings") || "{}");
    const updated = { ...current, ...updates };
    localStorage.setItem("scene-todo-settings", JSON.stringify(updated));
  };

  const handleAutoStart = async (enabled: boolean) => {
    setAutoStart(enabled);
    saveSettings({ autoStart: enabled });
    // Note: actual autostart toggle requires Tauri plugin command
    // invoke("plugin:autostart|enable") / invoke("plugin:autostart|disable")
  };

  return (
    <div className="p-6 max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">设置</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          &times;
        </button>
      </div>

      {/* General */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-gray-600 mb-3">通用</h3>
        <label className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-700">开机自启</span>
          <input
            type="checkbox"
            checked={autoStart}
            onChange={(e) => handleAutoStart(e.target.checked)}
            className="rounded"
          />
        </label>
      </section>

      {/* Widget */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-gray-600 mb-3">Widget</h3>
        <label className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-700">默认透明度</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={50}
              max={100}
              value={widgetOpacity}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                setWidgetOpacity(v);
                saveSettings({ widgetOpacity: v });
              }}
              className="w-24"
            />
            <span className="text-xs text-gray-500 w-8">{widgetOpacity}%</span>
          </div>
        </label>
        <label className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-700">默认尺寸</span>
          <select
            value={widgetSize}
            onChange={(e) => {
              const v = e.target.value as "small" | "medium" | "large";
              setWidgetSize(v);
              saveSettings({ widgetSize: v });
            }}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="small">小</option>
            <option value="medium">中</option>
            <option value="large">大</option>
          </select>
        </label>
      </section>

      {/* App Management */}
      <section>
        <h3 className="text-sm font-medium text-gray-600 mb-3">已关联软件</h3>
        <div className="space-y-1">
          {apps.map((app) => (
            <div key={app.id} className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-50 rounded">
              <div>
                <span className="text-sm text-gray-700">{app.display_name || app.name}</span>
                <span className="text-xs text-gray-400 ml-2">
                  {JSON.parse(app.process_names).join(", ")}
                </span>
              </div>
              <button
                onClick={() => remove(app.id)}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                删除
              </button>
            </div>
          ))}
          {apps.length === 0 && (
            <p className="text-xs text-gray-400 py-2">暂无关联软件</p>
          )}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add settings view to App.tsx**

Add to `src/App.tsx`:
```tsx
const [showSettings, setShowSettings] = useState(false);

// In render, replace the content area:
<main className="flex-1 overflow-auto">
  {showSettings ? (
    <Settings onClose={() => setShowSettings(false)} />
  ) : (
    <TodoList filters={filters} selectedTagIds={selectedTagIds} />
  )}
</main>
```

- [ ] **Step 3: Add settings button to Sidebar**

Add to `src/components/sidebar/Sidebar.tsx`, at the bottom of the aside:
```tsx
<div className="p-2 border-t border-gray-200">
  <button
    onClick={onOpenSettings}
    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 rounded hover:bg-gray-100"
  >
    <span>⚙</span>
    <span>设置</span>
  </button>
</div>
```

Add `onOpenSettings: () => void` to SidebarProps and pass from App.tsx.

- [ ] **Step 4: Verify settings page**

Run:
```bash
cd d:/Project/scene-todo && npm run tauri dev
```

Expected: Click settings in sidebar — settings page appears with auto-start toggle, opacity slider, size selector, and app management list.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/ src/components/sidebar/Sidebar.tsx src/App.tsx
git commit -m "feat: add settings page with autostart, widget config, and app management"
```

---

### Task 21: End-to-End Integration Test

**Files:** No new files — manual verification

- [ ] **Step 1: Full MVP flow verification**

Run the app:
```bash
cd d:/Project/scene-todo && npm run tauri dev
```

Execute this exact test sequence:

1. **Create groups**: Click "+" in sidebar "分组" section, type "工作", Enter. Create "个人" group.
2. **Create tags**: Click "+" in "标签", type "紧急", Enter. Create "文档" tag.
3. **Create todos**: Type "修改第三章的数据图表" in quick-add, Enter. Create "补充参考文献" and "更新封面信息".
4. **Set priority**: Verify todos appear with default "medium" priority.
5. **Create app**: Hover a todo, click 📎. Click "+ 添加新软件". Name: "记事本", Process: "NOTEPAD.EXE". Click "添加".
6. **Bind todo**: Check the checkbox next to "记事本" in the binding dialog.
7. **Open Notepad**: Open Windows Notepad (`notepad.exe`).
8. **Verify Widget appears**: Within 300ms, a floating widget should appear near the Notepad window showing the bound todo.
9. **Toggle todo in widget**: Click the checkbox in the widget — todo should show as completed (strikethrough).
10. **Switch away**: Click on another window (e.g., desktop) — widget should hide.
11. **Switch back**: Click on Notepad — widget should reappear in the same position.
12. **System tray**: Close main window — app stays in tray. Right-click tray — menu appears. Click "退出" — app closes.

- [ ] **Step 2: Performance check**

While running, check:
- Open Task Manager → find `scene-todo.exe`
- Verify memory usage < 50MB
- Verify switching between windows causes no lag or stutter

- [ ] **Step 3: Commit final state**

```bash
git add -A
git commit -m "chore: MVP complete — full end-to-end flow verified"
```

---

## Summary

| Phase | Tasks | Key Deliverables |
|-------|-------|-----------------|
| 1 | Task 1-4 | Tauri scaffold, SQLite schema, Rust models, DB in app state |
| 2 | Task 5-9 | Todo/Group/Tag/App repos + Tauri commands (16 tests) |
| 3 | Task 10-14 | TS types, invoke wrapper, sidebar, todo list, binding editor |
| 4 | Task 15-18 | Process matcher, window monitor, widget manager, widget UI |
| 5 | Task 19-21 | System tray, settings page, E2E verification |

**Total:** 21 tasks, ~100 steps, 16 Rust unit tests
