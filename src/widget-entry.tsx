import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import { Widget } from "./components/widget/Widget";
import { ThemeProvider } from "./hooks/useTheme";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";

interface SceneInfo {
  id: number;
  name: string;
  icon: string | null;
  color: string;
}

const params = new URLSearchParams(window.location.search);
const rawAppId = params.get("app_id") || "0";
const appId = parseInt(rawAppId, 10);
if (isNaN(appId) || appId < 0) {
  console.error("Invalid app_id:", rawAppId);
}
const appName = params.get("app_name") || "Unknown";

const scenesRaw = params.get("scenes");
let scenes: SceneInfo[] = [];
try {
  if (scenesRaw) {
    const parsed = JSON.parse(scenesRaw);
    if (Array.isArray(parsed)) {
      scenes = parsed;
    }
  }
} catch {
  console.warn("Invalid scenes parameter, falling back to scene_names");
  const sceneNames = (params.get("scene_names") || "").split(",").filter(Boolean);
  scenes = sceneNames.map((name: string, i: number) => ({
    id: -(i + 1),
    name,
    icon: null,
    color: "#6B7280",
  }));
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ThemeProvider>
      <Widget appId={appId} appName={appName} scenes={scenes} />
      <Toaster position="bottom-center" richColors closeButton />
    </ThemeProvider>
  </ErrorBoundary>
);
