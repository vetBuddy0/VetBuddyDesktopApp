import { app, BrowserWindow, ipcMain, shell, desktopCapturer, globalShortcut } from "electron";
import { join } from "path";
import { exec } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { is } from "@electron-toolkit/utils";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 360,
    minHeight: 500,
    frame: false,             // Frameless for custom title bar
    transparent: true,        // Transparent background
    alwaysOnTop: true,        // Always over other apps
    resizable: true,
    skipTaskbar: false,
    vibrancy: "under-window", // macOS frosted glass
    visualEffectState: "active",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Keep on top of all windows including system dialogs
  mainWindow.setAlwaysOnTop(true, "floating");
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });

  // Open external links in default browser
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

// ── Window controls ─────────────────────────────────────────────────────────
ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:close", () => mainWindow?.close());

ipcMain.on("window:toggle-pin", (_, pinned: boolean) => {
  mainWindow?.setAlwaysOnTop(pinned, "floating");
});

ipcMain.on("window:set-opacity", (_, value: number) => {
  mainWindow?.setOpacity(value);
});

// ── Screen capture ───────────────────────────────────────────────────────────
// Returns base64 data URL of the primary screen at 1920×1080 (or native res)
ipcMain.handle("screen:capture", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 2560, height: 1440 },
    });
    if (!sources.length) return null;
    // Use first (primary) screen
    return sources[0].thumbnail.toDataURL();
  } catch (err) {
    console.error("screen:capture failed:", err);
    return null;
  }
});

// ── Smart paste at screen coordinate (macOS via AppleScript) ─────────────────
// text is already in clipboard when this is called; just clicks + Cmd+V
ipcMain.handle("screen:paste-at", async (_, { x, y }: { x: number; y: number }) => {
  if (process.platform !== "darwin") {
    // Windows/Linux: use xdotool or similar — stub for now
    return { success: false, error: "Auto-paste only supported on macOS currently." };
  }

  const script = [
    `tell application "System Events"`,
    `  click at {${Math.round(x)}, ${Math.round(y)}}`,
    `  delay 0.3`,
    `  key stroke "a" using command down`,
    `  delay 0.1`,
    `  key stroke "v" using command down`,
    `end tell`,
  ].join("\n");

  return new Promise((resolve) => {
    exec(`osascript << 'APPLESCRIPT'\n${script}\nAPPLESCRIPT`, (err) => {
      if (err) {
        console.error("screen:paste-at AppleScript error:", err.message);
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});

// ── Copy text to clipboard via pbcopy (macOS) ────────────────────────────────
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

// ── IPC: navigate to a tab from renderer shortcut ───────────────────────────
ipcMain.on("nav:go", (_, view: string) => {
  mainWindow?.webContents.send("nav:go", view);
});

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();

  // ── Global shortcuts (work even when app is not focused) ──────────────────
  // Show / hide overlay
  globalShortcut.register("CommandOrControl+Shift+Space", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Minimise / restore
  globalShortcut.register("CommandOrControl+Shift+M", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    } else {
      mainWindow.minimize();
    }
  });

  // Global tab switchers (Cmd+Shift+1..5)
  const tabKeys: [string, string][] = [
    ["CommandOrControl+Shift+1", "consultations"],
    ["CommandOrControl+Shift+2", "patients"],
    ["CommandOrControl+Shift+3", "notes"],
    ["CommandOrControl+Shift+4", "templates"],
    ["CommandOrControl+Shift+5", "paste-lab"],
  ];
  for (const [key, view] of tabKeys) {
    globalShortcut.register(key, () => {
      if (!mainWindow) return;
      if (!mainWindow.isVisible()) {
        mainWindow.show();
        mainWindow.focus();
      }
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
