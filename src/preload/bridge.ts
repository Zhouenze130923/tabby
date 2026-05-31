import { contextBridge, ipcRenderer } from "electron";

const api = {
  // 标签页管理
  tab: {
    create: (url?: string) => ipcRenderer.invoke("tab:create", url),
    navigate: (id: string, url: string) => ipcRenderer.invoke("tab:navigate", id, url),
    close: (id: string) => ipcRenderer.invoke("tab:close", id),
    back: (id: string) => ipcRenderer.invoke("tab:back", id),
    forward: (id: string) => ipcRenderer.invoke("tab:forward", id),
    reload: (id: string) => ipcRenderer.invoke("tab:reload", id),
    list: () => ipcRenderer.invoke("tab:list"),
    activate: (id: string) => ipcRenderer.invoke("tab:activate", id),
    onUpdate: (cb: (tabs: any[], activeTabId: string | null) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, tabs: any[], activeTabId: string | null) =>
        cb(tabs, activeTabId);
      ipcRenderer.on("tab:updated", handler);
      return () => ipcRenderer.removeListener("tab:updated", handler);
    },
    getContent: (id: string) => ipcRenderer.invoke("tab:getContent", id),
    /** 同步 webview 导航事件产生的元数据（不触发 tab:updated 推送，避免循环） */
    updateMeta: (id: string, updates: Record<string, unknown>) =>
      ipcRenderer.invoke("tab:updateMeta", id, updates),
    /** 注册 webview（发送 webContentsId 到主进程以便提取页面内容） */
    registerWebview: (tabId: string, webContentsId: number) =>
      ipcRenderer.invoke("tab:registerWebview", tabId, webContentsId),
    /** 获取所有标签页的详细信息 */
    getAllInfo: () => ipcRenderer.invoke("tab:getAllInfo"),
    /** 切换到指定标签页 */
    switch: (id: string) => ipcRenderer.invoke("tab:switch", id),
  },

  // AI
  ai: {
    chat: (messages: any[], provider?: string) =>
      ipcRenderer.invoke("ai:chat", messages, provider),
    stream: (messages: any[], provider?: string) =>
      ipcRenderer.invoke("ai:stream", messages, provider),
    context: () => ipcRenderer.invoke("ai:context"),
    /** Register a listener for streaming chunks. Returns an unsubscribe function. */
    onChunk: (cb: (chunk: { type: string; content: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, chunk: { type: string; content: string }) =>
        cb(chunk);
      ipcRenderer.on("ai:chunk", handler);
      return () => ipcRenderer.removeListener("ai:chunk", handler);
    },
    /** Cancel an active AI stream */
    cancel: () => ipcRenderer.invoke("ai:cancel"),
  },

  // 设置
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (key: string, value: any) => ipcRenderer.invoke("settings:set", key, value),
    getProvider: (name: string) => ipcRenderer.invoke("settings:getProvider", name),
    setProvider: (name: string, config: any) =>
      ipcRenderer.invoke("settings:setProvider", name, config),
  },

  // 书签 & 历史
  bookmark: {
    list: () => ipcRenderer.invoke("bookmark:list"),
    add: (url: string, title: string) => ipcRenderer.invoke("bookmark:add", url, title),
    remove: (id: number) => ipcRenderer.invoke("bookmark:remove", id),
  },
  history: {
    search: (query: string) => ipcRenderer.invoke("history:search", query),
  },

  // Skills
  skills: {
    list: () => ipcRenderer.invoke("skills:list"),
    run: (name: string, context?: Record<string, string>) =>
      ipcRenderer.invoke("skills:run", name, context),
  },

  // 搜索
  search: {
    query: (q: string) => ipcRenderer.invoke("search:query", q),
    getConfig: () => ipcRenderer.invoke("search:config"),
    saveConfig: (config: any) => ipcRenderer.invoke("search:saveConfig", config),
  },

  // 窗口控制
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
    onMaximizedChange: (cb: (maximized: boolean) => void) => {
      ipcRenderer.on("window:maximizedChanged", (_event, maximized) => cb(maximized));
    },
  },
};

contextBridge.exposeInMainWorld("tabby", api);
