import ReactDOM from "react-dom/client";
import { Widget } from "./components/widget/Widget";
import "./index.css";

// Widget windows get scene_id and scene_name from URL params
const params = new URLSearchParams(window.location.search);
const sceneId = parseInt(params.get("scene_id") || "0", 10);
const sceneName = params.get("scene_name") || "Unknown";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <Widget sceneId={sceneId} sceneName={sceneName} />
);
