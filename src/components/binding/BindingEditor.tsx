import { useState } from "react";
import { useApps } from "../../hooks/useApps";
import * as api from "../../lib/invoke";

interface BindingEditorProps {
  todoId: number;
  onClose: () => void;
  onRefresh: () => void;
}

export function BindingEditor({ todoId, onClose, onRefresh }: BindingEditorProps) {
  const { apps, create, refresh: refreshApps } = useApps();
  const [capturing, setCapturing] = useState(false);
  const [boundAppIds, setBoundAppIds] = useState<number[]>([]);

  // Fetch real bound app IDs on mount
  useState(() => {
    api.getTodoWithDetails(todoId).then((details) => {
      setBoundAppIds(details.bound_app_ids);
    });
  });

  const handleToggle = async (appId: number) => {
    if (boundAppIds.includes(appId)) {
      await api.unbindTodoFromApp(todoId, appId);
      setBoundAppIds((prev) => prev.filter((id) => id !== appId));
    } else {
      await api.bindTodoToApp(todoId, appId);
      setBoundAppIds((prev) => [...prev, appId]);
    }
    onRefresh();
  };

  const handleStartCapture = async () => {
    setCapturing(true);
    try {
      const result = await api.startWindowCapture();
      const { process_name, window_title } = result;
      if (!process_name) return;

      const existing = apps.find((a) =>
        a.process_names
          .toLowerCase()
          .split(",")
          .some((p) => p.trim() === process_name.toLowerCase())
      );

      let appId: number;
      if (existing) {
        appId = existing.id;
      } else {
        const displayName = window_title || process_name.replace(/\.[^.]+$/, "");
        const newApp = await create({
          name: displayName,
          process_names: [process_name],
        });
        appId = newApp.id;
      }

      if (!boundAppIds.includes(appId)) {
        await api.bindTodoToApp(todoId, appId);
        setBoundAppIds((prev) => [...prev, appId]);
      }
      await refreshApps();
      onRefresh();
    } catch (e) {
      console.error("Window capture failed:", e);
    } finally {
      setCapturing(false);
    }
  };

  if (capturing) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg text-sm animate-pulse z-50">
        点击目标窗口以抓取...
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-80 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">关联软件</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        <button
          onClick={handleStartCapture}
          className="w-full py-2 mb-3 text-sm rounded border bg-white border-gray-200 hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors"
        >
          + 点击后选择目标窗口
        </button>

        <div className="space-y-1 max-h-60 overflow-y-auto">
          {apps.map((app) => (
            <label
              key={app.id}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
            >
              <input
                type="checkbox"
                checked={boundAppIds.includes(app.id)}
                onChange={() => handleToggle(app.id)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{app.display_name || app.name}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
