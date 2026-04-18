import { useState, useMemo } from "react";
import { useTimeStats, useTrackingStatus } from "../../hooks/useTimeStats";
import { TimeDistribution } from "./TimeDistribution";
import { SceneTimeline } from "./SceneTimeline";
import { RealtimeOverview } from "./RealtimeOverview";

type RangePreset = "today" | "week" | "month" | "custom";

function getDateRange(preset: RangePreset, customStart?: string, customEnd?: string): [string, string] {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  switch (preset) {
    case "today":
      return [fmt(now), fmt(now)];
    case "week": {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return [fmt(weekAgo), fmt(now)];
    }
    case "month": {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return [fmt(monthAgo), fmt(now)];
    }
    case "custom":
      return [customStart || fmt(now), customEnd || fmt(now)];
  }
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function StatsView() {
  const [preset, setPreset] = useState<RangePreset>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [rangeStart, rangeEnd] = getDateRange(preset, customStart, customEnd);
  const { summary, loading } = useTimeStats(rangeStart, rangeEnd);
  const { status } = useTrackingStatus();

  const totalSecs = useMemo(() => summary.reduce((s, item) => s + item.total_secs, 0), [summary]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-foreground">时间统计</h2>
        <div className="flex items-center gap-2">
          {status && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${status.paused ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
              {status.paused ? "追踪已暂停" : `追踪中${status.current_scene_name ? ` · ${status.current_scene_name}` : ""}`}
            </span>
          )}
        </div>
      </div>

      {/* Date range selector */}
      <div className="flex items-center gap-3 mb-6">
        <div className="inline-flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(["today", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                preset === p
                  ? "bg-theme text-theme-text font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "today" ? "今天" : p === "week" ? "本周" : "本月"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <input type="date" value={customStart} onChange={(e) => { setCustomStart(e.target.value); setPreset("custom"); }}
            className="px-2 py-1 text-sm border border-surface-border rounded" />
          <span className="text-muted-foreground text-sm">~</span>
          <input type="date" value={customEnd} onChange={(e) => { setCustomEnd(e.target.value); setPreset("custom"); }}
            className="px-2 py-1 text-sm border border-surface-border rounded" />
        </div>
      </div>

      {/* Realtime overview */}
      <RealtimeOverview status={status} totalToday={totalSecs} />

      {loading ? (
        <p className="text-muted-foreground text-center py-8">加载中...</p>
      ) : summary.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">暂无追踪数据</p>
      ) : (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <TimeDistribution summary={summary} totalSecs={totalSecs} />

            {/* Scene ranking list */}
            <div className="bg-card rounded-xl border border-surface-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">场景排行</h3>
              <div className="space-y-2">
                {summary.map((item) => (
                  <div key={item.scene_id} className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm flex-1 truncate">{item.scene_name}</span>
                    <span className="text-sm text-muted-foreground">{formatDuration(item.total_secs)}</span>
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">{item.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
                <span className="text-muted-foreground">总计</span>
                <span className="font-semibold text-foreground">{formatDuration(totalSecs)}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <SceneTimeline rangeStart={rangeStart} rangeEnd={rangeEnd} />
        </>
      )}
    </div>
  );
}
