import { useState, useEffect, useCallback } from "react";
import * as api from "../../lib/invoke";
import { notify } from "../../lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import type { RecurrenceRule, RruleDescribeResult, SimplifiedRecurrenceInput } from "../../types";

type EditorMode = "off" | "simplified" | "rrule";
type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
type EndType = "never" | "date" | "count";

const FREQ_LABELS: Record<Frequency, string> = {
  DAILY: "每天",
  WEEKLY: "每周",
  MONTHLY: "每月",
  YEARLY: "每年",
};

const WEEKDAY_OPTIONS = [
  { value: "MO", label: "一" },
  { value: "TU", label: "二" },
  { value: "WE", label: "三" },
  { value: "TH", label: "四" },
  { value: "FR", label: "五" },
  { value: "SA", label: "六" },
  { value: "SU", label: "日" },
];

interface RecurrenceEditorProps {
  todoId: number;
  dueDate: string | null;
  rule: RecurrenceRule | null;
  onRefresh: () => void;
}

export function RecurrenceEditor({ todoId, dueDate, rule, onRefresh }: RecurrenceEditorProps) {
  const [mode, setMode] = useState<EditorMode>("off");
  const [freq, setFreq] = useState<Frequency>("DAILY");
  const [interval, setIntervalVal] = useState(1);
  const [byDay, setByDay] = useState<string[]>([]);
  const [endType, setEndType] = useState<EndType>("never");
  const [endDate, setEndDate] = useState("");
  const [maxCount, setMaxCount] = useState(1);

  // RRULE mode
  const [rruleText, setRruleText] = useState("");
  const [rruleResult, setRruleResult] = useState<RruleDescribeResult | null>(null);
  const [rruleValidating, setRruleValidating] = useState(false);

  const dtstart = dueDate ?? new Date().toISOString().slice(0, 10);

  // Initialize mode based on existing rule
  useEffect(() => {
    if (rule) {
      const r = rule.rrule.toUpperCase();
      if (r.includes("FREQ=WEEKLY") && r.includes("BYDAY=")) {
        setMode("simplified");
        setFreq("WEEKLY");
        const bydayMatch = r.match(/BYDAY=([A-Z,]+)/);
        if (bydayMatch) setByDay(bydayMatch[1].split(","));
      } else if (r.includes("FREQ=DAILY") && !r.includes("BYHOUR") && !r.includes("BYMINUTE") && !r.includes("BYSECOND")) {
        setMode("simplified");
        setFreq("DAILY");
      } else if (r.includes("FREQ=MONTHLY") && !r.includes("BYHOUR")) {
        setMode("simplified");
        setFreq("MONTHLY");
      } else if (r.includes("FREQ=YEARLY") && !r.includes("BYHOUR")) {
        setMode("simplified");
        setFreq("YEARLY");
      } else {
        setMode("rrule");
        setRruleText(rule.rrule);
      }
      // Parse interval
      const intervalMatch = r.match(/INTERVAL=(\d+)/);
      if (intervalMatch) setIntervalVal(parseInt(intervalMatch[1], 10));
      // Parse end conditions
      if (rule.end_date) {
        setEndType("date");
        setEndDate(rule.end_date.slice(0, 10));
      } else if (rule.max_count) {
        setEndType("count");
        setMaxCount(rule.max_count);
      }
    }
  }, [rule]);

  // RRULE validation with debounce
  useEffect(() => {
    if (mode !== "rrule" || !rruleText.trim()) {
      setRruleResult(null);
      return;
    }
    setRruleValidating(true);
    const timer = setTimeout(async () => {
      try {
        const result = await api.describeRrule(rruleText.trim());
        setRruleResult(result);
      } catch {
        setRruleResult({ valid: false, description: null, error: "验证失败", preview_dates: [] });
      } finally {
        setRruleValidating(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [rruleText, mode]);

  const handleSaveSimplified = useCallback(async () => {
    const input: SimplifiedRecurrenceInput = {
      freq,
      interval: interval > 1 ? interval : null,
      by_day: freq === "WEEKLY" && byDay.length > 0 ? byDay : null,
      end_date: endType === "date" && endDate ? endDate : null,
      max_count: endType === "count" ? maxCount : null,
    };
    try {
      const rrule = await api.simplifiedToRrule(input);
      await api.setTodoRecurrence(todoId, { rrule, dtstart });
      notify.success("重复规则已保存");
      onRefresh();
    } catch (e) {
      notify.error(`保存失败: ${e}`);
    }
  }, [freq, interval, byDay, endType, endDate, maxCount, todoId, dtstart, onRefresh]);

  const handleSaveRrule = useCallback(async () => {
    if (!rruleResult?.valid) {
      notify.error("RRULE 格式无效");
      return;
    }
    try {
      await api.setTodoRecurrence(todoId, { rrule: rruleText.trim(), dtstart });
      notify.success("重复规则已保存");
      onRefresh();
    } catch (e) {
      notify.error(`保存失败: ${e}`);
    }
  }, [rruleResult, rruleText, todoId, dtstart, onRefresh]);

  const handleRemove = useCallback(async () => {
    try {
      await api.setTodoRecurrence(todoId, null);
      setMode("off");
      notify.success("已移除重复规则");
      onRefresh();
    } catch (e) {
      notify.error(`移除失败: ${e}`);
    }
  }, [todoId, onRefresh]);

  const toggleWeekday = (day: string) => {
    setByDay((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="space-y-3">
      {/* Mode selector */}
      <div className="flex gap-1">
        {(["off", "simplified", "rrule"] as EditorMode[]).map((m) => (
          <button
            key={m}
            data-testid={`recurrence-mode-${m}`}
            onClick={() => setMode(m)}
            className={`text-xs px-2 py-1 rounded ${
              mode === m
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent text-muted-foreground"
            }`}
          >
            {m === "off" ? "关闭" : m === "simplified" ? "简易" : "RRULE"}
          </button>
        ))}
        {rule && mode === "off" && (
          <Button variant="ghost" size="xs" data-testid="recurrence-remove" onClick={handleRemove} className="ml-auto text-destructive">
            移除重复
          </Button>
        )}
      </div>

      {mode === "simplified" && (
        <div className="space-y-2">
          {/* Frequency */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">频率</label>
            <div className="flex gap-1">
              {(Object.keys(FREQ_LABELS) as Frequency[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFreq(f)}
                  className={`text-xs px-2 py-1 rounded ${
                    freq === f
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent text-muted-foreground"
                  }`}
                >
                  {FREQ_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Interval */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap">每</label>
            <Input
              type="number"
              min={1}
              value={interval}
              onChange={(e) => setIntervalVal(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 h-6 text-xs"
            />
            <span className="text-xs text-muted-foreground">
              {freq === "DAILY" ? "天" : freq === "WEEKLY" ? "周" : freq === "MONTHLY" ? "月" : "年"}
            </span>
          </div>

          {/* Weekday checkboxes (weekly only) */}
          {freq === "WEEKLY" && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">星期</label>
              <div className="flex gap-1">
                {WEEKDAY_OPTIONS.map((wd) => (
                  <label
                    key={wd.value}
                    className="flex items-center gap-1 cursor-pointer"
                  >
                    <Checkbox
                      checked={byDay.includes(wd.value)}
                      onCheckedChange={() => toggleWeekday(wd.value)}
                    />
                    <span className="text-xs">{wd.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* End condition */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">结束条件</label>
            <div className="flex gap-1 mb-1">
              {(["never", "date", "count"] as EndType[]).map((et) => (
                <button
                  key={et}
                  onClick={() => setEndType(et)}
                  className={`text-xs px-2 py-1 rounded ${
                    endType === et
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent text-muted-foreground"
                  }`}
                >
                  {et === "never" ? "永不" : et === "date" ? "到日期" : "次数"}
                </button>
              ))}
            </div>
            {endType === "date" && (
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-6 text-xs"
              />
            )}
            {endType === "count" && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={maxCount}
                  onChange={(e) => setMaxCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 h-6 text-xs"
                />
                <span className="text-xs text-muted-foreground">次</span>
              </div>
            )}
          </div>

          <Button size="xs" data-testid="recurrence-save" onClick={handleSaveSimplified} className="w-full">
            保存
          </Button>
        </div>
      )}

      {mode === "rrule" && (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">RRULE 表达式</label>
            <Input
              data-testid="recurrence-rrule-input"
              value={rruleText}
              onChange={(e) => setRruleText(e.target.value)}
              placeholder="FREQ=DAILY;INTERVAL=2"
              className="w-full h-6 text-xs font-mono"
            />
          </div>

          {rruleValidating && (
            <p className="text-xs text-muted-foreground">验证中...</p>
          )}

          {rruleResult && !rruleValidating && (
            <>
              {rruleResult.valid && rruleResult.description && (
                <p className="text-xs text-green-600">{rruleResult.description}</p>
              )}
              {rruleResult.error && (
                <p className="text-xs text-destructive">{rruleResult.error}</p>
              )}
              {rruleResult.valid && rruleResult.preview_dates.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">预览日期:</p>
                  <div className="space-y-0.5">
                    {rruleResult.preview_dates.slice(0, 5).map((d, i) => (
                      <p key={i} className="text-xs">{d}</p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <Button
            size="xs"
            data-testid="recurrence-rrule-save"
            onClick={handleSaveRrule}
            disabled={!rruleResult?.valid}
            className="w-full"
          >
            保存
          </Button>
        </div>
      )}
    </div>
  );
}
