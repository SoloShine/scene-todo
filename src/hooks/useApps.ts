import { useState, useEffect, useCallback } from "react";
import type { App, CreateApp } from "../types";
import * as api from "../lib/invoke";

export function useApps() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listApps();
      setApps(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (input: CreateApp) => {
    const app = await api.createApp(input);
    await refresh();
    return app;
  };

  const remove = async (id: number) => {
    await api.deleteApp(id);
    await refresh();
  };

  return { apps, loading, create, remove, refresh };
}
