import { useState, useEffect, useCallback } from "react";
import type { SceneTimeSummary, TrackingStatus } from "../types";
import * as api from "../lib/invoke";

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

  useEffect(() => { refresh(); const interval = setInterval(refresh, 5000); return () => clearInterval(interval); }, [refresh]);

  const setPaused = async (paused: boolean) => {
    await api.setTrackingPaused(paused);
    await refresh();
  };

  return { status, setPaused, refresh };
}
