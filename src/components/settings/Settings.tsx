import { useState, useEffect } from "react";
import { useApps } from "../../hooks/useApps";
import * as api from "../../lib/invoke";
import { notify } from "../../lib/toast";
import { ThemeSettings } from "./ThemeSettings";
import { GeneralSettings } from "./GeneralSettings";
import { WidgetSettings } from "./WidgetSettings";
import { AppManagement } from "./AppManagement";
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";
import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile, readFile } from "@tauri-apps/plugin-fs";
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

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
      if (enabled) await enableAutostart();
      else await disableAutostart();
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

      <GeneralSettings
        autoStart={autoStart}
        onAutoStart={handleAutoStart}
        closeAction={closeAction}
        onCloseActionChange={(v) => { setCloseAction(v); saveSettings({ closeAction: v }); }}
        retentionDays={retentionDays}
        onRetentionDaysChange={(v) => { setRetentionDays(v); saveSettings({ retentionDays: v }); }}
        onExport={handleExport}
        onImport={handleImport}
      />

      <WidgetSettings
        widgetOpacity={widgetOpacity}
        onOpacityChange={(v) => { setWidgetOpacity(v); saveSettings({ widgetOpacity: v }); }}
        widgetSize={widgetSize}
        onSizeChange={(v) => { setWidgetSize(v); saveSettings({ widgetSize: v }); }}
        showEmptyWidget={showEmptyWidget}
        onShowEmptyWidgetChange={(v) => { setShowEmptyWidget(v); saveSettings({ showEmptyWidget: v }); }}
      />

      <AppManagement
        apps={apps}
        expandedApp={expandedApp}
        onExpandApp={setExpandedApp}
        offsets={offsets}
        onOffsetChange={handleOffsetChange}
        capturing={capturing}
        onCapture={handleCapture}
        refreshingIcons={refreshingIcons}
        onRefreshIcons={handleRefreshIcons}
        onRemoveApp={remove}
        onToggleShowWidget={handleToggleShowWidget}
        onImportIcon={handleImportIcon}
      />

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
