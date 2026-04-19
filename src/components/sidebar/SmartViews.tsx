interface SmartViewsProps {
  onSmartView: (view: string) => void;
}

const views = [
  { key: "all", label: "全部" },
  { key: "today", label: "今天" },
];

export function SmartViews({ onSmartView }: SmartViewsProps) {
  return (
    <div className="flex items-center gap-1 px-2">
      {views.map((v) => (
        <button
          key={v.key}
          data-testid={`smart-view-${v.key}`}
          onClick={() => onSmartView(v.key)}
          className="px-2 py-0.5 text-xs text-muted-foreground rounded-full hover:bg-accent hover:text-theme transition-colors"
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
