import { app, BrowserWindow, ipcMain, shell, desktopCapturer, globalShortcut } from "electron";
import { join } from "path";
import { exec } from "child_process";
import { writeFileSync, unlinkSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { is } from "@electron-toolkit/utils";
import { autoUpdater } from "electron-updater";

let mainWindow: BrowserWindow | null = null;

// ── Config (stored in userData so it survives app updates) ───────────────────
const CONFIG_PATH = join(app.getPath("userData"), "vetbuddy-config.json");
const DEFAULT_SHOW_SHORTCUT = "CommandOrControl+Shift+V"; // default: Cmd+Shift+V

function readConfig(): { showShortcut: string } {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    }
  } catch { /* ignore parse errors */ }
  return { showShortcut: DEFAULT_SHOW_SHORTCUT };
}

function writeConfig(config: { showShortcut: string }) {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
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
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
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
      sandbox: false,
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
    shell.openExternal(url);
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
ipcMain.on("window:toggle-pin", (_, pinned: boolean) => {
  mainWindow?.setAlwaysOnTop(pinned, "floating");
});
ipcMain.on("window:set-opacity", (_, value: number) => {
  mainWindow?.setOpacity(value);
});

// ── Shortcut config IPC ──────────────────────────────────────────────────────
ipcMain.handle("shortcuts:get", () => {
  return { showShortcut: currentShowShortcut };
});

ipcMain.handle("shortcuts:set-show", (_, key: string) => {
  const ok = registerShowShortcut(key);
  if (ok) {
    writeConfig({ showShortcut: key });
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
ipcMain.handle("screen:paste-at", async (_, { x, y }: { x: number; y: number }) => {
  if (process.platform !== "darwin") {
    return { success: false, error: "Auto-paste only supported on macOS currently." };
  }
  const script = [
    `tell application "System Events"`,
    `  click at {${Math.round(x)}, ${Math.round(y)}}`,
    `  delay 0.3`,
    `  keystroke "a" using command down`,
    `  delay 0.1`,
    `  keystroke "v" using command down`,
    `end tell`,
  ].join("\n");
  return new Promise((resolve) => {
    exec(`osascript << 'APPLESCRIPT'\n${script}\nAPPLESCRIPT`, (err) => {
      if (err) {
        console.error("screen:paste-at error:", err.message);
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});

// ── Clipboard write via pbcopy ───────────────────────────────────────────────
ipcMain.handle("clipboard:write", async (_, text: string) => {
  if (process.platform !== "darwin") return { success: false };
  const tmp = join(tmpdir(), `vb_${Date.now()}.txt`);
  try {
    writeFileSync(tmp, text, "utf8");
    await new Promise<void>((resolve, reject) => {
      exec(`cat "${tmp}" | pbcopy`, (err) => {
        try { unlinkSync(tmp); } catch { /* ignore */ }
        err ? reject(err) : resolve();
      });
    });
    return { success: true };
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
  return autoUpdater.checkForUpdates();
});

ipcMain.handle("updater:download", async () => {
  if (is.dev) return null;
  return autoUpdater.downloadUpdate();
});

ipcMain.handle("updater:install", () => {
  if (is.dev) return;
  autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle("updater:get-version", () => app.getVersion());

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
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
    autoUpdater.on("update-downloaded", (info) => {
      sendStatus({ type: "downloaded", version: info.version });
    });
    autoUpdater.on("error", (err) => {
      console.error("[updater] error:", err.message);
      sendStatus({ type: "error", message: err.message });
    });

    // Trigger check once the renderer has fully loaded (so the listener is ready)
    // then re-check every 3 hours
    const runCheck = () => autoUpdater.checkForUpdates().catch(console.error);
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
  const config = readConfig();
  const ok = registerShowShortcut(config.showShortcut);
  if (!ok) {
    // Fallback if saved shortcut is now taken by another app
    registerShowShortcut(DEFAULT_SHOW_SHORTCUT);
    writeConfig({ showShortcut: DEFAULT_SHOW_SHORTCUT });
  }

  // Minimise / restore
  globalShortcut.register("CommandOrControl+Shift+M", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    else mainWindow.minimize();
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
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (!mainWindow.isVisible()) { mainWindow.show(); mainWindow.focus(); }
      mainWindow.webContents.send("nav:go", view);
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
