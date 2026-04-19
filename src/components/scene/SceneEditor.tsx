import { useState, useEffect } from "react";
import { useScenes } from "../../hooks/useScenes";
import { useApps } from "../../hooks/useApps";
import * as api from "../../lib/invoke";
import { notify } from "../../lib/toast";
import type { SceneApp } from "../../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

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
  const [confirmDelete, setConfirmDelete] = useState(false);

  const existingScene = sceneId ? scenes.find((s) => s.id === sceneId) : null;

  useEffect(() => {
    if (existingScene) {
      setName(existingScene.name);
      setIcon(existingScene.icon || "📁");
      setColor(existingScene.color);
      setTrackTime(existingScene.track_time);
      api.listSceneApps(existingScene.id).then(setSceneApps);
    } else if (!sceneId) {
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

  const handleAddApp = async (appId: number) => {
    if (!existingScene) return;
    try {
      await api.addAppToScene(existingScene.id, appId, 0);
      const updated = await api.listSceneApps(existingScene.id);
      setSceneApps(updated);
    } catch {
      notify.error("添加应用到场景失败");
    }
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

      const alreadyBound = sceneApps.some((sa) => sa.app_id === appId);
      if (!alreadyBound) {
        await api.addAppToScene(existingScene.id, appId, 0);
        const updated = await api.listSceneApps(existingScene.id);
        setSceneApps(updated);
      }
      await refreshApps();
    } catch (e) {
      console.error("Window capture failed:", e);
      notify.error("窗口抓取失败");
    } finally {
      setCapturing(false);
    }
  };

  const handleRemoveApp = async (appId: number) => {
    if (!existingScene) return;
    try {
      await api.removeAppFromScene(existingScene.id, appId);
      setSceneApps((prev) => prev.filter((sa) => sa.app_id !== appId));
    } catch {
      notify.error("移除应用失败");
    }
  };

  const boundAppIds = sceneApps.map((sa) => sa.app_id);
  const unboundApps = apps.filter((a) => !boundAppIds.includes(a.id));

  return (
    <>
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="w-96 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{existingScene ? "编辑场景" : "新建场景"}</DialogTitle>
          </DialogHeader>

          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="场景名称" className="mb-3" />

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
          <Label className="flex items-center gap-2 mb-4 text-sm cursor-pointer">
            <Checkbox checked={trackTime} onCheckedChange={(v) => setTrackTime(!!v)} />
            追踪时间
          </Label>

          {/* Associated Apps */}
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
                  <Button
                    variant="outline"
                    onClick={handleCapture}
                    disabled={capturing}
                    className="flex-1 text-xs"
                  >
                    {capturing ? "点击目标窗口..." : "+ 抓取窗口添加"}
                  </Button>
                  {unboundApps.length > 0 && (
                    <Select onValueChange={(v) => { if (v) handleAddApp(Number(v)); }}>
                      <SelectTrigger className="flex-1 text-xs">
                        <SelectValue placeholder="从已有应用添加" />
                      </SelectTrigger>
                      <SelectContent>
                        {unboundApps.map((app) => (
                          <SelectItem key={app.id} value={String(app.id)}>
                            {app.display_name || app.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {existingScene && (
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} className="mr-auto">删除场景</Button>
            )}
            <Button variant="outline" size="sm" onClick={onClose}>取消</Button>
            <Button size="sm" onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="删除场景"
        description={existingScene ? `确定要删除场景「${existingScene.name}」吗？关联的待办将移除场景绑定。` : ""}
        variant="danger"
        confirmText="删除"
        onConfirm={async () => { if (existingScene) { await remove(existingScene.id); onClose(); } setConfirmDelete(false); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
