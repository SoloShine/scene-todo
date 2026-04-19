import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

interface WidgetSettingsProps {
  widgetOpacity: number
  onOpacityChange: (value: number) => void
  widgetSize: "small" | "medium" | "large"
  onSizeChange: (size: "small" | "medium" | "large") => void
  showEmptyWidget: boolean
  onShowEmptyWidgetChange: (show: boolean) => void
}

export function WidgetSettings({
  widgetOpacity,
  onOpacityChange,
  widgetSize,
  onSizeChange,
  showEmptyWidget,
  onShowEmptyWidgetChange,
}: WidgetSettingsProps) {
  return (
    <section className="mb-6">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="w-1 h-4 rounded-full bg-theme" />
        Widget
      </h3>
      <Label className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground">无待办时显示浮窗</span>
        <Checkbox
          checked={showEmptyWidget}
          onCheckedChange={(v) => onShowEmptyWidgetChange(!!v)}
        />
      </Label>
      <label className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground">浮窗不透明度</span>
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={100} value={widgetOpacity}
            onChange={(e) => onOpacityChange(parseInt(e.target.value))}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground w-8">{widgetOpacity}%</span>
        </div>
      </label>
      <Label className="flex items-center justify-between py-2">
        <span className="text-sm text-foreground">默认尺寸</span>
        <Select value={widgetSize} onValueChange={(v) => onSizeChange(v as "small" | "medium" | "large")}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">小</SelectItem>
            <SelectItem value="medium">中</SelectItem>
            <SelectItem value="large">大</SelectItem>
          </SelectContent>
        </Select>
      </Label>
    </section>
  )
}
