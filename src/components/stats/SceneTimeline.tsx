import { useState, useEffect, useMemo } from "react";
import type { TimeSession, Scene } from "../../types";
import * as api from "../../lib/invoke";

const DISTINCT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9", "#8b5cf6", "#ec4899", "#14b8a6"];

function resolveColor(color: string, index: number): string {
  if (!color || color === "#6B7280") {
    return DISTINCT_COLORS[index % DISTINCT_COLORS.length];
  }
  return color;
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ""}`;
  return `${m}m`;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

interface Props {
  rangeStart: string;
  rangeEnd: string;
  preset: string;
}

export function SceneTimeline({ rangeStart, rangeEnd, preset }: Props) {
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);

  useEffect(() => {
    api.getTimeSessions(rangeStart, rangeEnd, 2000).then(setSessions);
    api.listScenes().then(setScenes);
  }, [rangeStart, rangeEnd]);

  const sceneColorMap = useMemo(() => {
    const map = new Map<number, string>();
    scenes.forEach((s, i) => map.set(s.id, resolveColor(s.color, i)));
    return map;
  }, [scenes]);

  const validSessions = useMemo(
    () => sessions.filter((s) => s.ended_at && s.scene_id && s.duration_secs),
    [sessions]
  );

  if (preset === "today" || preset === "custom") {
    return <DayTimeline sessions={validSessions} sceneColorMap={sceneColorMap} scenes={scenes} date={rangeStart} />;
  }
  if (preset === "week") {
    return <WeekTimeline sessions={validSessions} sceneColorMap={sceneColorMap} scenes={scenes} rangeStart={rangeStart} />;
  }
  // month
  return <MonthTimeline sessions={validSessions} sceneColorMap={sceneColorMap} scenes={scenes} rangeStart={rangeStart} />;
}

// --- Shared legend ---
function SceneLegend({ scenes }: { scenes: Scene[] }) {
  return (
    <div className="flex flex-wrap gap-3 mt-3">
      {scenes.map((scene, i) => {
        const c = resolveColor(scene.color, i);
        return (
          <div key={scene.id} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
            <span className="text-xs text-muted-foreground">{scene.icon} {scene.name}</span>
          </div>
        );
      })}
    </div>
  );
}

// --- Day: 24-hour axis ---
function DayTimeline({ sessions, sceneColorMap, scenes, date }: {
  sessions: TimeSession[]; sceneColorMap: Map<number, string>; scenes: Scene[]; date: string;
}) {
  const dayStart = new Date(date + "T00:00:00").getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const dayMs = dayEnd - dayStart;

  const blocks = useMemo(() => {
    return sessions
      .map((s) => {
        const start = new Date(s.started_at).getTime();
        const end = new Date(s.ended_at!).getTime();
        const cs = Math.max(start, dayStart);
        const ce = Math.min(end, dayEnd);
        if (cs >= ce) return null;
        return {
          left: ((cs - dayStart) / dayMs) * 100,
          width: ((ce - cs) / dayMs) * 100,
          duration: s.duration_secs!,
          color: sceneColorMap.get(s.scene_id!) || DISTINCT_COLORS[0],
        };
      })
      .filter(Boolean) as { left: number; width: number; duration: number; color: string }[];
  }, [sessions, dayStart, dayEnd, dayMs, sceneColorMap]);

  const hours = Array.from({ length: 25 }, (_, i) => i);

  return (
    <div className="bg-card rounded-xl border border-surface-border p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">24 小时时间线</h3>
      {blocks.length === 0 ? (
        <p className="text-muted-foreground text-center py-6 text-sm">暂无追踪记录</p>
      ) : (
        <div className="relative h-16">
          <div className="absolute top-0 left-0 right-0 flex text-[9px] text-muted-foreground">
            {hours.filter((h) => h % 3 === 0).map((h) => (
              <span key={h} style={{ position: "absolute", left: `${(h / 24) * 100}%`, transform: "translateX(-50%)" }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          <div className="absolute top-4 left-0 right-0 h-8 rounded-md bg-background overflow-hidden">
            {blocks.map((block, i) => (
              <div
                key={i}
                className="absolute top-0 h-full rounded-md hover:opacity-80 transition-opacity"
                style={{ left: `${block.left}%`, width: `${Math.max(block.width, 0.3)}%`, backgroundColor: block.color }}
                title={`${Math.round(block.duration / 60)} min`}
              />
            ))}
          </div>
        </div>
      )}
      <SceneLegend scenes={scenes} />
    </div>
  );
}

// --- Week: 7-day stacked bars ---
function WeekTimeline({ sessions, sceneColorMap, scenes, rangeStart }: {
  sessions: TimeSession[]; sceneColorMap: Map<number, string>; scenes: Scene[]; rangeStart: string;
}) {
  // Build 7 days ending today
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return fmtDate(d);
    });
  }, [rangeStart]);

  const dayData = useMemo(() => {
    return days.map((day) => {
      const dayStart = new Date(day + "T00:00:00").getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const dayMs = dayEnd - dayStart;

      const daySessions = sessions.filter((s) => {
        const start = new Date(s.started_at).getTime();
        return start >= dayStart && start < dayEnd;
      });

      const totalSecs = daySessions.reduce((sum, s) => sum + (s.duration_secs || 0), 0);

      // Group by scene for stacking
      const byScene = new Map<number, number>();
      daySessions.forEach((s) => {
        if (s.scene_id) byScene.set(s.scene_id, (byScene.get(s.scene_id) || 0) + (s.duration_secs || 0));
      });

      // Build segments (each scene is a proportional segment of the bar)
      const segments = Array.from(byScene.entries()).map(([sceneId, secs]) => ({
        sceneId,
        secs,
        color: sceneColorMap.get(sceneId) || DISTINCT_COLORS[0],
        pct: totalSecs > 0 ? (secs / totalSecs) * 100 : 0,
      }));

      return { day, totalSecs, segments };
    });
  }, [days, sessions, sceneColorMap]);

  const maxSecs = Math.max(...dayData.map((d) => d.totalSecs), 1);
  const todayStr = fmtDate(new Date());

  return (
    <div className="bg-card rounded-xl border border-surface-border p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">近 7 天</h3>
      {dayData.every((d) => d.totalSecs === 0) ? (
        <p className="text-muted-foreground text-center py-6 text-sm">暂无追踪记录</p>
      ) : (
        <div className="flex items-end gap-1.5" style={{ height: 140 }}>
          {dayData.map((d, i) => {
            const date = new Date(d.day + "T00:00:00");
            const isToday = d.day === todayStr;
            // Height proportional to max hours (cap at 12h = full height)
            const maxDisplaySecs = Math.max(maxSecs, 3600); // at least 1h scale
            const barPct = Math.min((d.totalSecs / maxDisplaySecs) * 100, 100);
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-muted-foreground">
                  {d.totalSecs > 0 ? formatDuration(d.totalSecs) : ""}
                </span>
                <div className="w-full flex items-end" style={{ flex: 1 }}>
                  <div className="w-full flex flex-col-reverse rounded-md overflow-hidden" style={{ height: `${barPct}%`, minHeight: d.totalSecs > 0 ? 4 : 0 }}>
                    {d.segments.map((seg, si) => (
                      <div
                        key={si}
                        className="w-full transition-opacity hover:opacity-80"
                        style={{ height: `${seg.pct}%`, backgroundColor: seg.color, minHeight: 2 }}
                        title={`${formatDuration(seg.secs)}`}
                      />
                    ))}
                  </div>
                </div>
                <span className={`text-[10px] ${isToday ? "text-theme font-semibold" : "text-muted-foreground"}`}>
                  {WEEKDAYS[date.getDay()]}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <SceneLegend scenes={scenes} />
    </div>
  );
}

// --- Month: 30-day heatmap ---
function MonthTimeline({ sessions, sceneColorMap, scenes, rangeStart }: {
  sessions: TimeSession[]; sceneColorMap: Map<number, string>; scenes: Scene[]; rangeStart: string;
}) {
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (29 - i));
      return fmtDate(d);
    });
  }, [rangeStart]);

  const dayData = useMemo(() => {
    return days.map((day) => {
      const dayStart = new Date(day + "T00:00:00").getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const totalSecs = sessions
        .filter((s) => {
          const start = new Date(s.started_at).getTime();
          return start >= dayStart && start < dayEnd;
        })
        .reduce((sum, s) => sum + (s.duration_secs || 0), 0);
      return { day, totalSecs };
    });
  }, [days, sessions]);

  const maxSecs = Math.max(...dayData.map((d) => d.totalSecs), 1);
  const todayStr = fmtDate(new Date());

  // Build rows of 7 (Mon-Sun), like GitHub contribution graph
  const weeks = useMemo(() => {
    const result: { day: string; totalSecs: number }[][] = [];
    let week: { day: string; totalSecs: number }[] = [];
    // Pad first week to start on Monday
    const firstDay = new Date(dayData[0].day + "T00:00:00");
    const firstDow = firstDay.getDay(); // 0=Sun
    const padCount = firstDow === 0 ? 6 : firstDow - 1; // offset to Monday
    for (let i = 0; i < padCount; i++) {
      week.push({ day: "", totalSecs: 0 });
    }
    dayData.forEach((d) => {
      week.push(d);
      if (week.length === 7) {
        result.push(week);
        week = [];
      }
    });
    if (week.length > 0) {
      while (week.length < 7) week.push({ day: "", totalSecs: 0 });
      result.push(week);
    }
    return result;
  }, [dayData]);

  function intensity(secs: number): string {
    if (secs === 0) return "bg-muted";
    const ratio = secs / maxSecs;
    if (ratio < 0.25) return "opacity-40";
    if (ratio < 0.5) return "opacity-60";
    if (ratio < 0.75) return "opacity-80";
    return "opacity-100";
  }

  const primaryColor = scenes.length > 0 ? resolveColor(scenes[0].color, 0) : DISTINCT_COLORS[0];

  return (
    <div className="bg-card rounded-xl border border-surface-border p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">近 30 天</h3>
      {dayData.every((d) => d.totalSecs === 0) ? (
        <p className="text-muted-foreground text-center py-6 text-sm">暂无追踪记录</p>
      ) : (
        <div className="overflow-x-auto">
          {/* Heatmap grid with weekday labels on left */}
          <div className="flex gap-0.5">
            {/* Weekday labels column */}
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              {["一", "", "三", "", "五", "", "日"].map((label, i) => (
                <div key={i} className="h-3 w-4 flex items-center justify-end text-[9px] text-muted-foreground">{label}</div>
              ))}
            </div>
            {/* Week columns */}
            {weeks.map((w, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {w.map((d, di) => {
                  if (!d.day) return <div key={di} className="w-3 h-3" />;
                  const isToday = d.day === todayStr;
                  return (
                    <div
                      key={di}
                      className={`w-3 h-3 rounded-sm ${intensity(d.totalSecs)} ${isToday ? "ring-1 ring-foreground" : ""}`}
                      style={d.totalSecs > 0 ? { backgroundColor: primaryColor } : {}}
                      title={`${d.day}: ${d.totalSecs > 0 ? formatDuration(d.totalSecs) : "无记录"}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      <SceneLegend scenes={scenes} />
    </div>
  );
}
