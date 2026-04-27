import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import * as api from "../../lib/invoke";
import { notify } from "../../lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { ReminderQueueItem } from "../../types";

const SNOOZE_PRESETS = [
  { label: "10分钟", minutes: 10 },
  { label: "30分钟", minutes: 30 },
  { label: "1小时", minutes: 60 },
  { label: "明天", minutes: 1440 },
];

const PRIORITY_LABELS: Record<string, { label: string; className: string }> = {
  high: { label: "高", className: "text-red-500" },
  medium: { label: "中", className: "text-yellow-500" },
  low: { label: "低", className: "text-green-500" },
};

export function ReminderPopup() {
  const [queue, setQueue] = useState<ReminderQueueItem[]>([]);
  const [showSnooze, setShowSnooze] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const currentItem = queue[0] ?? null;

  // Listen for backend events
  useEffect(() => {
    const unlisten = listen<ReminderQueueItem>("show-reminder-popup", (event) => {
      setQueue((prev) => [...prev, event.payload]);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const removeFromQueue = useCallback(() => {
    setQueue((prev) => prev.slice(1));
    setShowSnooze(false);
    setCustomMinutes("");
  }, []);

  const handleComplete = useCallback(async () => {
    if (!currentItem) return;
    setActionLoading(true);
    try {
      await api.completeTodo(currentItem.todo_id, "completed");
      await api.dismissReminder(currentItem.id);
      notify.success("已完成");
      removeFromQueue();
    } catch (e) {
      notify.error(`操作失败: ${e}`);
    } finally {
      setActionLoading(false);
    }
  }, [currentItem, removeFromQueue]);

  const handleAbandon = useCallback(async () => {
    if (!currentItem) return;
    setActionLoading(true);
    try {
      await api.completeTodo(currentItem.todo_id, "abandoned");
      await api.dismissReminder(currentItem.id);
      removeFromQueue();
    } catch (e) {
      notify.error(`操作失败: ${e}`);
    } finally {
      setActionLoading(false);
    }
  }, [currentItem, removeFromQueue]);

  const handleDismiss = useCallback(async () => {
    if (!currentItem) return;
    setActionLoading(true);
    try {
      await api.dismissReminder(currentItem.id);
      removeFromQueue();
    } catch (e) {
      notify.error(`操作失败: ${e}`);
    } finally {
      setActionLoading(false);
    }
  }, [currentItem, removeFromQueue]);

  const handleSnooze = useCallback(async (minutes: number) => {
    if (!currentItem) return;
    setActionLoading(true);
    try {
      await api.snoozeReminder({ queue_id: currentItem.id, snooze_minutes: minutes });
      removeFromQueue();
    } catch (e) {
      notify.error(`延后失败: ${e}`);
    } finally {
      setActionLoading(false);
    }
  }, [currentItem, removeFromQueue]);

  const handleCustomSnooze = useCallback(() => {
    const mins = parseInt(customMinutes);
    if (isNaN(mins) || mins <= 0) {
      notify.error("请输入有效的分钟数");
      return;
    }
    handleSnooze(mins);
  }, [customMinutes, handleSnooze]);

  if (!currentItem) return null;

  const priority = currentItem.todo_priority
    ? PRIORITY_LABELS[currentItem.todo_priority] ?? null
    : null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-popover border rounded-lg shadow-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate">
              {currentItem.todo_title ?? "待办提醒"}
            </h3>
            {queue.length > 1 && (
              <span className="text-xs text-muted-foreground bg-accent rounded-full px-1.5 py-0.5 flex-shrink-0">
                {queue.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {priority && (
              <span className={`text-xs ${priority.className}`}>
                优先级: {priority.label}
              </span>
            )}
            {currentItem.todo_due_date && (
              <span className="text-xs text-muted-foreground">
                截止: {currentItem.todo_due_date.slice(0, 10)}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleDismiss}
          disabled={actionLoading}
          className="text-muted-foreground flex-shrink-0"
        >
          x
        </Button>
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="xs"
          onClick={handleComplete}
          disabled={actionLoading}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
        >
          完成
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={handleAbandon}
          disabled={actionLoading}
          className="flex-1"
        >
          放弃
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() => setShowSnooze((v) => !v)}
          disabled={actionLoading}
          className="flex-1"
        >
          延后
        </Button>
      </div>

      {/* Snooze options */}
      {showSnooze && (
        <div className="space-y-2">
          <div className="flex gap-1 flex-wrap">
            {SNOOZE_PRESETS.map((p) => (
              <Button
                key={p.minutes}
                variant="ghost"
                size="xs"
                onClick={() => handleSnooze(p.minutes)}
                disabled={actionLoading}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-1">
            <Input
              type="number"
              min={1}
              placeholder="自定义(分钟)"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
              className="flex-1 h-6 text-xs"
            />
            <Button
              size="xs"
              onClick={handleCustomSnooze}
              disabled={actionLoading || !customMinutes}
            >
              确定
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
