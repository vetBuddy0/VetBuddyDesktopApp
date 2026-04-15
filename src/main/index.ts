import { app, BrowserWindow, ipcMain, shell, desktopCapturer, globalShortcut, safeStorage } from "electron";
import { flipFuses, FuseVersion, FuseV1Options } from "@electron/fuses";
import { join } from "path";
import { spawn } from "child_process";
import { promises as fs, existsSync } from "fs";
import { tmpdir } from "os";
import { is } from "@electron-toolkit/utils";
import { autoUpdater } from "electron-updater";
import { z } from "zod";

let mainWindow: BrowserWindow | null = null;
let downloadedFilePath: string | null = null;

// ── Config (stored in userData so it survives app updates) ───────────────────
const CONFIG_PATH = join(app.getPath("userData"), "vetbuddy-config.json");
const DEFAULT_SHOW_SHORTCUT = "CommandOrControl+Shift+V"; // default: Cmd+Shift+V

async function readConfig(): Promise<{ showShortcut: string }> {
  try {
    if (existsSync(CONFIG_PATH)) {
      const data = await fs.readFile(CONFIG_PATH, "utf8");
      return JSON.parse(data);
    }
  } catch { /* ignore parse errors */ }
  return { showShortcut: DEFAULT_SHOW_SHORTCUT };
}

async function writeConfig(config: { showShortcut: string }) {
  try {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  } catch (e) {
    console.error("Failed to write config:", e);
  }
}

// ── Show/hide shortcut — re-registerable ─────────────────────────────────────
let currentShowShortcut = DEFAULT_SHOW_SHORTCUT;

function registerShowShortcut(key: string): boolean {
  // Unregister old one first
  if (currentShowShortcut) {
    try { globalShortcut.unregister(currentShowShortcut); } catch { /* ignore */ }
  }
  const ok = globalShortcut.register(key, () => {
    try {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } catch { /* window destroyed between check and call — ignore */ }
  });
  if (ok) {
    currentShowShortcut = key;
  } else {
    // Restore old shortcut on failure
    try { globalShortcut.register(currentShowShortcut, () => { /* noop fallback */ }); } catch { /* ignore */ }
  }
  return ok;
}

// ── Window factory ───────────────────────────────────────────────────────────
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 360,
    minHeight: 500,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    vibrancy: "under-window",
    visualEffectState: "active",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.on("ready-to-show", () => mainWindow?.show());

  // Clear the reference when the window is destroyed so shortcuts don't crash
  mainWindow.on("closed", () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Only allow opening https URLs
    if (url.startsWith("https://")) {
      shell.openExternal(url);
    } else {
      console.warn("Blocked potentially unsafe external URL:", url);
    }
    return { action: "deny" };
  });

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// ── Window control IPC ───────────────────────────────────────────────────────
ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:close", () => mainWindow?.close());

const TogglePinSchema = z.boolean();
ipcMain.on("window:toggle-pin", (_, pinned: unknown) => {
  const result = TogglePinSchema.safeParse(pinned);
  if (result.success) {
    mainWindow?.setAlwaysOnTop(result.data, "floating");
  }
});

const SetOpacitySchema = z.number().min(0.1).max(1);
ipcMain.on("window:set-opacity", (_, value: unknown) => {
  const result = SetOpacitySchema.safeParse(value);
  if (result.success) {
    mainWindow?.setOpacity(result.data);
  }
});

// ── Shortcut config IPC ──────────────────────────────────────────────────────
ipcMain.handle("shortcuts:get", () => {
  return { showShortcut: currentShowShortcut };
});

const SetShowShortcutSchema = z.string().min(1).max(50);
ipcMain.handle("shortcuts:set-show", (_, key: unknown) => {
  const result = SetShowShortcutSchema.safeParse(key);
  if (!result.success) return { success: false, shortcut: currentShowShortcut };

  const ok = registerShowShortcut(result.data);
  if (ok) {
    writeConfig({ showShortcut: result.data });
  }
  return { success: ok, shortcut: currentShowShortcut };
});

// ── Screen capture ───────────────────────────────────────────────────────────
ipcMain.handle("screen:capture", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 2560, height: 1440 },
    });
    if (!sources.length) return null;
    return sources[0].thumbnail.toDataURL();
  } catch (err) {
    console.error("screen:capture failed:", err);
    return null;
  }
});

// ── Smart paste via AppleScript (macOS) ──────────────────────────────────────
const PasteAtSchema = z.object({
  x: z.number().int().min(0).max(10000),
  y: z.number().int().min(0).max(10000),
});

