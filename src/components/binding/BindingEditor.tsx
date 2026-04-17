import { useState, useEffect } from "react";
import { useScenes } from "../../hooks/useScenes";
import { useApps } from "../../hooks/useApps";
import { ScenePicker } from "../scene/ScenePicker";
import * as api from "../../lib/invoke";

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
    if (boundSceneIds.includes(sceneId)) {
      await api.unbindTodoFromScene(todoId, sceneId);
      setBoundSceneIds((prev) => prev.filter((id) => id !== sceneId));
    } else {
      await api.bindTodoToScene(todoId, sceneId);
      setBoundSceneIds((prev) => [...prev, sceneId]);
    }
    onRefresh();
  };

  const handleStartCapture = async () => {
    setCapturing(true);
    try {
      const result = await api.startWindowCapture();
      const { process_name } = result;
      if (!process_name) return;

      // Find matching app
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

      // Find scenes that contain this app
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
        // Multiple scenes — pick the first one
        sceneId = matched[0]!.id;
      } else {
        // No scene contains this app — create a new scene
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
          <h3 className="font-semibold text-sm">关联场景</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        <button
          onClick={handleStartCapture}
          className="w-full py-2 mb-3 text-sm rounded border bg-white border-gray-200 hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors"
        >
          + 点击后选择目标窗口
        </button>

        <ScenePicker boundSceneIds={boundSceneIds} onToggle={handleToggle} />
      </div>
    </div>
  );
}
