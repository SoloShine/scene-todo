import { useState, useEffect } from "react";
import { useApps } from "../../hooks/useApps";
import * as api from "../../lib/invoke";

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const { apps, create, remove, refresh } = useApps();
  const [autoStart, setAutoStart] = useState(false);
  const [widgetOpacity, setWidgetOpacity] = useState(85);
  const [widgetSize, setWidgetSize] = useState<"small" | "medium" | "large">("medium");
  const [showEmptyWidget, setShowEmptyWidget] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);
  const [expandedApp, setExpandedApp] = useState<number | null>(null);
  const [offsets, setOffsets] = useState<Record<number, { x: number; y: number }>>({});
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("scene-todo-settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      setAutoStart(parsed.autoStart ?? false);
      setWidgetOpacity(parsed.widgetOpacity ?? 85);
      setWidgetSize(parsed.widgetSize ?? "medium");
      setShowEmptyWidget(parsed.showEmptyWidget ?? false);
      setRetentionDays(parsed.retentionDays ?? 90);
    }
    const savedOffsets = localStorage.getItem("scene-todo-widget-offsets");
    if (savedOffsets) {
      setOffsets(JSON.parse(savedOffsets));
    }
  }, []);

  const saveSettings = (updates: Record<string, unknown>) => {
    const current = JSON.parse(localStorage.getItem("scene-todo-settings") || "{}");
    const updated = { ...current, ...updates };
    localStorage.setItem("scene-todo-settings", JSON.stringify(updated));
    // Sync size to backend
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
    setAutoStart(enabled);
    saveSettings({ autoStart: enabled });
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

  return (
    <div className="p-6 max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">设置</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          &times;
        </button>
      </div>

      {/* General */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-gray-600 mb-3">通用</h3>
        <label className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-700">开机自启</span>
          <input type="checkbox" checked={autoStart} onChange={(e) => handleAutoStart(e.target.checked)} className="rounded" />
        </label>
        <label className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-700">数据保留天数</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={3650}
              value={retentionDays}
              onChange={(e) => {
                const v = Math.max(1, parseInt(e.target.value) || 90);
                setRetentionDays(v);
                saveSettings({ retentionDays: v });
              }}
              className="w-20 px-2 py-1 text-sm border rounded text-right"
            />
            <span className="text-xs text-gray-400">天</span>
          </div>
        </label>
      </section>

      {/* Widget */}
      <section className="mb-6">
        <h3 className="text-sm font-medium text-gray-600 mb-3">Widget</h3>
        <label className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-700">无待办时显示浮窗</span>
          <input
            type="checkbox"
            checked={showEmptyWidget}
            onChange={(e) => { setShowEmptyWidget(e.target.checked); saveSettings({ showEmptyWidget: e.target.checked }); }}
            className="rounded"
          />
        </label>
        <label className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-700">浮窗不透明度</span>
          <div className="flex items-center gap-2">
            <input type="range" min={30} max={100} value={widgetOpacity}
              onChange={(e) => { const v = parseInt(e.target.value); setWidgetOpacity(v); saveSettings({ widgetOpacity: v }); }}
              className="w-24"
            />
            <span className="text-xs text-gray-500 w-8">{widgetOpacity}%</span>
          </div>
        </label>
        <label className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-700">默认尺寸</span>
          <select value={widgetSize}
            onChange={(e) => { const v = e.target.value as "small" | "medium" | "large"; setWidgetSize(v); saveSettings({ widgetSize: v }); }}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="small">小</option>
            <option value="medium">中</option>
            <option value="large">大</option>
          </select>
        </label>
      </section>

      {/* App Management with per-app offset */}
      <section>
        <h3 className="text-sm font-medium text-gray-600 mb-3">已关联软件</h3>
        <div className="space-y-1">
          {apps.map((app) => {
            const isExpanded = expandedApp === app.id;
            const off = offsets[app.id] ?? { x: 8, y: 32 };
            return (
              <div key={app.id}>
                <div className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedApp(isExpanded ? null : app.id)}
                      className="text-gray-400 hover:text-gray-600 text-xs w-4"
                    >
                      {isExpanded ? "\u25BE" : "\u25B8"}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">{app.display_name || app.name}</span>
                      <span className="text-xs text-gray-400">
                        {(() => { try { return JSON.parse(app.process_names).join(", "); } catch { return app.process_names; } })()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 cursor-pointer" title={app.show_widget ? "显示浮窗" : "隐藏浮窗"}>
                      <input
                        type="checkbox"
                        checked={app.show_widget}
                        onChange={(e) => handleToggleShowWidget(app.id, e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-[10px] text-gray-400">浮窗</span>
                    </label>
                    <button onClick={() => remove(app.id)} className="text-xs text-gray-400 hover:text-red-500">删除</button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="ml-6 px-2 py-2 bg-gray-50 rounded text-xs space-y-2">
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="w-14">X 偏移</span>
                      <input type="range" min={-200} max={500} value={off.x}
                        onChange={(e) => handleOffsetChange(app.id, "x", parseInt(e.target.value))}
                        className="flex-1"
                      />
                      <span className="w-8 text-gray-400">{off.x}px</span>
                      <input type="number" min={-200} max={500} value={off.x}
                        onChange={(e) => { const v = parseInt(e.target.value) || 0; handleOffsetChange(app.id, "x", v); }}
                        className="w-14 px-1 py-0.5 border rounded text-center text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="w-14">Y 偏移</span>
                      <input type="range" min={0} max={500} value={off.y}
                        onChange={(e) => handleOffsetChange(app.id, "y", parseInt(e.target.value))}
                        className="flex-1"
                      />
                      <span className="w-8 text-gray-400">{off.y}px</span>
                      <input type="number" min={0} max={500} value={off.y}
                        onChange={(e) => { const v = parseInt(e.target.value) || 0; handleOffsetChange(app.id, "y", v); }}
                        className="w-14 px-1 py-0.5 border rounded text-center text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <button
            onClick={handleCapture}
            disabled={capturing}
            className="w-full py-2 mt-1 text-xs rounded border border-gray-200 hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors disabled:opacity-50"
          >
            {capturing ? "点击目标窗口以抓取..." : "+ 抓取窗口添加关联软件"}
          </button>
          {apps.length === 0 && <p className="text-xs text-gray-400 py-2">暂无关联软件</p>}
        </div>
      </section>
    </div>
  );
}
