import { useState, useEffect, useCallback } from "react";
import type { Scene, CreateScene, UpdateScene } from "../types";
import * as api from "../lib/invoke";
import { notify } from "../lib/toast";

const SCENES_CHANGED = "scenes-changed";

function notifyScenesChanged() {
  window.dispatchEvent(new CustomEvent(SCENES_CHANGED));
}

export function useScenes() {
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listScenes();
      setScenes(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener(SCENES_CHANGED, handler);
    return () => window.removeEventListener(SCENES_CHANGED, handler);
  }, [refresh]);

  const create = async (input: CreateScene) => {
    try {
      const scene = await api.createScene(input);
      await refresh();
      notifyScenesChanged();
      notify.success("场景已创建");
      return scene;
    } catch (e) { notify.error("创建场景失败"); throw e; }
  };

  const update = async (input: UpdateScene) => {
    try {
      const scene = await api.updateScene(input);
      await refresh();
      notifyScenesChanged();
      notify.success("场景已更新");
      return scene;
    } catch (e) { notify.error("更新场景失败"); throw e; }
  };

  const remove = async (id: number) => {
    try {
      await api.deleteScene(id);
      await refresh();
      notifyScenesChanged();
      notify.success("场景已删除");
    } catch (e) { notify.error("删除场景失败"); throw e; }
  };

  return { scenes, loading, create, update, remove, refresh };
}
