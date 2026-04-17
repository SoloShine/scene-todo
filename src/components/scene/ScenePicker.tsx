import { useScenes } from "../../hooks/useScenes";

interface ScenePickerProps {
  boundSceneIds: number[];
  onToggle: (sceneId: number) => void;
}

export function ScenePicker({ boundSceneIds, onToggle }: ScenePickerProps) {
  const { scenes } = useScenes();

  return (
    <div className="space-y-1 max-h-60 overflow-y-auto">
      {scenes.map((scene) => (
        <label
          key={scene.id}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
        >
          <input
            type="checkbox"
            checked={boundSceneIds.includes(scene.id)}
            onChange={() => onToggle(scene.id)}
            className="rounded border-gray-300"
          />
          <span className="text-base">{scene.icon || "📁"}</span>
          <span className="text-sm">{scene.name}</span>
        </label>
      ))}
    </div>
  );
}
