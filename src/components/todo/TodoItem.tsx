import { useState, useRef, useEffect } from "react";
import type { Todo, TodoWithDetails } from "../../types";
import * as api from "../../lib/invoke";
import { BindingEditor } from "../binding/BindingEditor";
import { TodoDetailEditor } from "./TodoDetailEditor";

interface TodoItemProps {
  todo: TodoWithDetails | Todo;
  editing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onToggle: (id: number, status: "pending" | "completed") => void;
  onDelete: (id: number) => void;
  onAddSubTask: (parentId: number, title: string) => void;
  onRefresh?: () => void;
}

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "高", color: "text-red-600", bg: "bg-red-50" },
  medium: { label: "中", color: "text-yellow-600", bg: "bg-yellow-50" },
  low: { label: "低", color: "text-green-600", bg: "bg-green-50" },
};

function formatRelativeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "今天";
  if (diff === 1) return "明天";
  if (diff === -1) return "昨天";
  if (diff > 0 && diff <= 7) return `${diff}天后`;
  if (diff < 0 && diff >= -7) return `${-diff}天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatTime(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function TodoItem({ todo, editing, onStartEdit, onEndEdit, onToggle, onDelete, onAddSubTask, onRefresh }: TodoItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showSubInput, setShowSubInput] = useState(false);
  const [showBinding, setShowBinding] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [editDesc, setEditDesc] = useState(todo.description || "");
  const [editPriority, setEditPriority] = useState(todo.priority);
  const [subTitle, setSubTitle] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const isCompleted = todo.status === "completed";

  // Close menu on outside click
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
    if (titleChanged || descChanged || prioChanged) {
      await api.updateTodo({
        id: todo.id,
        title: editTitle.trim(),
        description: editDesc.trim() || null,
        priority: editPriority,
      });
      onRefresh?.();
    }
    onEndEdit();
  };

  const handleStartEdit = () => {
    setShowMenu(false);
    setEditTitle(todo.title);
    setEditDesc(todo.description || "");
    setEditPriority(todo.priority);
    onStartEdit();
  };

  // Save and exit edit on click outside edit area
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
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") onEndEdit(); }}
          placeholder="标题"
          autoFocus
          className="w-full text-sm font-medium outline-none bg-transparent mb-1"
        />
        <input
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") onEndEdit(); }}
          placeholder="描述（可选）"
          className="w-full text-xs text-gray-500 outline-none bg-transparent mb-2"
        />
        <div className="flex items-center gap-1">
          {(["high", "medium", "low"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setEditPriority(p)}
              className={`px-2 py-0.5 rounded text-xs ${editPriority === p ? priorityConfig[p].bg + " " + priorityConfig[p].color + " font-medium" : "text-gray-400 hover:bg-gray-100"}`}
            >
              {priorityConfig[p].label}
            </button>
          ))}
          <span className="text-[10px] text-gray-400 ml-auto">点击外部自动保存</span>
        </div>
      </div>
    );
  }

  const dueLabel = formatRelativeDate(todo.due_date);
  const isOverdue = todo.due_date && new Date(todo.due_date) < new Date() && !isCompleted;
  const createdTime = formatTime(todo.created_at);

  return (
    <>
      <div className="group flex items-start gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors relative">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(todo.id, todo.status as "pending" | "completed")}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            isCompleted
              ? "bg-green-500 border-green-500 text-white"
              : "border-gray-300 hover:border-blue-400"
          }`}
        >
          {isCompleted && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0" onDoubleClick={handleStartEdit}>
          <div className="flex items-center gap-2">
            <span className={`text-sm ${isCompleted ? "line-through text-gray-400" : "text-gray-800"} cursor-text`}>
              {todo.title}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityConfig[todo.priority]?.color || ""} ${priorityConfig[todo.priority]?.bg || ""}`}>
              {priorityConfig[todo.priority]?.label || ""}
            </span>
            {dueLabel && (
              <span className={`text-[10px] ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                {isOverdue && "⚠ "}{dueLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {todo.description && (
              <span className="text-xs text-gray-400 truncate">{todo.description}</span>
            )}
            {createdTime && (
              <span className="text-[10px] text-gray-300 flex-shrink-0">{createdTime}</span>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => { setShowSubInput(!showSubInput); setSubTitle(""); }}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="添加子任务"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button onClick={handleStartEdit} className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  编辑
                </button>
                <button onClick={() => { setShowMenu(false); setShowDetail(true); }} className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                  分组/标签
                </button>
                <button onClick={() => { setShowMenu(false); setShowBinding(true); }} className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                  关联软件
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => { setShowMenu(false); onDelete(todo.id); }} className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2">
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
            onClose={() => setShowDetail(false)}
            onRefresh={() => { onRefresh?.(); }}
          />
        )}
      </div>

      {/* Inline sub-task input */}
      {showSubInput && (
        <div className="flex items-center gap-2 pl-10 pr-3 py-1.5 bg-gray-50/50 border-b border-gray-100">
          <input
            value={subTitle}
            onChange={(e) => setSubTitle(e.target.value)}
            onKeyDown={handleAddSub}
            placeholder="子任务名称..."
            autoFocus
            className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded shadow-sm outline-none focus:border-blue-300"
          />
          <button onClick={() => { setSubTitle(""); setShowSubInput(false); }} className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap">取消</button>
        </div>
      )}
    </>
  );
}
