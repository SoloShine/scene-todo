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
  const { apps, create: createApp, refresh: refreshApps } = useApps();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");
  const [color, setColor] = useState("#6B7280");
  const [trackTime, setTrackTime] = useState(true);
  const [sceneApps, setSceneApps] = useState<SceneApp[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const existingScene = sceneId ? scenes.find((s) => s.id === sceneId) : null;

  useEffect(() => {
    if (existingScene) {
      setName(existingScene.name);
      setIcon(existingScene.icon || "📁");
      setColor(existingScene.color);
      setTrackTime(existingScene.track_time);
      api.listSceneApps(existingScene.id).then(setSceneApps);
    } else if (!sceneId) {
      // New scene — reset form
      setName("");
      setIcon("📁");
      setColor("#6B7280");
      setTrackTime(true);
      setSceneApps([]);
    }
  }, [sceneId, existingScene]);

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

  const handleCapture = async () => {
    if (!existingScene) return;
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

      let appId: number;
      if (existing) {
        appId = existing.id;
      } else {
        const displayName = process_name.replace(/\.[^.]+$/, "");
        const newApp = await createApp({ name: displayName, process_names: [process_name] });
        appId = newApp.id;
      }

      // Check if already bound to this scene
      const alreadyBound = sceneApps.some((sa) => sa.app_id === appId);
      if (!alreadyBound) {
        await api.addAppToScene(existingScene.id, appId, 0);
        const updated = await api.listSceneApps(existingScene.id);
        setSceneApps(updated);
      }
      await refreshApps();
    } catch (e) {
      console.error("Window capture failed:", e);
    } finally {
      setCapturing(false);
    }
  };

  const handleRemoveApp = async (appId: number) => {
    if (!existingScene) return;
    await api.removeAppFromScene(existingScene.id, appId);
    setSceneApps((prev) => prev.filter((sa) => sa.app_id !== appId));
  };

  const boundAppIds = sceneApps.map((sa) => sa.app_id);
  const unboundApps = apps.filter((a) => !boundAppIds.includes(a.id));

  return (
    <div className="fixed inset-0 bg-foreground/20 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl border border-surface-border shadow-xl w-96 p-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">{existingScene ? "编辑场景" : "新建场景"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">&times;</button>
        </div>

        {/* Name */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="场景名称"
          className="w-full px-3 py-2 border border-surface-border bg-background focus:border-theme-border outline-none rounded-lg mb-3 text-sm"
        />

        {/* Icon */}
        <div className="mb-3">
          <label className="text-xs text-muted-foreground mb-1 block">图标</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-2xl w-10 h-10 flex items-center justify-center border border-surface-border rounded-lg hover:bg-accent"
            >
              {icon}
            </button>
            {showEmojiPicker && (
              <div className="flex flex-wrap gap-1">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => { setIcon(e); setShowEmojiPicker(false); }}
                    className={`text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-accent ${icon === e ? "bg-accent" : ""}`}
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
          <label className="text-xs text-muted-foreground mb-1 block">颜色</label>
          <div className="flex gap-1.5">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
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
            <label className="text-xs text-muted-foreground mb-1 block">关联应用</label>
            <div className="space-y-1">
              {sceneApps.map((sa) => {
                const app = apps.find((a) => a.id === sa.app_id);
                return (
                  <div key={sa.app_id} className="flex items-center justify-between px-2 py-1 bg-background rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      {app?.icon_path ? (
                        <img src={app.icon_path} alt="" className="w-4 h-4 rounded" />
                      ) : (
                        <div className="w-4 h-4 rounded bg-muted flex items-center justify-center text-[8px] text-muted-foreground">
                          {(app?.display_name ?? app?.name ?? "?")[0]}
                        </div>
                      )}
                      <span>{app?.display_name || app?.name || `App #${sa.app_id}`}</span>
                    </div>
                    <button onClick={() => handleRemoveApp(sa.app_id)} className="text-muted-foreground hover:text-red-500">&times;</button>
                  </div>
                );
              })}
              <div className="flex gap-1">
                <button
                  onClick={handleCapture}
                  disabled={capturing}
                  className="flex-1 py-1.5 text-xs rounded-lg border border-surface-border hover:border-theme-border hover:text-theme cursor-pointer transition-colors disabled:opacity-50"
                >
                  {capturing ? "点击目标窗口..." : "+ 抓取窗口添加"}
                </button>
                {unboundApps.length > 0 && (
                  <select
                    onChange={(e) => { if (e.target.value) handleAddApp(Number(e.target.value)); e.target.value = ""; }}
                    className="flex-1 text-xs border border-surface-border bg-background rounded-lg px-2 py-1"
                    defaultValue=""
                  >
                    <option value="">从已有应用添加</option>
                    {unboundApps.map((app) => (
                      <option key={app.id} value={app.id}>{app.display_name || app.name}</option>
                    ))}
                  </select>
                )}
              </div>
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
            <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-surface-border hover:bg-accent">取消</button>
            <button onClick={handleSave} className="px-3 py-1.5 text-sm rounded-lg bg-theme text-theme-text hover:opacity-90">保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}
