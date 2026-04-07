import { contextBridge, ipcRenderer } from "electron";

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
    // Return cleanup function
    return () => ipcRenderer.removeAllListeners("nav:go");
  },
});
