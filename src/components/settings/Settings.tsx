import { useState, useEffect } from "react";
import { useApps } from "../../hooks/useApps";
import * as api from "../../lib/invoke";
import { notify } from "../../lib/toast";
import { ThemeSettings } from "./ThemeSettings";
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile, readFile } from "@tauri-apps/plugin-fs";
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

export function Settings() {
  const { apps, create, remove, refresh } = useApps();
  const [autoStart, setAutoStart] = useState(false);
  const [widgetOpacity, setWidgetOpacity] = useState(85);
  const [widgetSize, setWidgetSize] = useState<"small" | "medium" | "large">("medium");
  const [showEmptyWidget, setShowEmptyWidget] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);
  const [expandedApp, setExpandedApp] = useState<number | null>(null);
  const [offsets, setOffsets] = useState<Record<number, { x: number; y: number }>>({});
  const [capturing, setCapturing] = useState(false);
  const [refreshingIcons, setRefreshingIcons] = useState(false);
  const [closeAction, setCloseAction] = useState<"prompt" | "hide" | "exit">("prompt");

  useEffect(() => {
    const saved = localStorage.getItem("scene-todo-settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      setWidgetOpacity(parsed.widgetOpacity ?? 85);
      setWidgetSize(parsed.widgetSize ?? "medium");
      setShowEmptyWidget(parsed.showEmptyWidget ?? false);
      setRetentionDays(parsed.retentionDays ?? 90);
      setCloseAction(parsed.closeAction ?? "prompt");
    }
    isAutostartEnabled().then((enabled) => setAutoStart(enabled)).catch(() => {});
    const savedOffsets = localStorage.getItem("scene-todo-widget-offsets");
    if (savedOffsets) {
      setOffsets(JSON.parse(savedOffsets));
    }
  }, []);

  useEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem("scene-todo-settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.closeAction) setCloseAction(parsed.closeAction);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const saveSettings = (updates: Record<string, unknown>) => {
    const current = JSON.parse(localStorage.getItem("scene-todo-settings") || "{}");
    const updated = { ...current, ...updates };
    localStorage.setItem("scene-todo-settings", JSON.stringify(updated));
    const size = updated.widgetSize ?? "medium";
    const sizeMap: Record<string, [number, number]> = {
      small: [200, 240],
      medium: [260, 300],
      large: [340, 400],
    };
    const [w, h] = sizeMap[size] || sizeMap.medium;
    api.setWidgetDefaultSize(w, h);
  };

  const handleAutoStart = async (enabled: boolean) => {
    try {
      if (enabled) {
        await enableAutostart();
      } else {
        await disableAutostart();
      }
      setAutoStart(enabled);
    } catch (e) {
      console.error("Failed to toggle autostart:", e);
    }
  };

  const handleOffsetChange = (appId: number, axis: "x" | "y", value: number) => {
    const current = offsets[appId] ?? { x: 8, y: 32 };
    const updated = { ...current, [axis]: value };
    const newOffsets = { ...offsets, [appId]: updated };
    setOffsets(newOffsets);
    localStorage.setItem("scene-todo-widget-offsets", JSON.stringify(newOffsets));
    api.saveWidgetOffset(appId, updated.x, updated.y);
  };

  const handleCapture = async () => {
    setCapturing(true);
    try {
      const result = await api.startWindowCapture();
      const { process_name } = result;
      if (!process_name) return;
      const existing = apps.find((a) => {
        try {
          return JSON.parse(a.process_names).some((p: string) => p.toLowerCase() === process_name.toLowerCase());
        } catch { return false; }
      });
      if (!existing) {
        const displayName = process_name.replace(/\.[^.]+$/, "");
        await create({ name: displayName, process_names: [process_name] });
      }
    } catch (e) {
      console.error("Window capture failed:", e);
    } finally {
      setCapturing(false);
    }
  };

  const handleToggleShowWidget = async (appId: number, show: boolean) => {
    await api.updateApp({ id: appId, show_widget: show });
    refresh();
  };

  const handleRefreshIcons = async () => {
    setRefreshingIcons(true);
    try {
      await api.refreshAllIcons();
      refresh();
    } catch (e) {
      console.error("Refresh icons failed:", e);
    } finally {
      setRefreshingIcons(false);
    }
  };

  const handleImportIcon = async (appId: number) => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: "图标文件",
          extensions: ["exe", "png", "jpg", "jpeg", "ico", "bmp", "svg", "webp"],
        }],
      });
      if (!selected) return;
      await api.importAppIcon(appId, selected as string);
      refresh();
    } catch (e) {
      console.error("Import icon failed:", e);
    }
  };

  const handleExport = async () => {
    try {
      const dbJson = await api.exportData();
      const exportObj = {
        version: 1,
        database: JSON.parse(dbJson),
        localStorage: {
          "scene-todo-settings": localStorage.getItem("scene-todo-settings"),
          "scene-todo-widget-offsets": localStorage.getItem("scene-todo-widget-offsets"),
          "scene-todo-theme": localStorage.getItem("scene-todo-theme"),
        },
      };
      const content = JSON.stringify(exportObj, null, 2);
      const path = await save({
        defaultPath: "scenetodo-backup.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      const encoder = new TextEncoder();
      await writeFile(path, encoder.encode(content));
    } catch (e) {
      console.error("Export failed:", e);
      notify.error("导出数据失败");
    }
  };

  const [importPreview, setImportPreview] = useState<{
    dbData: Record<string, unknown>;
    localStorage: Record<string, unknown> | null;
    summary: string[];
  } | null>(null);

  const handleImport = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!selected) return;
      const bytes = await readFile(selected as string);
      const decoder = new TextDecoder();
      const text = decoder.decode(bytes);
      const importObj = JSON.parse(text);
      const dbData = importObj.database || importObj;
      const lsData = importObj.localStorage || null;

      const summary: string[] = [];
      const tableLabels: Record<string, string> = {
        groups: "分组", tags: "标签", apps: "应用", scenes: "场景",
        todos: "待办事项", todo_tags: "标签关联", scene_apps: "场景应用关联",
        todo_app_bindings: "应用绑定", todo_scene_bindings: "场景绑定",
        time_sessions: "时间记录",
      };
      for (const [key, label] of Object.entries(tableLabels)) {
        const rows = (dbData as Record<string, unknown>)[key];
        if (Array.isArray(rows) && rows.length > 0) {
          summary.push(`${label}: ${rows.length} 条`);
        }
      }
      setImportPreview({ dbData, localStorage: lsData, summary });
    } catch (e) {
      console.error("Import failed:", e);
      notify.error("读取备份文件失败");
    }
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    try {
      const dbJson = JSON.stringify(importPreview.dbData);
      await api.importData(dbJson);
      if (importPreview.localStorage) {
        for (const [key, value] of Object.entries(importPreview.localStorage)) {
          if (value) localStorage.setItem(key, value as string);
        }
      }
      setImportPreview(null);
      window.location.reload();
    } catch (e) {
      console.error("Import failed:", e);
      notify.error("导入数据失败");
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-foreground mb-6">设置</h2>

      <ThemeSettings />

      {/* General */}
      <section className="mb-6">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-theme" />
          通用
        </h3>
        <Label className="flex items-center justify-between py-2">
          <span className="text-sm text-foreground">开机自启</span>
          <Checkbox checked={autoStart} onCheckedChange={(v) => handleAutoStart(!!v)} />
        </Label>
        <Label className="flex items-center justify-between py-2">
          <span className="text-sm text-foreground">关闭按钮行为</span>
          <Select value={closeAction} onValueChange={(v) => { const val = v as "prompt" | "hide" | "exit"; setCloseAction(val); saveSettings({ closeAction: val }); }}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prompt">每次询问</SelectItem>
              <SelectItem value="hide">隐藏到托盘</SelectItem>
              <SelectItem value="exit">退出程序</SelectItem>
            </SelectContent>
          </Select>
        </Label>
        <Label className="flex items-center justify-between py-2">
          <span className="text-sm text-foreground">数据保留天数</span>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={3650}
              value={retentionDays}
              onChange={(e) => {
                const v = Math.max(1, parseInt(e.target.value) || 90);
                setRetentionDays(v);
                saveSettings({ retentionDays: v });
              }}
              className="w-20 text-right"
            />
            <span className="text-xs text-muted-foreground">天</span>
          </div>
        </Label>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-foreground">数据备份</span>
          <div className="flex items-center gap-2">
            <button onClick={handleExport} className="text-xs text-muted-foreground hover:text-theme">导出</button>
            <span className="text-muted-foreground/30">|</span>
            <button onClick={handleImport} className="text-xs text-muted-foreground hover:text-theme">导入</button>
          </div>
        </div>
      </section>

      {/* Widget */}
      <section className="mb-6">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-theme" />
          Widget
        </h3>
        <Label className="flex items-center justify-between py-2">
          <span className="text-sm text-foreground">无待办时显示浮窗</span>
          <Checkbox
            checked={showEmptyWidget}
            onCheckedChange={(v) => { setShowEmptyWidget(!!v); saveSettings({ showEmptyWidget: !!v }); }}
          />
        </Label>
        <label className="flex items-center justify-between py-2">
          <span className="text-sm text-foreground">浮窗不透明度</span>
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={100} value={widgetOpacity}
              onChange={(e) => { const v = parseInt(e.target.value); setWidgetOpacity(v); saveSettings({ widgetOpacity: v }); }}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground w-8">{widgetOpacity}%</span>
          </div>
        </label>
        <Label className="flex items-center justify-between py-2">
          <span className="text-sm text-foreground">默认尺寸</span>
          <Select value={widgetSize} onValueChange={(v) => { const val = v as "small" | "medium" | "large"; setWidgetSize(val); saveSettings({ widgetSize: val }); }}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">小</SelectItem>
              <SelectItem value="medium">中</SelectItem>
              <SelectItem value="large">大</SelectItem>
            </SelectContent>
          </Select>
        </Label>
      </section>

      {/* App Management with per-app offset */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-theme" />
            已关联软件
          </h3>
          {apps.length > 0 && (
            <button
              onClick={handleRefreshIcons}
              disabled={refreshingIcons}
              className="text-xs text-muted-foreground hover:text-theme disabled:opacity-50"
            >
              {refreshingIcons ? "刷新中..." : "自动获取图标"}
            </button>
          )}
        </div>
        <div className="space-y-1">
          {apps.map((app) => {
            const isExpanded = expandedApp === app.id;
            const off = offsets[app.id] ?? { x: 8, y: 32 };
            return (
              <div key={app.id}>
                <div className="flex items-center justify-between py-1.5 px-2 hover:bg-accent rounded">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedApp(isExpanded ? null : app.id)}
                      className="text-muted-foreground/60 hover:text-muted-foreground text-xs w-4"
                    >
                      {isExpanded ? "\u25BE" : "\u25B8"}
                    </button>
                    <div className="flex items-center gap-2">
                      {app.icon_path ? (
                        <img src={app.icon_path} alt="" className="w-5 h-5 rounded" />
                      ) : (
                        <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                          {app.display_name?.[0] || app.name[0]}
                        </div>
                      )}
                      <span className="text-sm text-foreground">{app.display_name || app.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {(() => { try { return JSON.parse(app.process_names).join(", "); } catch { return app.process_names; } })()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="flex items-center gap-1 cursor-pointer" title={app.show_widget ? "显示浮窗" : "隐藏浮窗"}>
                      <Checkbox
                        checked={app.show_widget}
                        onCheckedChange={(v) => handleToggleShowWidget(app.id, !!v)}
                      />
                      <span className="text-[10px] text-muted-foreground">浮窗</span>
                    </Label>
                    <button onClick={() => remove(app.id)} className="text-xs text-muted-foreground hover:text-red-500">删除</button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="ml-6 px-2 py-2 bg-background rounded text-xs space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-14">X 偏移</span>
                      <input type="range" min={-200} max={500} value={off.x}
                        onChange={(e) => handleOffsetChange(app.id, "x", parseInt(e.target.value))}
                        className="flex-1"
                      />
                      <span className="w-8 text-muted-foreground">{off.x}px</span>
                      <Input type="number" min={-200} max={500} value={off.x}
                        onChange={(e) => { const v = parseInt(e.target.value) || 0; handleOffsetChange(app.id, "x", v); }}
                        className="w-14 text-center text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-14">Y 偏移</span>
                      <input type="range" min={0} max={500} value={off.y}
                        onChange={(e) => handleOffsetChange(app.id, "y", parseInt(e.target.value))}
                        className="flex-1"
                      />
                      <span className="w-8 text-muted-foreground">{off.y}px</span>
                      <Input type="number" min={0} max={500} value={off.y}
                        onChange={(e) => { const v = parseInt(e.target.value) || 0; handleOffsetChange(app.id, "y", v); }}
                        className="w-14 text-center text-xs"
                      />
                    </div>
                    <button
                      onClick={() => handleImportIcon(app.id)}
                      className="text-xs text-muted-foreground hover:text-theme"
                    >
                      手动导入图标...
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <button
            onClick={handleCapture}
            disabled={capturing}
            className="w-full py-2 mt-1 text-xs rounded border border-surface-border hover:border-theme hover:text-theme cursor-pointer transition-colors disabled:opacity-50"
          >
            {capturing ? "点击目标窗口以抓取..." : "+ 抓取窗口添加关联软件"}
          </button>
          {apps.length === 0 && <p className="text-xs text-muted-foreground py-2">暂无关联软件</p>}
        </div>
      </section>

      {/* Import confirmation */}
      <ConfirmDialog
        open={!!importPreview}
        title="导入数据"
        description="当前数据将被替换为导入内容，此操作不可撤销。建议先导出备份。"
        variant="danger"
        confirmText="确认导入"
        onConfirm={confirmImport}
        onCancel={() => setImportPreview(null)}
      />
    </div>
  );
}
