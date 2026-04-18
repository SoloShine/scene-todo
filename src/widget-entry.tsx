import ReactDOM from "react-dom/client";
import { Widget } from "./components/widget/Widget";
import "./index.css";

interface SceneInfo {
  id: number;
  name: string;
  icon: string | null;
  color: string;
}

const params = new URLSearchParams(window.location.search);
const appId = parseInt(params.get("app_id") || "0", 10);
const appName = params.get("app_name") || "Unknown";

const scenesRaw = params.get("scenes");
const scenes: SceneInfo[] = scenesRaw
  ? JSON.parse(scenesRaw)
  : (params.get("scene_names") || "")
      .split(",")
      .filter(Boolean)
      .map((name: string, i: number) => ({
        id: -(i + 1),
        name,
        icon: null,
        color: "#6B7280",
      }));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <Widget appId={appId} appName={appName} scenes={scenes} />
);