ipcMain.handle("screen:paste-at", async (_, payload: unknown) => {
  if (process.platform !== "darwin") {
    return { success: false, error: "Auto-paste only supported on macOS currently." };
  }

  const parseResult = PasteAtSchema.safeParse(payload);
  if (!parseResult.success) {
    return { success: false, error: "Invalid coordinates" };
  }

  const { x, y } = parseResult.data;
  const script = [
    `tell application "System Events"`,
    `  click at {${x}, ${y}}`,
    `  delay 0.3`,
    `  keystroke "a" using command down`,
    `  delay 0.1`,
    `  keystroke "v" using command down`,
    `end tell`,
  ].join("\n");

  return new Promise((resolve) => {
    const child = spawn("osascript", ["-e", script]);
    child.on("close", (code) => {
      if (code !== 0) {
        console.error(`osascript exited with code ${code}`);
        resolve({ success: false, error: `Process exited with code ${code}` });
      } else {
        resolve({ success: true });
      }
    });
    child.on("error", (err) => {
      console.error("screen:paste-at error:", err.message);
      resolve({ success: false, error: err.message });
    });
  });
});

// ── Clipboard write via pbcopy ───────────────────────────────────────────────
const ClipboardWriteSchema = z.string().max(1000000); // 1MB limit for safety
ipcMain.handle("clipboard:write", async (_, text: unknown) => {
  if (process.platform !== "darwin") return { success: false };

  const result = ClipboardWriteSchema.safeParse(text);
  if (!result.success) return { success: false, error: "Invalid text payload" };

  const tmp = join(tmpdir(), `vb_${Date.now()}.txt`);
  try {
    await fs.writeFile(tmp, result.data, "utf8");
    return new Promise((resolve) => {
      const child = spawn("bash", ["-c", `cat "${tmp}" | pbcopy`]);
      child.on("close", async (code) => {
        try { await fs.unlink(tmp); } catch { /* ignore */ }
        resolve({ success: code === 0 });
      });
      child.on("error", async (err) => {
        try { await fs.unlink(tmp); } catch { /* ignore */ }
        resolve({ success: false, error: err.message });
      });
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ── Nav relay (global shortcut → renderer) ───────────────────────────────────
ipcMain.on("nav:go", (_, view: string) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("nav:go", view);
  }
});

// ── Auto-updater IPC ─────────────────────────────────────────────────────────
ipcMain.handle("updater:check", async () => {
  if (is.dev) return null;
  try { return await autoUpdater.checkForUpdates(); } catch { return null; }
});

ipcMain.handle("updater:download", async () => {
  if (is.dev) return null;
  return autoUpdater.downloadUpdate();
});

ipcMain.handle("updater:install", async () => {
  if (is.dev) return;
  if (process.platform === "darwin" && downloadedFilePath) {
    // Bypass Squirrel.Mac entirely — it corrupts unsigned app installs.
    // Instead: run a detached shell script that waits for us to quit,
    // then extracts the ZIP and replaces the .app bundle, then relaunches.
    const exePath = app.getPath("exe");
    const appPath = exePath.split(".app/")[0] + ".app";
    const appDir = require("path").dirname(appPath);
    const tmpExtract = join(tmpdir(), `vb-update-${Date.now()}`);
    const script = [
      `#!/bin/bash`,
      `sleep 2`,
      `unzip -o "${downloadedFilePath}" -d "${tmpExtract}"`,
      `NEW=$(find "${tmpExtract}" -maxdepth 1 -name "*.app" | head -1)`,
      `if [ -n "$NEW" ]; then`,
      `  rm -rf "${appPath}"`,
      `  cp -Rp "$NEW" "${appDir}/"`,
      `  xattr -r -d com.apple.quarantine "${appPath}" 2>/dev/null || true`,
      `  open "${appPath}"`,
      `fi`,
      `rm -rf "${tmpExtract}"`,
    ].join("\n");
    const scriptPath = join(tmpdir(), "vb-updater.sh");
    try {
      await fs.writeFile(scriptPath, script, { mode: 0o755, encoding: "utf8" });
      const child = spawn("bash", [scriptPath], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
      app.quit();
    } catch (err) {
      console.error("Failed to launch updater script:", err);
    }
  } else {
    // Windows: NSIS handles installs correctly
    autoUpdater.quitAndInstall(false, true);
  }
});

ipcMain.handle("updater:get-version", () => app.getVersion());

// ── Secure Storage IPC ───────────────────────────────────────────────────────
const SECURE_STORAGE_DIR = join(app.getPath("userData"), "secure-storage");
if (!existsSync(SECURE_STORAGE_DIR)) {
  require("fs").mkdirSync(SECURE_STORAGE_DIR, { recursive: true });
}

const SecureStorageSchema = z.object({
  key: z.string().regex(/^[a-z0-9_-]+$/),
  value: z.string().optional(),
});

ipcMain.handle("secure-storage:set", async (_, payload: unknown) => {
  const result = SecureStorageSchema.safeParse(payload);
  if (!result.success || !result.data.value) return { success: false };

  try {
    const encrypted = safeStorage.encryptString(result.data.value);
    const filePath = join(SECURE_STORAGE_DIR, result.data.key);
    await fs.writeFile(filePath, encrypted);
    return { success: true };
  } catch (err) {
    console.error("Secure storage write failed:", err);
    return { success: false };
  }
});

ipcMain.handle("secure-storage:get", async (_, payload: unknown) => {
  const result = SecureStorageSchema.safeParse(payload);
  if (!result.success) return null;

  try {
    const filePath = join(SECURE_STORAGE_DIR, result.data.key);
    if (!existsSync(filePath)) return null;

    const encrypted = await fs.readFile(filePath);
    if (!safeStorage.isEncryptionAvailable()) return null;

    return safeStorage.decryptString(encrypted);
  } catch (err) {
    console.error("Secure storage read failed:", err);
    return null;
  }
});

ipcMain.handle("secure-storage:remove", async (_, payload: unknown) => {
  const result = SecureStorageSchema.omit({ value: true }).safeParse(payload);
  if (!result.success) return { success: false };

  try {
    const filePath = join(SECURE_STORAGE_DIR, result.data.key);
    if (existsSync(filePath)) {
      await fs.unlink(filePath);
    }
    return { success: true };
  } catch {
    return { success: false };
  }
});

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // ── Configure Fuses ────────────────────────────────────────────────────────
  try {
    flipFuses(process.execPath, {
      version: FuseVersion.V1,
      resetAdHocDarwinSignature: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: true,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    });
  } catch (err) {
    console.error("Failed to flip fuses:", err);
  }

  createWindow();

  // ── Auto-updater setup (production only) ──────────────────────────────────
  if (!is.dev) {
    autoUpdater.autoDownload = false;        // user-triggered download
    autoUpdater.autoInstallOnAppQuit = true; // install when user quits
    autoUpdater.logger = null;               // suppress default logger noise

    // Cache last status so we can re-send it when the renderer reloads
    let lastStatus: object | null = null;
    const sendStatus = (status: object) => {
      lastStatus = status;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("updater:status", status);
      }
    };

    autoUpdater.on("checking-for-update", () => {
      sendStatus({ type: "checking" });
    });
    autoUpdater.on("update-available", (info) => {
      sendStatus({ type: "available", version: info.version, releaseDate: info.releaseDate });
    });
    autoUpdater.on("update-not-available", () => {
      sendStatus({ type: "up-to-date" });
    });
    autoUpdater.on("download-progress", (p) => {
      sendStatus({ type: "downloading", percent: Math.round(p.percent), bytesPerSecond: p.bytesPerSecond });
    });
    autoUpdater.on("update-downloaded", (info: any) => {
      downloadedFilePath = info.downloadedFile ?? null;
      sendStatus({ type: "downloaded", version: info.version });
    });
    autoUpdater.on("error", (err) => {
      console.error("[updater] error:", err.message);
      sendStatus({ type: "error", message: err.message });
    });

    // Trigger check once the renderer has fully loaded (so the listener is ready)
    // then re-check every 3 hours
    const runCheck = () => {
      try { autoUpdater.checkForUpdates().catch(() => {}); } catch { /* ignore */ }
    };
    mainWindow!.webContents.on("did-finish-load", () => {
      // Re-send cached status (e.g. after a reload) so the banner reappears
      if (lastStatus) {
        mainWindow?.webContents.send("updater:status", lastStatus);
      }
      // First-run check — small delay so React has time to mount & subscribe
      setTimeout(runCheck, 1000);
    });
    setInterval(runCheck, 3 * 60 * 60 * 1000);
  }

  // Load persisted shortcut
  readConfig().then((config) => {
    const ok = registerShowShortcut(config.showShortcut);
    if (!ok) {
      // Fallback if saved shortcut is now taken by another app
      registerShowShortcut(DEFAULT_SHOW_SHORTCUT);
      writeConfig({ showShortcut: DEFAULT_SHOW_SHORTCUT });
    }
  });

  // Minimise / restore
  globalShortcut.register("CommandOrControl+Shift+M", () => {
    try {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      else mainWindow.minimize();
    } catch { /* ignore */ }
  });

  // Tab switchers Cmd+Shift+1..5
  const tabKeys: [string, string][] = [
    ["CommandOrControl+Shift+1", "consultations"],
    ["CommandOrControl+Shift+2", "patients"],
    ["CommandOrControl+Shift+3", "notes"],
    ["CommandOrControl+Shift+4", "templates"],
    ["CommandOrControl+Shift+5", "paste-lab"],
  ];
  for (const [key, view] of tabKeys) {
    globalShortcut.register(key, () => {
      try {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (!mainWindow.isVisible()) { mainWindow.show(); mainWindow.focus(); }
        mainWindow.webContents.send("nav:go", view);
      } catch { /* ignore */ }
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
