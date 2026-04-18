import ReactDOM from "react-dom/client";
import { Widget } from "./components/widget/Widget";
import "./index.css";

// Widget windows get app_id and app_name from URL params
const params = new URLSearchParams(window.location.search);
const appId = parseInt(params.get("app_id") || "0", 10);
const appName = params.get("app_name") || "Unknown";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <Widget appId={appId} appName={appName} />
);
