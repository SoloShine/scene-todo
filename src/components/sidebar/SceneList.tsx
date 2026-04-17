import { useState } from "react";
import { useScenes } from "../../hooks/useScenes";

interface SceneListProps {
  selectedSceneId: number | null;
  onSelectScene: (sceneId: number | null) => void;
  onEditScene: (sceneId: number) => void;
}

export function SceneList({ selectedSceneId, onSelectScene, onEditScene }: SceneListProps) {
  const { scenes, create } = useScenes();
  const [newName, setNewName] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await create({ name: newName.trim() });
    setNewName("");
    setShowInput(false);
  };

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between px-2 py-1">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">场景</h3>
        <button onClick={() => setShowInput(true)} className="text-gray-400 hover:text-gray-600 text-sm">+</button>
      </div>

      {showInput && (
        <div className="px-2 pb-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            onBlur={() => { if (!newName.trim()) setShowInput(false); }}
            placeholder="场景名称..."
            autoFocus
            className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
          />
        </div>
      )}

      {scenes.map((scene) => (
        <div
          key={scene.id}
          className={`group flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer transition-colors ${
            selectedSceneId === scene.id ? "bg-blue-50 text-blue-700" : "hover:bg-gray-100"
          }`}
          onClick={() => onSelectScene(scene.id)}
        >
          <span className="flex-shrink-0 text-base">{scene.icon || "📁"}</span>
          <span className="flex-1 truncate">{scene.name}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onEditScene(scene.id); }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-500 text-xs"
          >
            编辑
          </button>
        </div>
      ))}
    </div>
  );
}
