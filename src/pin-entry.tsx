import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import "./index.css";

const params = new URLSearchParams(window.location.search);
const appId = parseInt(params.get("app_id") || "0", 10);

function handleDisable() {
  invoke("disable_widget_passthrough", { appId });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <div
    onClick={handleDisable}
    style={{
      width: 22,
      height: 22,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      borderRadius: 4,
      fontSize: 13,
      background: "rgba(59, 130, 246, 0.15)",
      border: "1px solid rgba(59, 130, 246, 0.3)",
      userSelect: "none",
    }}
    title="关闭穿透"
  >
    📌
  </div>
);
