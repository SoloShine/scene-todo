import { useState, useEffect, useCallback } from "react";
import type { Scene, CreateScene, UpdateScene } from "../types";
import * as api from "../lib/invoke";

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
    const scene = await api.createScene(input);
    await refresh();
    notifyScenesChanged();
    return scene;
  };

  const update = async (input: UpdateScene) => {
    const scene = await api.updateScene(input);
    await refresh();
    notifyScenesChanged();
    return scene;
  };

  const remove = async (id: number) => {
    await api.deleteScene(id);
    await refresh();
    notifyScenesChanged();
  };

  return { scenes, loading, create, update, remove, refresh };
}
