import { useState } from "react";
import { useScenes } from "../../hooks/useScenes";
import { SectionHeader } from "./SectionHeader";
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "../ui/skeleton";
import { Layers } from "lucide-react"

interface SceneListProps {
  selectedSceneId: number | null;
  onSelectScene: (sceneId: number | null) => void;
  onEditScene: (sceneId: number) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function SceneList({ selectedSceneId, onSelectScene, onEditScene, collapsed, onToggleCollapse }: SceneListProps) {
  const { scenes, loading, create } = useScenes();
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
      <div className={`section-collapse ${collapsed ? "section-collapsed" : "section-expanded"}`}>
        <div className="px-2 pb-1">
          {showInput && (
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              onBlur={() => { if (!newName.trim()) setShowInput(false); }}
              placeholder="场景名称..."
              autoFocus
              className="w-full text-xs mb-1"
            />
          )}
          {loading ? (
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </div>
          ) : (
            <>
              {scenes.length === 0 && !showInput && (
                <EmptyState
                  icon={<Layers />}
                  title="还没有场景"
                  description="点击上方 + 创建场景来关联应用"
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
                        ? "bg-theme-bg text-theme ring-1 ring-theme-border"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    <span>{scene.icon || "📁"}</span>
                    <span>{scene.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
