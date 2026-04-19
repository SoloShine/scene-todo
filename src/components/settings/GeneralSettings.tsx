import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

interface GeneralSettingsProps {
  autoStart: boolean
  onAutoStart: (enabled: boolean) => void
  closeAction: "prompt" | "hide" | "exit"
  onCloseActionChange: (action: "prompt" | "hide" | "exit") => void
  retentionDays: number
  onRetentionDaysChange: (days: number) => void
  onExport: () => void
  onImport: () => void
}

export function GeneralSettings({
  autoStart,
  onAutoStart,
  closeAction,
  onCloseActionChange,
  retentionDays,
  onRetentionDaysChange,
  onExport,
  onImport,
}: GeneralSettingsProps) {
  return (
    <section className="mb-6">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="w-1 h-4 rounded-full bg-theme" />
        通用
      </h3>
      <Label className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground">开机自启</span>
        <Checkbox data-testid="setting-autostart" checked={autoStart} onCheckedChange={(v) => onAutoStart(!!v)} />
      </Label>
      <Label className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground">关闭按钮行为</span>
        <Select value={closeAction} onValueChange={(v) => onCloseActionChange(v as "prompt" | "hide" | "exit")}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="prompt">每次询问</SelectItem>
            <SelectItem value="hide">隐藏到托盘</SelectItem>
            <SelectItem value="exit">退出程序</SelectItem>
          </SelectContent>
        </Select>
      </Label>
      <Label className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground">数据保留天数</span>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={3650}
            value={retentionDays}
            onChange={(e) => onRetentionDaysChange(Math.max(1, parseInt(e.target.value) || 90))}
            className="w-20 text-right"
          />
          <span className="text-xs text-gray-400">天</span>
        </div>
      </Label>
      <div className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground">数据备份</span>
        <div className="flex items-center gap-2">
          <button data-testid="setting-export" onClick={onExport} className="text-xs text-gray-400 hover:text-blue-500">导出</button>
          <span className="text-gray-300">|</span>
          <button data-testid="setting-import" onClick={onImport} className="text-xs text-gray-400 hover:text-blue-500">导入</button>
        </div>
      </div>
    </section>
  )
}
