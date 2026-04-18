import { useTheme, type AccentPreset, type ColorMode } from "../../hooks/useTheme";

const accents: { key: AccentPreset; label: string; color: string }[] = [
  { key: "indigo", label: "靛蓝", color: "#6366f1" },
  { key: "emerald", label: "翡翠", color: "#10b981" },
  { key: "rose", label: "玫瑰", color: "#f43f5e" },
  { key: "slate", label: "石板灰", color: "#475569" },
  { key: "amber", label: "琥珀", color: "#f59e0b" },
  { key: "sky", label: "天蓝", color: "#0ea5e9" },
];

const modes: { key: ColorMode; label: string; icon: string }[] = [
  { key: "light", label: "浅色", icon: "☀" },
  { key: "dark", label: "深色", icon: "🌙" },
  { key: "system", label: "系统", icon: "💻" },
];

export function ThemeSettings() {
  const { accent, mode, setAccent, setMode } = useTheme();

  return (
    <section>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">外观</h3>

      <div className="mb-4">
        <label className="text-xs text-muted-foreground mb-2 block">明暗模式</label>
        <div className="inline-flex gap-1 bg-muted rounded-lg p-0.5">
          {modes.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 ${
                mode === m.key
                  ? "bg-card text-foreground shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-2 block">主题色</label>
        <div className="flex gap-2">
          {accents.map((a) => (
            <button
              key={a.key}
              onClick={() => setAccent(a.key)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                accent === a.key
                  ? "border-foreground scale-110"
                  : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: a.color }}
              title={a.label}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
