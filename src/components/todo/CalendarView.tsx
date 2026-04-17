import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TodoWithDetails } from "../../types";

interface CalendarViewProps {
  todos: TodoWithDetails[];
  onDateSelect: (date: string | null) => void;
  selectedDate: string | null;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  // Convert Sunday=0 to Monday-based: Mon=0, Tue=1, ..., Sun=6
  return day === 0 ? 6 : day - 1;
}

export function CalendarView({ todos, onDateSelect, selectedDate }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const { todosByDate, undatedTodos } = useMemo(() => {
    const map = new Map<string, TodoWithDetails[]>();
    const undated: TodoWithDetails[] = [];
    for (const todo of todos) {
      if (!todo.due_date) { undated.push(todo); continue; }
      const key = todo.due_date.slice(0, 10);
      const arr = map.get(key) || [];
      arr.push(todo);
      map.set(key, arr);
    }
    return { todosByDate: map, undatedTodos: undated };
  }, [todos]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const day = i - firstDay + 1;
    cells.push(day >= 1 && day <= daysInMonth ? day : null);
  }

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const monthLabel = `${year}/${String(month + 1).padStart(2, "0")}`;

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-3 py-2">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-medium text-gray-700">{monthLabel}</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 text-gray-500">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 px-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-[10px] text-gray-400 py-1 font-medium">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-100 mx-2 rounded overflow-hidden">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={i} className="min-h-[72px] bg-gray-50" />;
          }

          const dateKey = toDateKey(new Date(year, month, day));
          const dayTodos = todosByDate.get(dateKey) || [];
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;

          return (
            <div
              key={i}
              onClick={() => onDateSelect(isSelected ? null : dateKey)}
              className={`min-h-[72px] p-1 cursor-pointer transition-colors ${
                isSelected
                  ? "bg-blue-50 ring-1 ring-inset ring-blue-400"
                  : "bg-white hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-center mb-0.5">
                <span
                  className={`text-xs leading-none ${
                    isToday
                      ? "bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-medium"
                      : "text-gray-600"
                  }`}
                >
                  {day}
                </span>
              </div>
              <div className="space-y-0.5 overflow-hidden">
                {dayTodos.slice(0, 2).map((todo) => (
                  <div
                    key={todo.id}
                    className={`text-[9px] truncate px-1 py-0.5 rounded leading-tight ${
                      todo.status === "completed"
                        ? "bg-gray-100 text-gray-400 line-through"
                        : priorityColors[todo.priority] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {todo.title}
                  </div>
                ))}
                {dayTodos.length > 2 && (
                  <div className="text-[9px] text-gray-400 px-1">+{dayTodos.length - 2}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Undated todos */}
      {undatedTodos.length > 0 && !selectedDate && (
        <div className="mx-2 mt-2 border-t border-gray-200 pt-2">
          <div className="text-[10px] text-gray-400 font-medium px-1 mb-1">未设日期</div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {undatedTodos.slice(0, 5).map((todo) => (
              <div
                key={todo.id}
                className={`text-[10px] truncate px-1.5 py-0.5 rounded ${
                  todo.status === "completed"
                    ? "bg-gray-100 text-gray-400 line-through"
                    : priorityColors[todo.priority] || "bg-gray-50 text-gray-600"
                }`}
              >
                {todo.title}
              </div>
            ))}
            {undatedTodos.length > 5 && (
              <div className="text-[10px] text-gray-400 px-1.5">+{undatedTodos.length - 5} 项</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
