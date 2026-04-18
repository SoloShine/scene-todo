interface SectionHeaderProps {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  onAdd: () => void;
}

export function SectionHeader({ title, count, collapsed, onToggle, onAdd }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-2 py-1 group">
      <button onClick={onToggle} className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700">
        <span className="text-[10px]">{collapsed ? "▶" : "▼"}</span>
        <span>{title}</span>
        <span className="text-[10px] text-gray-400 font-normal normal-case">({count})</span>
      </button>
      <button onClick={onAdd} className="text-gray-400 hover:text-gray-600 text-sm opacity-0 group-hover:opacity-100 transition-opacity">+</button>
    </div>
  );
}
