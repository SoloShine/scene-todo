import { useState } from "react";
import { Input } from "@/components/ui/input";

interface TodoFormProps {
  onSubmit: (title: string) => void;
  placeholder?: string;
}

export function TodoForm({ onSubmit, placeholder = "添加待办，按回车提交..." }: TodoFormProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && value.trim()) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <div className="flex items-center gap-2 p-3 border-b border-surface-border">
      <span className="text-theme-border text-lg">+</span>
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleSubmit}
        placeholder={placeholder}
        className="flex-1 text-sm bg-transparent border-0 shadow-none"
      />
    </div>
  );
}
