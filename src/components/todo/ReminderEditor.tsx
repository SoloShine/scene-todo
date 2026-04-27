import { useState, useCallback } from "react";
import * as api from "../../lib/invoke";
import { notify } from "../../lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import type { Reminder } from "../../types";

type ReminderType = "relative" | "absolute";

const OFFSET_PRESETS = [
  { label: "15分钟", value: 15 },
  { label: "30分钟", value: 30 },
  { label: "1小时", value: 60 },
  { label: "1天", value: 1440 },
];

interface ReminderEditorProps {
  todoId: number;
  dueDate: string | null;
  reminders: Reminder[];
  onRefresh: () => void;
}

export function ReminderEditor({ todoId, dueDate, reminders, onRefresh }: ReminderEditorProps) {
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<ReminderType>("relative");
  const [offsetMinutes, setOffsetMinutes] = useState<number>(30);
  const [customOffset, setCustomOffset] = useState("");
  const [absoluteAt, setAbsoluteAt] = useState("");
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifySystem, setNotifySystem] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setFormType("relative");
    setOffsetMinutes(30);
    setCustomOffset("");
    setAbsoluteAt("");
    setNotifyInApp(true);
    setNotifySystem(false);
    setShowForm(false);
  }, []);

  const handleCreate = useCallback(async () => {
    if (formType === "relative" && !dueDate) {
      notify.error("相对提醒需要设定截止日期");
      return;
    }
    if (formType === "absolute" && !absoluteAt) {
      notify.error("请选择固定时间");
      return;
    }

    setSaving(true);
    try {
      const input = {
        todo_id: todoId,
        type: formType as "relative" | "absolute",
        offset_minutes: formType === "relative" ? (customOffset ? parseInt(customOffset) : offsetMinutes) : null,
        absolute_at: formType === "absolute" ? absoluteAt : null,
        notify_in_app: notifyInApp,
        notify_system: notifySystem,
      };
      await api.createReminder(input);
      notify.success("提醒已添加");
      resetForm();
      onRefresh();
    } catch (e) {
      notify.error(`添加提醒失败: ${e}`);
    } finally {
      setSaving(false);
    }
  }, [formType, dueDate, absoluteAt, todoId, offsetMinutes, customOffset, notifyInApp, notifySystem, resetForm, onRefresh]);

  const handleToggleEnabled = useCallback(async (reminder: Reminder) => {
    try {
      await api.updateReminder({ id: reminder.id, enabled: !reminder.enabled });
      onRefresh();
    } catch (e) {
      notify.error(`更新提醒失败: ${e}`);
    }
  }, [onRefresh]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await api.deleteReminder(id);
      notify.success("提醒已删除");
      onRefresh();
    } catch (e) {
      notify.error(`删除提醒失败: ${e}`);
    }
  }, [onRefresh]);

  const formatReminderLabel = (r: Reminder): string => {
    if (r.label) return r.label;
    if (r.type === "relative" && r.offset_minutes != null) {
      const mins = r.offset_minutes;
      if (mins < 60) return `${mins}分钟前`;
      if (mins < 1440) return `${Math.floor(mins / 60)}小时${mins % 60 ? ` ${mins % 60}分钟` : ""}前`;
      return `${Math.floor(mins / 1440)}天前`;
    }
    if (r.type === "absolute" && r.absolute_at) {
      return r.absolute_at.replace("T", " ").slice(0, 16);
    }
    return "未知提醒";
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground">提醒</h4>

      {/* Existing reminders list */}
      {reminders.length > 0 && (
        <div className="space-y-1">
          {reminders.map((r) => (
            <div key={r.id} className="flex items-center gap-2 px-2 py-1 hover:bg-accent rounded">
              <Checkbox
                checked={r.enabled}
                onCheckedChange={() => handleToggleEnabled(r)}
              />
              <span className={`text-xs flex-1 ${r.enabled ? "" : "text-muted-foreground line-through"}`}>
                {formatReminderLabel(r)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {r.type === "relative" ? "相对" : "固定"}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleDelete(r.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                x
              </Button>
            </div>
          ))}
        </div>
      )}

      {reminders.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground px-2">暂无提醒</p>
      )}

      {/* Add button / inline form */}
      {!showForm ? (
        <Button variant="ghost" size="xs" onClick={() => setShowForm(true)} className="w-full">
          + 添加提醒
        </Button>
      ) : (
        <div className="space-y-2 border rounded-lg p-2">
          {/* Type toggle */}
          <div className="flex gap-1">
            <button
              onClick={() => setFormType("relative")}
              className={`text-xs px-2 py-1 rounded ${
                formType === "relative"
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              相对截止时间
            </button>
            <button
              onClick={() => setFormType("absolute")}
              className={`text-xs px-2 py-1 rounded ${
                formType === "absolute"
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent text-muted-foreground"
              }`}
            >
              固定时间
            </button>
          </div>

          {formType === "relative" && (
            <>
              {!dueDate && (
                <p className="text-xs text-destructive">需要先设定截止日期</p>
              )}
              <div className="flex gap-1 flex-wrap">
                {OFFSET_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => { setOffsetMinutes(p.value); setCustomOffset(""); }}
                    className={`text-xs px-2 py-1 rounded ${
                      offsetMinutes === p.value && !customOffset
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent text-muted-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">自定义:</span>
                <Input
                  type="number"
                  min={1}
                  placeholder="分钟"
                  value={customOffset}
                  onChange={(e) => setCustomOffset(e.target.value)}
                  className="w-20 h-6 text-xs"
                />
              </div>
            </>
          )}

          {formType === "absolute" && (
            <Input
              type="datetime-local"
              value={absoluteAt}
              onChange={(e) => setAbsoluteAt(e.target.value)}
              className="w-full h-6 text-xs"
            />
          )}

          <Separator />

          {/* Notification method */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1 cursor-pointer">
              <Checkbox
                checked={notifyInApp}
                onCheckedChange={() => setNotifyInApp((v) => !v)}
              />
              <span className="text-xs">应用内</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <Checkbox
                checked={notifySystem}
                onCheckedChange={() => setNotifySystem((v) => !v)}
              />
              <span className="text-xs">系统通知</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-1">
            <Button size="xs" onClick={handleCreate} disabled={saving} className="flex-1">
              {saving ? "保存中..." : "添加"}
            </Button>
            <Button variant="outline" size="xs" onClick={resetForm} className="flex-1">
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
