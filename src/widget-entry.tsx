import ReactDOM from "react-dom/client";
import { Widget } from "./components/widget/Widget";
import "./index.css";

const params = new URLSearchParams(window.location.search);
const appId = parseInt(params.get("app_id") || "0", 10);
const appName = params.get("app_name") || "Unknown";
const sceneNames = (params.get("scene_names") || "").split(",").filter(Boolean);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <Widget appId={appId} appName={appName} sceneNames={sceneNames} />
);
