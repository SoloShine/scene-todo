import os from "os";
import path from "path";
import { spawn, spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isWindows = os.platform() === "win32";

// Path to the built debug binary
const application = path.resolve(
  __dirname,
  "..",
  "src-tauri",
  "target",
  "debug",
  isWindows ? "scene-todo.exe" : "scene-todo"
);

let tauriDriver: ReturnType<typeof spawn> | null = null;
let exit = false;

function closeTauriDriver() {
  exit = true;
  if (tauriDriver) {
    tauriDriver.kill();
    tauriDriver = null;
  }
}

function onShutdown(fn: () => void) {
  const cleanup = () => {
    try { fn(); } finally { process.exit(); }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  if (isWindows) process.on("SIGBREAK", cleanup);
  else {
    process.on("SIGHUP", cleanup);
  }
}

onShutdown(() => closeTauriDriver());

export const config = {
  host: "127.0.0.1",
  port: 4444,
  specs: ["./specs/**/*.spec.ts"],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      "tauri:options": { application },
    },
  ],
  reporters: ["spec"],
  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },

  // Build the Tauri debug binary before tests
  onPrepare() {
    console.log("Building Tauri debug binary...");
    const result = spawnSync(
      "npm",
      ["run", "tauri", "build", "--", "--debug", "--no-bundle"],
      {
        cwd: path.resolve(__dirname, ".."),
        stdio: "inherit",
        shell: true,
      }
    );
    if (result.status !== 0) {
      throw new Error("Tauri build failed");
    }
    console.log("Build complete.");
  },

  // Start tauri-driver before the test session
  beforeSession() {
    const driverPath = path.resolve(
      os.homedir(),
      ".cargo",
      "bin",
      isWindows ? "tauri-driver.exe" : "tauri-driver"
    );
    console.log("Starting tauri-driver:", driverPath);
    tauriDriver = spawn(driverPath, [], {
      stdio: [null, process.stdout, process.stderr],
    });
    tauriDriver.on("error", (error: Error) => {
      console.error("tauri-driver error:", error);
      process.exit(1);
    });
    tauriDriver.on("exit", (code: number | null) => {
      if (!exit) {
        console.error("tauri-driver exited with code:", code);
        process.exit(1);
      }
    });
  },

  // Cleanup tauri-driver after the session
  afterSession() {
    closeTauriDriver();
  },
};
