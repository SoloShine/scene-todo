interface SmartViewsProps {
  onSmartView: (view: string) => void;
}

const views = [
  { key: "all", label: "\u5168\u90E8", icon: "\uD83D\uDCCB" },
  { key: "today", label: "\u4ECA\u5929", icon: "\uD83D\uDCC5" },
];

export function SmartViews({ onSmartView }: SmartViewsProps) {
  return (
    <div className="space-y-0.5">
      <h3 className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">
        智能视图
      </h3>
      {views.map((v) => (
        <button
          key={v.key}
          onClick={() => onSmartView(v.key)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 transition-colors"
        >
          <span>{v.icon}</span>
          <span>{v.label}</span>
        </button>
      ))}
    </div>
  );
}
