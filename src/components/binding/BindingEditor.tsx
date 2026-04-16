import { useState } from "react";
import { useApps } from "../../hooks/useApps";
import * as api from "../../lib/invoke";

interface BindingEditorProps {
  todoId: number;
  boundAppIds: number[];
  onClose: () => void;
  onRefresh: () => void;
}

export function BindingEditor({ todoId, boundAppIds, onClose, onRefresh }: BindingEditorProps) {
  const { apps, create } = useApps();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newProcess, setNewProcess] = useState("");

  const handleToggle = async (appId: number) => {
    if (boundAppIds.includes(appId)) {
      await api.unbindTodoFromApp(todoId, appId);
    } else {
      await api.bindTodoToApp(todoId, appId);
    }
    onRefresh();
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newProcess.trim()) return;
    await create({
      name: newName.trim(),
      process_names: [newProcess.trim()],
    });
    setNewName("");
    setNewProcess("");
    setShowCreate(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-80 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">关联软件</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
        </div>

        <div className="space-y-1 max-h-60 overflow-y-auto">
          {apps.map((app) => (
            <label
              key={app.id}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
            >
              <input
                type="checkbox"
                checked={boundAppIds.includes(app.id)}
                onChange={() => handleToggle(app.id)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{app.display_name || app.name}</span>
            </label>
          ))}
        </div>

        {showCreate ? (
          <div className="mt-3 space-y-2 border-t pt-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="软件名称 (如: Word)"
              className="w-full px-2 py-1 text-sm border rounded"
            />
            <input
              value={newProcess}
              onChange={(e) => setNewProcess(e.target.value)}
              placeholder="进程名 (如: WINWORD.EXE)"
              className="w-full px-2 py-1 text-sm border rounded"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                添加
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 w-full py-1 text-sm text-blue-500 hover:text-blue-600 border-t pt-3"
          >
            + 添加新软件
          </button>
        )}
      </div>
    </div>
  );
}
