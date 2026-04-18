import { useState } from "react";
import { useScenes } from "../../hooks/useScenes";
import { SectionHeader } from "./SectionHeader";

interface SceneListProps {
  selectedSceneId: number | null;
  onSelectScene: (sceneId: number | null) => void;
  onEditScene: (sceneId: number) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function SceneList({ selectedSceneId, onSelectScene, onEditScene, collapsed, onToggleCollapse }: SceneListProps) {
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
    <div>
      <SectionHeader title="场景" count={scenes.length} collapsed={collapsed} onToggle={onToggleCollapse} onAdd={() => setShowInput(true)} />
      {!collapsed && (
        <div className="px-2 pb-1">
          {showInput && (
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              onBlur={() => { if (!newName.trim()) setShowInput(false); }}
              placeholder="场景名称..."
              autoFocus
              className="w-full px-2 py-1 text-xs border border-gray-200 rounded mb-1"
            />
          )}
          <div className="flex flex-wrap gap-1">
            {scenes.map((scene) => (
              <button
                key={scene.id}
                onClick={() => onSelectScene(scene.id)}
                onContextMenu={(e) => { e.preventDefault(); onEditScene(scene.id); }}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full transition-colors ${
                  selectedSceneId === scene.id
                    ? "bg-blue-100 text-blue-700 ring-1 ring-blue-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <span>{scene.icon || "📁"}</span>
                <span>{scene.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
