import { useState, useMemo } from "react";
import { useTimeStats, useTrackingStatus } from "../../hooks/useTimeStats";
import { TimeDistribution } from "./TimeDistribution";
import { SceneTimeline } from "./SceneTimeline";
import { RealtimeOverview } from "./RealtimeOverview";
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { BarChart3 } from "lucide-react"

type RangePreset = "today" | "week" | "month" | "custom";

function getDateRange(preset: RangePreset, customStart?: string, customEnd?: string): [string, string] {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const nextDay = (d: Date) => { const r = new Date(d); r.setDate(r.getDate() + 1); return fmt(r); };

  switch (preset) {
    case "today":
      return [fmt(now), nextDay(now)];
    case "week": {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return [fmt(weekAgo), nextDay(now)];
    }
    case "month": {
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return [fmt(monthAgo), nextDay(now)];
    }
    case "custom": {
      const end = customEnd || fmt(now);
      const endD = new Date(end + "T00:00:00");
      return [customStart || fmt(now), nextDay(endD)];
    }
  }
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const DISTINCT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6"];

// Assign distinct colors when scene uses the default gray
function resolveColor(color: string, index: number): string {
  if (!color || color === "#6B7280") {
    return DISTINCT_COLORS[index % DISTINCT_COLORS.length];
  }
  return color;
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
          <Input type="date" value={customStart} onChange={(e) => { setCustomStart(e.target.value); setPreset("custom"); }}
            className="px-2 py-1 text-sm w-36" />
          <span className="text-muted-foreground text-sm">~</span>
          <Input type="date" value={customEnd} onChange={(e) => { setCustomEnd(e.target.value); setPreset("custom"); }}
            className="px-2 py-1 text-sm w-36" />
        </div>
      </div>

      {/* Realtime overview */}
      <RealtimeOverview status={status} totalToday={totalSecs} />

      {loading ? (
        <p className="text-muted-foreground text-center py-8">加载中...</p>
      ) : summary.length === 0 ? (
        <EmptyState icon={<BarChart3 />} title="暂无统计数据" description="开始使用应用后将生成统计信息" />
      ) : (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <TimeDistribution summary={summary.map((s, i) => ({ ...s, color: resolveColor(s.color, i) }))} totalSecs={totalSecs} />

            {/* Scene ranking list */}
            <div className="bg-card rounded-xl border border-surface-border p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">场景排行</h3>
              <div className="space-y-2.5">
                {summary.map((item, i) => {
                  const c = resolveColor(item.color, i);
                  return (
                    <div key={item.scene_id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
                          <span className="text-sm text-foreground truncate">{item.scene_name}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-xs text-muted-foreground">{formatDuration(item.total_secs)}</span>
                          <span className="text-xs text-muted-foreground w-12 text-right">{item.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${item.percentage}%`, backgroundColor: c }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-surface-divider flex items-center justify-between text-sm">
                <span className="text-muted-foreground">总计</span>
                <span className="font-semibold text-foreground">{formatDuration(totalSecs)}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <SceneTimeline rangeStart={rangeStart} rangeEnd={rangeEnd} preset={preset} />
        </>
      )}
    </div>
  );
}
