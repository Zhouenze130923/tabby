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
    /** Execute JavaScript in the tab page */
    executeJS: (tabId: string, code: string) =>
      ipcRenderer.invoke("tab:executeJS", tabId, code),
    /** Click an element by CSS selector */
    clickElement: (tabId: string, selector: string) =>
      ipcRenderer.invoke("tab:clickElement", tabId, selector),
    /** Fill an input field */
    fillInput: (tabId: string, selector: string, value: string) =>
      ipcRenderer.invoke("tab:fillInput", tabId, selector, value),
    /** Extract text from page or element */
    extractText: (tabId: string, selector?: string) =>
      ipcRenderer.invoke("tab:extractText", tabId, selector),
    /** Scroll the page */
    scrollTo: (tabId: string, x: number, y: number) =>
      ipcRenderer.invoke("tab:scrollTo", tabId, x, y),
    createPage: (html: string) => ipcRenderer.invoke("tab:createPage", html),
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
    list: (opts?: {limit?: number; offset?: number; query?: string}) => ipcRenderer.invoke("history:list", opts),
    clear: () => ipcRenderer.invoke("history:clear"),
  },

  // Skills
  skills: {
    list: () => ipcRenderer.invoke("skills:list"),
    run: (name: string, context?: Record<string, string>) =>
      ipcRenderer.invoke("skills:run", name, context),
  },

  // 浏览器书签导入
  import: {
    fromChrome: () => ipcRenderer.invoke("import:fromChrome"),
    fromSafari: () => ipcRenderer.invoke("import:fromSafari"),
    fromFirefox: () => ipcRenderer.invoke("import:fromFirefox"),
    fromAll: () => ipcRenderer.invoke("import:fromAll"),
  },

  // 妙招（Prompt 模板库）
  prompts: {
    list: () => ipcRenderer.invoke("prompts:list"),
    save: (p: { id?: string; name: string; description?: string; prompt: string; category?: string }) =>
      ipcRenderer.invoke("prompts:save", p),
    delete: (id: string) => ipcRenderer.invoke("prompts:delete", id),
  },

  // 搜索
  search: {
    query: (q: string) => ipcRenderer.invoke("search:query", q),
    getConfig: () => ipcRenderer.invoke("search:config"),
    saveConfig: (config: any) => ipcRenderer.invoke("search:saveConfig", config),
  },

  // 定时任务
  tasks: {
    list: () => ipcRenderer.invoke("tasks:list"),
    create: (task: any) => ipcRenderer.invoke("tasks:create", task),
    update: (id: string, updates: any) => ipcRenderer.invoke("tasks:update", id, updates),
    delete: (id: string) => ipcRenderer.invoke("tasks:delete", id),
    toggle: (id: string, active: boolean) => ipcRenderer.invoke("tasks:toggle", id, active),
    onExecute: (cb: (task: { id: string; name: string; prompt: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, task: { id: string; name: string; prompt: string }) => cb(task);
      ipcRenderer.on("tasks:execute", handler);
      return () => ipcRenderer.removeListener("tasks:execute", handler);
    },
  },

  // 对话历史
  conversations: {
    list: () => ipcRenderer.invoke("conversations:list"),
    create: (title?: string) => ipcRenderer.invoke("conversations:create", title),
    remove: (id: string) => ipcRenderer.invoke("conversations:remove", id),
    rename: (id: string, title: string) => ipcRenderer.invoke("conversations:rename", id, title),
  },
  messages: {
    list: (conversationId: string) => ipcRenderer.invoke("messages:list", conversationId),
    add: (conversationId: string, role: string, content: string) =>
      ipcRenderer.invoke("messages:add", conversationId, role, content),
    clear: (conversationId: string) => ipcRenderer.invoke("messages:clear", conversationId),
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
