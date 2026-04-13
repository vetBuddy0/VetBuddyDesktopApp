import { contextBridge, ipcRenderer } from "electron";

export type UpdaterStatus =
  | { type: "checking" }
  | { type: "available"; version: string; releaseDate?: string }
  | { type: "up-to-date" }
  | { type: "downloading"; percent: number; bytesPerSecond?: number }
  | { type: "downloaded"; version: string }
  | { type: "error"; message: string };

contextBridge.exposeInMainWorld("electron", {
  // Window controls
  minimize: () => ipcRenderer.send("window:minimize"),
  close: () => ipcRenderer.send("window:close"),
  togglePin: (pinned: boolean) => ipcRenderer.send("window:toggle-pin", pinned),
  setOpacity: (value: number) => ipcRenderer.send("window:set-opacity", value),

  // Screen capture — returns base64 data URL string or null
  captureScreen: (): Promise<string | null> =>
    ipcRenderer.invoke("screen:capture"),

  // Click at {x,y} on screen then Cmd+V — text must already be in clipboard
  pasteAt: (x: number, y: number): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("screen:paste-at", { x, y }),

  // Write text to system clipboard via pbcopy (avoids renderer clipboard limitations)
  writeClipboard: (text: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("clipboard:write", text),

  // Listen for navigation events from main process (global shortcuts)
  onNavigate: (callback: (view: string) => void) => {
    ipcRenderer.on("nav:go", (_, view) => callback(view));
    return () => ipcRenderer.removeAllListeners("nav:go");
  },

  // Shortcut configuration
  getShortcuts: (): Promise<{ showShortcut: string }> =>
    ipcRenderer.invoke("shortcuts:get"),
  setShowShortcut: (key: string): Promise<{ success: boolean; shortcut: string }> =>
    ipcRenderer.invoke("shortcuts:set-show", key),

  // Auto-updater
  updater: {
    check: (): Promise<void> =>
      ipcRenderer.invoke("updater:check"),
    download: (): Promise<void> =>
      ipcRenderer.invoke("updater:download"),
    install: (): Promise<void> =>
      ipcRenderer.invoke("updater:install"),
    getVersion: (): Promise<string> =>
      ipcRenderer.invoke("updater:get-version"),
    onStatus: (callback: (status: UpdaterStatus) => void) => {
      const listener = (_: Electron.IpcRendererEvent, status: UpdaterStatus) => callback(status);
      ipcRenderer.on("updater:status", listener);
      return () => ipcRenderer.removeListener("updater:status", listener);
    },
  },
});
