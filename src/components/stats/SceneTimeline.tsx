import { useState, useEffect, useMemo } from "react";
import type { TimeSession, Scene } from "../../types";
import * as api from "../../lib/invoke";

interface Props {
  rangeStart: string;
  rangeEnd: string;
}

export function SceneTimeline({ rangeStart, rangeEnd }: Props) {
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);

  useEffect(() => {
    api.getTimeSessions(rangeStart, rangeEnd, 500).then(setSessions);
    api.listScenes().then(setScenes);
  }, [rangeStart, rangeEnd]);

  const sceneColorMap = useMemo(() => {
    const map = new Map<number, string>();
    scenes.forEach((s) => map.set(s.id, s.color));
    return map;
  }, [scenes]);

  // Group sessions by scene, calculate positions on 24-hour axis
  // Only show sessions for the target date (rangeStart)
  const dayStart = new Date(rangeStart + "T00:00:00").getTime();
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const dayMs = dayEnd - dayStart;

  const blocks = useMemo(() => {
    return sessions
      .filter((s) => s.ended_at && s.scene_id && s.duration_secs)
      .map((s) => {
        const start = new Date(s.started_at + "Z").getTime();
        const end = new Date(s.ended_at + "Z").getTime();
        if (start < dayStart || start >= dayEnd) return null;
        return {
          sceneId: s.scene_id!,
          left: ((start - dayStart) / dayMs) * 100,
          width: ((end - start) / dayMs) * 100,
          duration: s.duration_secs!,
          color: sceneColorMap.get(s.scene_id!) || "#6B7280",
        };
      })
      .filter(Boolean) as { sceneId: number; left: number; width: number; duration: number; color: string }[];
  }, [sessions, dayStart, dayEnd, dayMs, sceneColorMap]);

  // Hour labels
  const hours = Array.from({ length: 25 }, (_, i) => i);

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">时间线</h3>

      {/* Hour axis */}
      <div className="relative h-16">
        {/* Hour labels */}
        <div className="absolute top-0 left-0 right-0 flex text-[9px] text-gray-400">
          {hours.filter((h) => h % 3 === 0).map((h) => (
            <span key={h} style={{ position: "absolute", left: `${(h / 24) * 100}%`, transform: "translateX(-50%)" }}>
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>

        {/* Timeline blocks */}
        <div className="absolute top-4 left-0 right-0 h-8 rounded bg-gray-50 overflow-hidden">
          {blocks.map((block, i) => (
            <div
              key={i}
              className="absolute top-0 h-full rounded-sm opacity-80 hover:opacity-100 transition-opacity"
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

      {/* Scene legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {scenes.map((scene) => (
          <div key={scene.id} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: scene.color }} />
            <span className="text-xs text-gray-500">{scene.icon} {scene.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
