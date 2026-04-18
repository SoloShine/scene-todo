import { useState, useEffect } from "react";
import type { TrackingStatus } from "../../types";

interface Props {
  status: TrackingStatus | null;
  totalToday: number;
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${secs}s`;
}

export function RealtimeOverview({ status, totalToday }: Props) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  if (!status) return null;

  const sessionDuration = status.session_started_at
    ? Math.floor((Date.now() - new Date(status.session_started_at.replace(" ", "T")).getTime()) / 1000)
    : 0;

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-card rounded-xl border border-surface-border p-4">
        <p className="text-xs text-muted-foreground mb-1">当前场景</p>
        <p className="text-lg text-foreground font-semibold">
          {status.current_scene_name || "无"}
        </p>
      </div>
      <div className="bg-card rounded-xl border border-surface-border p-4">
        <p className="text-xs text-muted-foreground mb-1">当前会话</p>
        <p className="text-lg text-foreground font-semibold">
          {status.session_started_at ? formatDuration(sessionDuration) : "--"}
        </p>
      </div>
      <div className="bg-card rounded-xl border border-surface-border p-4">
        <p className="text-xs text-muted-foreground mb-1">今日追踪</p>
        <p className="text-lg text-foreground font-semibold">{formatDuration(totalToday)}</p>
      </div>
      <div className="bg-card rounded-xl border border-surface-border p-4">
        <p className="text-xs text-muted-foreground mb-1">当前时间</p>
        <p className="text-lg text-foreground font-semibold">
          {now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </p>
      </div>
    </div>
  );
}
