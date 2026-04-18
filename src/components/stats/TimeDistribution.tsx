import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { SceneTimeSummary } from "../../types";

interface Props {
  summary: SceneTimeSummary[];
  totalSecs: number;
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function TimeDistribution({ summary, totalSecs }: Props) {
  return (
    <div className="bg-card rounded-xl border border-surface-border p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">时间分布</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={summary}
              dataKey="total_secs"
              nameKey="scene_name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
            >
              {summary.map((entry) => (
                <Cell key={entry.scene_id} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [formatDuration(Number(value)), ""]}
              contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {totalSecs > 0 && (
        <p className="text-center text-xs text-muted-foreground mt-1">
          共 {formatDuration(totalSecs)}
        </p>
      )}
    </div>
  );
}
