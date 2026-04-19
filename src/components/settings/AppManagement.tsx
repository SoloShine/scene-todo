import type { App } from "../../types"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface AppManagementProps {
  apps: App[]
  expandedApp: number | null
  onExpandApp: (id: number | null) => void
  offsets: Record<number, { x: number; y: number }>
  onOffsetChange: (appId: number, axis: "x" | "y", value: number) => void
  capturing: boolean
  onCapture: () => void
  refreshingIcons: boolean
  onRefreshIcons: () => void
  onRemoveApp: (id: number) => void
  onToggleShowWidget: (appId: number, show: boolean) => void
  onImportIcon: (appId: number) => void
}

export function AppManagement({
  apps,
  expandedApp,
  onExpandApp,
  offsets,
  onOffsetChange,
  capturing,
  onCapture,
  refreshingIcons,
  onRefreshIcons,
  onRemoveApp,
  onToggleShowWidget,
  onImportIcon,
}: AppManagementProps) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-theme" />
          已关联软件
        </h3>
        {apps.length > 0 && (
          <button
            onClick={onRefreshIcons}
            disabled={refreshingIcons}
            className="text-xs text-gray-400 hover:text-blue-500 disabled:opacity-50"
          >
            {refreshingIcons ? "刷新中..." : "自动获取图标"}
          </button>
        )}
      </div>
      <div className="space-y-1">
        {apps.map((app) => {
          const isExpanded = expandedApp === app.id
          const off = offsets[app.id] ?? { x: 8, y: 32 }
          return (
            <div key={app.id}>
              <div className="flex items-center justify-between py-1.5 px-2 hover:bg-accent rounded">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onExpandApp(isExpanded ? null : app.id)}
                    className="text-gray-400 hover:text-muted-foreground text-xs w-4"
                  >
                    {isExpanded ? "\u25BE" : "\u25B8"}
                  </button>
                  <div className="flex items-center gap-2">
                    {app.icon_path ? (
                      <img src={app.icon_path} alt="" className="w-5 h-5 rounded" />
                    ) : (
                      <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                        {app.display_name?.[0] || app.name[0]}
                      </div>
                    )}
                    <span className="text-sm text-foreground">{app.display_name || app.name}</span>
                    <span className="text-xs text-gray-400">
                      {(() => { try { return JSON.parse(app.process_names).join(", "); } catch { return app.process_names; } })()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="flex items-center gap-1 cursor-pointer" title={app.show_widget ? "显示浮窗" : "隐藏浮窗"}>
                    <Checkbox
                      checked={app.show_widget}
                      onCheckedChange={(v) => onToggleShowWidget(app.id, !!v)}
                    />
                    <span className="text-[10px] text-gray-400">浮窗</span>
                  </Label>
                  <button onClick={() => onRemoveApp(app.id)} className="text-xs text-gray-400 hover:text-red-500">删除</button>
                </div>
              </div>
              {isExpanded && (
                <div className="ml-6 px-2 py-2 bg-background rounded text-xs space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-14">X 偏移</span>
                    <input type="range" min={-200} max={500} value={off.x}
                      onChange={(e) => onOffsetChange(app.id, "x", parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-8 text-gray-400">{off.x}px</span>
                    <Input type="number" min={-200} max={500} value={off.x}
                      onChange={(e) => { const v = parseInt(e.target.value) || 0; onOffsetChange(app.id, "x", v); }}
                      className="w-14 text-center text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-14">Y 偏移</span>
                    <input type="range" min={0} max={500} value={off.y}
                      onChange={(e) => onOffsetChange(app.id, "y", parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-8 text-gray-400">{off.y}px</span>
                    <Input type="number" min={0} max={500} value={off.y}
                      onChange={(e) => { const v = parseInt(e.target.value) || 0; onOffsetChange(app.id, "y", v); }}
                      className="w-14 text-center text-xs"
                    />
                  </div>
                  <button
                    onClick={() => onImportIcon(app.id)}
                    className="text-xs text-gray-400 hover:text-blue-500"
                  >
                    手动导入图标...
                  </button>
                </div>
              )}
            </div>
          )
        })}
        <button
          onClick={onCapture}
          disabled={capturing}
          className="w-full py-2 mt-1 text-xs rounded border border-surface-border hover:border-blue-400 hover:text-blue-500 cursor-pointer transition-colors disabled:opacity-50"
        >
          {capturing ? "点击目标窗口以抓取..." : "+ 抓取窗口添加关联软件"}
        </button>
        {apps.length === 0 && <p className="text-xs text-gray-400 py-2">暂无关联软件</p>}
      </div>
    </section>
  )
}
