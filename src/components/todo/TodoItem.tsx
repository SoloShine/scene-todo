import { useState, useRef, useEffect } from "react";
import type { Todo, TodoWithDetails } from "../../types";
import * as api from "../../lib/invoke";
import { notify } from "../../lib/toast";
import { BindingEditor } from "../binding/BindingEditor";
import { TodoDetailEditor } from "./TodoDetailEditor";
import { Input } from "@/components/ui/input";

interface TodoItemProps {
  todo: TodoWithDetails | Todo;
  editing: boolean;
  animatingOut?: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onToggle: (id: number, status: "pending" | "completed") => void;
  onDelete: (id: number) => void;
  onAddSubTask: (parentId: number, title: string) => void;
  onRefresh?: () => void;
}

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "高", color: "text-destructive", bg: "bg-destructive/10" },
  medium: { label: "中", color: "text-[oklch(0.650_0.180_85)]", bg: "bg-[oklch(0.960_0.040_85)]" },
  low: { label: "低", color: "text-[oklch(0.600_0.150_160)]", bg: "bg-[oklch(0.960_0.040_160)]" },
};

export function parseDateLocal(dateStr: string): Date | null {
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

export function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function toDatetimeLocalValue(dateStr: string | null): string {
  if (!dateStr) return "";
  // "2026-04-18T23:59:59" → "2026-04-18T23:59", "2026-04-18" → "2026-04-18T23:59"
  if (dateStr.length > 10) return dateStr.slice(0, 16);
  return dateStr + "T23:59";
}

function extractTime(dateStr: string | null): string | null {
  if (!dateStr || dateStr.length < 16) return null;
  const time = dateStr.slice(11, 16);
  return time === "23:59" ? null : time;
}

function formatDueDate(dateStr: string | null, isOverdue: boolean): string | null {
  if (!dateStr) return null;
  const d = parseDateLocal(dateStr);
  if (!d) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const isToday = d.getTime() === today.getTime();
  const timePart = extractTime(dateStr);
  const timeSuffix = timePart ? ` ${timePart}` : "";
  if (!isOverdue && isToday) return "今天" + timeSuffix;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}${timeSuffix}`;
}

function formatTime(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T") + "Z");
  if (isNaN(d.getTime())) return null;
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function TodoItem({ todo, editing, animatingOut = false, onStartEdit, onEndEdit, onToggle, onDelete, onAddSubTask, onRefresh }: TodoItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showSubInput, setShowSubInput] = useState(false);
  const [showBinding, setShowBinding] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [editDesc, setEditDesc] = useState(todo.description || "");
  const [editPriority, setEditPriority] = useState(todo.priority);
  const [editDueDate, setEditDueDate] = useState(toDatetimeLocalValue(todo.due_date));
  const [subTitle, setSubTitle] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const [menuUp, setMenuUp] = useState(false);
  const [mounted, setMounted] = useState(false)
  const isCompleted = todo.status === "completed";
  const isAbandoned = todo.status === "abandoned";

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const handleAddSub = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && subTitle.trim()) {
      onAddSubTask(todo.id, subTitle.trim());
      setSubTitle("");
      setShowSubInput(false);
    }
    if (e.key === "Escape") setShowSubInput(false);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) { onEndEdit(); return; }
    const titleChanged = editTitle.trim() !== todo.title;
    const descChanged = (editDesc.trim() || "") !== (todo.description || "");
    const prioChanged = editPriority !== todo.priority;
    const newDate = editDueDate || "";
    const oldDate = todo.due_date || "";
    const dateChanged = newDate !== oldDate && (newDate !== "" || oldDate !== "");
    if (titleChanged || descChanged || prioChanged || dateChanged) {
      try {
        await api.updateTodo({
          id: todo.id,
          title: editTitle.trim(),
          description: editDesc.trim() || null,
          priority: editPriority,
          due_date: editDueDate || "",
        });
        onRefresh?.();
      } catch {
        notify.error("保存待办失败");
      }
    }
    onEndEdit();
  };

  const handleStartEdit = () => {
    setShowMenu(false);
    setEditTitle(todo.title);
    setEditDesc(todo.description || "");
    setEditPriority(todo.priority);
    setEditDueDate(toDatetimeLocalValue(todo.due_date));
    onStartEdit();
  };

  const saveRef = useRef(handleSaveEdit);
  saveRef.current = handleSaveEdit;

  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (editRef.current && !editRef.current.contains(e.target as Node)) {
        saveRef.current();
      }
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [editing]);

  if (editing) {
    return (
      <div ref={editRef} className="px-3 py-2 bg-blue-50/50 border-l-2 border-blue-400">
        <Input
          data-testid={`todo-edit-title-${todo.id}`}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") onEndEdit(); }}
          placeholder="标题"
          autoFocus
          className="w-full text-sm font-medium border-0 shadow-none bg-transparent mb-1"
        />
        <Input
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onEndEdit(); }}
          placeholder="描述（可选）"
          className="w-full text-xs text-muted-foreground border-0 shadow-none bg-transparent mb-2"
        />
        <div className="flex items-center gap-2 flex-wrap">
          {(["high", "medium", "low"] as const).map((p) => (
            <button
              key={p}
              data-testid={`todo-priority-${p}-${todo.id}`}
              onClick={() => setEditPriority(p)}
              className={`px-2 py-0.5 rounded text-xs ${editPriority === p ? priorityConfig[p].bg + " " + priorityConfig[p].color + " font-medium" : "text-muted-foreground hover:bg-accent"}`}
            >
              {priorityConfig[p].label}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input
              type="datetime-local"
              data-testid={`todo-due-date-${todo.id}`}
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              className="text-xs text-muted-foreground outline-none bg-transparent border-b border-surface-border px-1"
            />
            {editDueDate && (
              <button
                onClick={() => setEditDueDate("")}
                className="text-[10px] text-muted-foreground hover:text-destructive leading-none"
                title="清除截止日期"
              >
                &times;
              </button>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground ml-auto">点击外部自动保存</span>
        </div>
      </div>
    );
  }

  const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const isOverdue = (() => {
    if (!todo.due_date || isCompleted) return false;
    if (todo.due_date.length > 10) {
      const due = new Date(todo.due_date);
      return !isNaN(due.getTime()) && due < new Date();
    }
    const d = parseDateLocal(todo.due_date);
    return d ? d < todayStart : false;
  })();
  const dueLabel = formatDueDate(todo.due_date, isOverdue);
  const createdTime = formatTime(todo.created_at);
  const completedTime = isCompleted ? formatTime(todo.completed_at) : null;

  return (
    <>
      <div className={`group flex items-start gap-2.5 px-3 py-2 hover:bg-accent/50 rounded-lg transition-colors relative ${isOverdue ? "bg-red-50/30" : ""} ${mounted ? "" : "animate-in"} ${animatingOut ? "animate-out" : ""}`}>
        <button
          data-testid={`todo-complete-${todo.id}`}
          onClick={() => onToggle(todo.id, todo.status as "pending" | "completed")}
          className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            isCompleted
              ? "bg-theme border-theme text-white"
              : isOverdue
              ? "border-red-300 hover:border-red-400"
              : "border-theme-border hover:border-theme"
          }`}
        >
          {isCompleted && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
        </button>

        <div className="flex-1 min-w-0" data-testid={`todo-title-${todo.id}`} onDoubleClick={handleStartEdit}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm ${
              isCompleted ? "line-through text-muted-foreground" :
              isAbandoned ? "line-through text-muted-foreground italic" :
              "text-foreground font-medium"
            } cursor-text`}>
              {todo.title}
            </span>
            {isOverdue && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-destructive/10 text-destructive">过期</span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityConfig[todo.priority]?.color || ""} ${priorityConfig[todo.priority]?.bg || ""}`}>
              {priorityConfig[todo.priority]?.label || ""}
            </span>
            {(todo as TodoWithDetails).recurrence_rule && (
              <span className="text-[10px] text-muted-foreground" title="重复待办">🔁</span>
            )}
            {dueLabel && (
              <span className={`text-[10px] ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                {dueLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {todo.description && !isCompleted && (
              <span className="text-xs text-muted-foreground truncate">{todo.description}</span>
            )}
            {completedTime && (
              <span className="text-[10px] text-green-500 flex-shrink-0">完成于 {completedTime}</span>
            )}
            {!isCompleted && createdTime && (
              <span className="text-[10px] text-theme-light/60 flex-shrink-0">{createdTime}</span>
            )}
          </div>
        </div>

        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            data-testid={`todo-add-subtask-${todo.id}`}
            onClick={() => { setShowSubInput(!showSubInput); setSubTitle(""); }}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="添加子任务"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <div className="relative" ref={menuRef}>
            <button
              data-testid={`todo-menu-${todo.id}`}
              onClick={() => {
                if (!showMenu && menuRef.current) {
                  const rect = menuRef.current.getBoundingClientRect();
                  setMenuUp(rect.bottom + 180 > window.innerHeight);
                }
                setShowMenu(!showMenu);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>
            {showMenu && (
              <div className={`absolute right-0 ${menuUp ? "bottom-8" : "top-8"} w-36 bg-card rounded-lg shadow-lg border border-surface-border py-1 z-50`}>
                <button onClick={handleStartEdit} className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  编辑
                </button>
                <button onClick={() => { setShowMenu(false); setShowDetail(true); }} className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                  分组/标签
                </button>
                <button onClick={() => { setShowMenu(false); setShowBinding(true); }} className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-accent flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                  关联场景
                </button>
                <div className="border-t border-surface-divider my-1" />
                <button data-testid={`todo-delete-${todo.id}`} onClick={() => { setShowMenu(false); onDelete(todo.id); }} className="w-full text-left px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  删除
                </button>
              </div>
            )}
          </div>
        </div>

        {showBinding && <BindingEditor todoId={todo.id} onClose={() => setShowBinding(false)} onRefresh={() => { onRefresh?.(); }} />}
        {showDetail && (
          <TodoDetailEditor
            todoId={todo.id}
            currentGroupId={todo.group_id}
            dueDate={todo.due_date}
            recurrenceRule={(todo as TodoWithDetails).recurrence_rule ?? null}
            reminders={(todo as TodoWithDetails).reminders ?? []}
            onClose={() => setShowDetail(false)}
            onRefresh={() => { onRefresh?.(); }}
          />
        )}
      </div>

      {showSubInput && (
        <div className="flex items-center gap-2 pl-10 pr-3 py-1.5 bg-background/50 border-b border-surface-divider">
          <Input
            data-testid={`todo-subtask-input-${todo.id}`}
            value={subTitle}
            onChange={(e) => setSubTitle(e.target.value)}
            onKeyDown={handleAddSub}
            placeholder="子任务名称..."
            autoFocus
            className="flex-1 text-sm"
          />
          <button onClick={() => { setSubTitle(""); setShowSubInput(false); }} className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap">取消</button>
        </div>
      )}
    </>
  );
}
