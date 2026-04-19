import { useState, useEffect } from "react";
import { useScenes } from "../../hooks/useScenes";
import { useApps } from "../../hooks/useApps";
import { ScenePicker } from "../scene/ScenePicker";
import * as api from "../../lib/invoke";
import { notify } from "../../lib/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface BindingEditorProps {
  todoId: number;
  onClose: () => void;
  onRefresh: () => void;
}

export function BindingEditor({ todoId, onClose, onRefresh }: BindingEditorProps) {
  const { scenes, create: createScene, refresh: refreshScenes } = useScenes();
  const { apps, create: createApp, refresh: refreshApps } = useApps();
  const [capturing, setCapturing] = useState(false);
  const [boundSceneIds, setBoundSceneIds] = useState<number[]>([]);

  useEffect(() => {
    api.getTodoWithDetails(todoId).then((details) => {
      setBoundSceneIds(details.bound_scene_ids);
    });
  }, [todoId]);

  const handleToggle = async (sceneId: number) => {
    try {
      if (boundSceneIds.includes(sceneId)) {
        await api.unbindTodoFromScene(todoId, sceneId);
        setBoundSceneIds((prev) => prev.filter((id) => id !== sceneId));
      } else {
        await api.bindTodoToScene(todoId, sceneId);
        setBoundSceneIds((prev) => [...prev, sceneId]);
      }
      onRefresh();
    } catch {
      notify.error("更新场景绑定失败");
    }
  };

  const handleStartCapture = async () => {
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
        const newApp = await createApp({
          name: displayName,
          process_names: [process_name],
        });
        appId = newApp.id;
      }

      const matchingScenes = await Promise.all(
        scenes.map(async (s) => {
          const sceneApps = await api.listSceneApps(s.id);
          return sceneApps.some((sa) => sa.app_id === appId) ? s : null;
        })
      );
      const matched = matchingScenes.filter(Boolean);

      let sceneId: number;
      if (matched.length === 1) {
        sceneId = matched[0]!.id;
      } else if (matched.length > 1) {
        sceneId = matched[0]!.id;
      } else {
        const displayName = apps.find((a) => a.id === appId)?.display_name || process_name.replace(/\.[^.]+$/, "");
        const newScene = await createScene({ name: displayName });
        await api.addAppToScene(newScene.id, appId, 0);
        sceneId = newScene.id;
        await refreshScenes();
      }

      if (!boundSceneIds.includes(sceneId)) {
        await api.bindTodoToScene(todoId, sceneId);
        setBoundSceneIds((prev) => [...prev, sceneId]);
      }
      await refreshApps();
      onRefresh();
    } catch (e) {
      console.error("Window capture failed:", e);
      notify.error("窗口抓取失败");
    } finally {
      setCapturing(false);
    }
  };

  if (capturing) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-theme text-theme-text px-4 py-2 rounded-full shadow-lg text-sm animate-pulse z-50">
        点击目标窗口以抓取...
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="w-80">
        <DialogHeader>
          <DialogTitle>关联场景</DialogTitle>
        </DialogHeader>
        <Button variant="outline" onClick={handleStartCapture} className="w-full mb-3" disabled={capturing}>
          {capturing ? "点击目标窗口..." : "+ 点击后选择目标窗口"}
        </Button>
        <ScenePicker boundSceneIds={boundSceneIds} onToggle={handleToggle} />
      </DialogContent>
    </Dialog>
  );
}
