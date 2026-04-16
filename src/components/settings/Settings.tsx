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
    const saved = localStorage.getItem("overlay-todo-settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      setAutoStart(parsed.autoStart ?? false);
      setWidgetOpacity(parsed.widgetOpacity ?? 90);
      setWidgetSize(parsed.widgetSize ?? "medium");
    }
  }, []);

  const saveSettings = (updates: Record<string, unknown>) => {
    const current = JSON.parse(localStorage.getItem("overlay-todo-settings") || "{}");
    const updated = { ...current, ...updates };
    localStorage.setItem("overlay-todo-settings", JSON.stringify(updated));
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
                  {(() => {
                    try {
                      return JSON.parse(app.process_names).join(", ");
                    } catch {
                      return app.process_names;
                    }
                  })()}
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
