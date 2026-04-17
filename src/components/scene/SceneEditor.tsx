import { useState, useEffect } from "react";
import { useScenes } from "../../hooks/useScenes";
import { useApps } from "../../hooks/useApps";
import * as api from "../../lib/invoke";
import type { SceneApp } from "../../types";

interface SceneEditorProps {
  sceneId: number | null;
  onClose: () => void;
}

const EMOJI_OPTIONS = ["📁", "💻", "🎮", "📚", "🎨", "🎵", "📊", "🔧", "📝", "🌍", "🏠", "⚡", "🎯", "🧪", "💬", "📹"];

const COLOR_OPTIONS = [
  "#6B7280", "#EF4444", "#F97316", "#EAB308", "#22C55E",
  "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6",
];

export function SceneEditor({ sceneId, onClose }: SceneEditorProps) {
  const { scenes, create, update, remove } = useScenes();
  const { apps } = useApps();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");
  const [color, setColor] = useState("#6B7280");
  const [trackTime, setTrackTime] = useState(true);
  const [sceneApps, setSceneApps] = useState<SceneApp[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const existingScene = sceneId ? scenes.find((s) => s.id === sceneId) : null;

  useEffect(() => {
    if (existingScene) {
      setName(existingScene.name);
      setIcon(existingScene.icon || "📁");
      setColor(existingScene.color);
      setTrackTime(existingScene.track_time);
      api.listSceneApps(existingScene.id).then(setSceneApps);
    }
  }, [sceneId]);

  const handleSave = async () => {
    if (!name.trim()) return;
    if (existingScene) {
      await update({ id: existingScene.id, name, icon, color, track_time: trackTime });
    } else {
      await create({ name: name.trim(), icon, color, track_time: trackTime });
    }
    onClose();
  };

  const handleDelete = async () => {
    if (existingScene && confirm("确定删除此场景？")) {
      await remove(existingScene.id);
      onClose();
    }
  };

  const handleAddApp = async (appId: number) => {
    if (!existingScene) return;
    await api.addAppToScene(existingScene.id, appId, 0);
    const updated = await api.listSceneApps(existingScene.id);
    setSceneApps(updated);
  };

  const handleRemoveApp = async (appId: number) => {
    if (!existingScene) return;
    await api.removeAppFromScene(existingScene.id, appId);
    setSceneApps((prev) => prev.filter((sa) => sa.app_id !== appId));
  };

  const boundAppIds = sceneApps.map((sa) => sa.app_id);
  const unboundApps = apps.filter((a) => !boundAppIds.includes(a.id));

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-96 p-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{existingScene ? "编辑场景" : "新建场景"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        {/* Name */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="场景名称"
          className="w-full px-3 py-2 border border-gray-200 rounded mb-3 text-sm"
        />

        {/* Icon */}
        <div className="mb-3">
          <label className="text-xs text-gray-500 mb-1 block">图标</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-2xl w-10 h-10 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-50"
            >
              {icon}
            </button>
            {showEmojiPicker && (
              <div className="flex flex-wrap gap-1">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => { setIcon(e); setShowEmojiPicker(false); }}
                    className={`text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 ${icon === e ? "bg-blue-50" : ""}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Color */}
        <div className="mb-3">
          <label className="text-xs text-gray-500 mb-1 block">颜色</label>
          <div className="flex gap-1.5">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-gray-800" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Track Time */}
        <label className="flex items-center gap-2 mb-4 text-sm">
          <input
            type="checkbox"
            checked={trackTime}
            onChange={(e) => setTrackTime(e.target.checked)}
            className="rounded"
          />
          追踪时间
        </label>

        {/* Associated Apps (only for existing scenes) */}
        {existingScene && (
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">关联应用</label>
            <div className="space-y-1">
              {sceneApps.map((sa) => {
                const app = apps.find((a) => a.id === sa.app_id);
                return (
                  <div key={sa.app_id} className="flex items-center justify-between px-2 py-1 bg-gray-50 rounded text-sm">
                    <span>{app?.display_name || app?.name || `App #${sa.app_id}`}</span>
                    <button onClick={() => handleRemoveApp(sa.app_id)} className="text-gray-400 hover:text-red-500">&times;</button>
                  </div>
                );
              })}
              {unboundApps.length > 0 && (
                <select
                  onChange={(e) => { if (e.target.value) handleAddApp(Number(e.target.value)); e.target.value = ""; }}
                  className="w-full text-sm border border-gray-200 rounded px-2 py-1"
                  defaultValue=""
                >
                  <option value="">+ 添加应用...</option>
                  {unboundApps.map((app) => (
                    <option key={app.id} value={app.id}>{app.display_name || app.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div>
            {existingScene && (
              <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-700">
                删除场景
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border hover:bg-gray-50">取消</button>
            <button onClick={handleSave} className="px-3 py-1.5 text-sm rounded bg-blue-500 text-white hover:bg-blue-600">保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}
