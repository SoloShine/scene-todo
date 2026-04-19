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
      <button data-testid={`section-toggle-${title}`} onClick={onToggle} className="flex items-center gap-1.5 text-xs font-semibold text-theme-light uppercase tracking-wide hover:text-theme">
        <span className="text-[10px]">{collapsed ? "▶" : "▼"}</span>
        <span>{title}</span>
        <span className="text-[10px] text-muted-foreground/70 font-normal normal-case">({count})</span>
      </button>
      <button data-testid={`section-add-${title}`} onClick={onAdd} className="text-muted-foreground/70 hover:text-theme text-sm opacity-0 group-hover:opacity-100 transition-opacity">+</button>
    </div>
  );
}
