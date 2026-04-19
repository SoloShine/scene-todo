import { useState, useEffect, useCallback } from "react";
import type { App, CreateApp } from "../types";
import * as api from "../lib/invoke";
import { notify } from "../lib/toast";

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
    try {
      const app = await api.createApp(input);
      await refresh();
      notify.success("应用已创建");
      return app;
    } catch (e) { notify.error("创建应用失败"); throw e; }
  };

  const remove = async (id: number) => {
    try {
      await api.deleteApp(id);
      await refresh();
      notify.success("应用已删除");
    } catch (e) { notify.error("删除应用失败"); throw e; }
  };

  return { apps, loading, create, remove, refresh };
}
