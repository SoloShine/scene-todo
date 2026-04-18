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

interface Props {
  rangeStart: string;
  rangeEnd: string;
}

export function SceneTimeline({ rangeStart, rangeEnd }: Props) {
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);

  useEffect(() => {
    // Fetch sessions for today specifically
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    api.getTimeSessions(todayStr, todayStr, 500).then(setSessions);
    api.listScenes().then(setScenes);
  }, [rangeStart, rangeEnd]);

  const sceneColorMap = useMemo(() => {
    const map = new Map<number, string>();
    scenes.forEach((s, i) => map.set(s.id, resolveColor(s.color, i)));
    return map;
  }, [scenes]);

  // Always show today's timeline regardless of selected range
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const dayStart = new Date(todayStr + "T00:00:00").getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const dayMs = dayEnd - dayStart;

  const blocks = useMemo(() => {
    return sessions
      .filter((s) => s.ended_at && s.scene_id && s.duration_secs)
      .map((s) => {
        const start = new Date(s.started_at).getTime();
        const end = new Date(s.ended_at).getTime();
        // Clamp to day boundaries
        const clampedStart = Math.max(start, dayStart);
        const clampedEnd = Math.min(end, dayEnd);
        if (clampedStart >= clampedEnd) return null;
        return {
          sceneId: s.scene_id!,
          left: ((clampedStart - dayStart) / dayMs) * 100,
          width: ((clampedEnd - clampedStart) / dayMs) * 100,
          duration: s.duration_secs!,
          color: sceneColorMap.get(s.scene_id!) || DISTINCT_COLORS[0],
        };
      })
      .filter(Boolean) as { sceneId: number; left: number; width: number; duration: number; color: string }[];
  }, [sessions, dayStart, dayEnd, dayMs, sceneColorMap]);

  // Hour labels
  const hours = Array.from({ length: 25 }, (_, i) => i);

  return (
    <div className="bg-card rounded-xl border border-surface-border p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">今日时间线</h3>

      {blocks.length === 0 ? (
        <p className="text-muted-foreground text-center py-6 text-sm">今日暂无追踪记录</p>
      ) : (
        <>
          {/* Hour axis */}
          <div className="relative h-16">
            {/* Hour labels */}
            <div className="absolute top-0 left-0 right-0 flex text-[9px] text-muted-foreground">
              {hours.filter((h) => h % 3 === 0).map((h) => (
                <span key={h} style={{ position: "absolute", left: `${(h / 24) * 100}%`, transform: "translateX(-50%)" }}>
                  {String(h).padStart(2, "0")}:00
                </span>
              ))}
            </div>

            {/* Timeline blocks */}
            <div className="absolute top-4 left-0 right-0 h-8 rounded-md bg-background overflow-hidden">
              {blocks.map((block, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full rounded-md hover:opacity-80 transition-opacity"
                  style={{
                    left: `${block.left}%`,
                    width: `${Math.max(block.width, 0.3)}%`,
                    backgroundColor: block.color,
                  }}
                  title={`${Math.round(block.duration / 60)} min`}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Scene legend */}
      {scenes.length > 0 && (
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
      )}
    </div>
  );
}
