import { useState, useEffect, useCallback } from "react";
import type { SceneTimeSummary, TrackingStatus } from "../types";
import * as api from "../lib/invoke";
import { notify } from "../lib/toast";

export function useTimeStats(rangeStart: string, rangeEnd: string) {
  const [summary, setSummary] = useState<SceneTimeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getTimeSummary(rangeStart, rangeEnd);
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd]);

  useEffect(() => { refresh(); }, [refresh]);

  const getDetail = async (sceneId: number) => {
    return api.getTimeDetail(sceneId, rangeStart, rangeEnd);
  };

  const getSessions = async (limit = 100) => {
    return api.getTimeSessions(rangeStart, rangeEnd, limit);
  };

  return { summary, loading, refresh, getDetail, getSessions };
}

export function useTrackingStatus() {
  const [status, setStatus] = useState<TrackingStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getTrackingStatus();
      setStatus(data);
    } catch {}
  }, []);

  useEffect(() => { refresh(); const interval = setInterval(refresh, 2000); return () => clearInterval(interval); }, [refresh]);

  const setPaused = async (paused: boolean) => {
    try {
      await api.setTrackingPaused(paused);
      await refresh();
      notify.info(paused ? "追踪已暂停" : "追踪已恢复");
    } catch (e) { notify.error("操作失败"); throw e; }
  };

  return { status, setPaused, refresh };
}
