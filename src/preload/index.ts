import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  minimize: () => ipcRenderer.send("window:minimize"),
  close: () => ipcRenderer.send("window:close"),
  togglePin: (pinned: boolean) => ipcRenderer.send("window:toggle-pin", pinned),
  setOpacity: (value: number) => ipcRenderer.send("window:set-opacity", value),
});
