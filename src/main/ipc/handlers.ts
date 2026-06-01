import { ipcMain, BrowserWindow, webContents, app } from "electron";
import fs from "fs";
import path from "path";
import { tabManager } from "../browser/tab-manager";
import {
  bookmarks,
  history,
  settings as dbSettings,
  prompts,
  conversations,
  chatMessages,
  close as closeDb,
} from "../storage/db";
import { loadSkills, getSkill, executeSkill } from "../skills/loader";
import { tasks as dbTasks } from "../storage/db";
import { taskScheduler } from "../tasks/scheduler";
import { importFromChrome, importFromSafari, importFromFirefox, importFromAll } from "../import/browsers";
import { DeepSeekProvider } from "../ai/providers/deepseek";
import { ClaudeProvider } from "../ai/providers/claude";
import { getSearchProvider } from "../search/engine";

// Track the current AbortController for AI stream cancellation
let currentAbortController: AbortController | null = null;

// Map tabId → webContentsId for page content extraction
const tabWebContents = new Map<string, number>();

// Float window state
let floatWindow: BrowserWindow | null = null;

function createFloatWindow(mainWindow: BrowserWindow) {
  floatWindow = new BrowserWindow({
    width: 380,
    height: 520,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    frame: true,
    title: "Pivot — 浮窗",
    webPreferences: {
      preload: path.join(__dirname, "../preload/bridge.js"),
      webviewTag: true,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === "development") {
    floatWindow.loadURL("http://localhost:5173/?float=1");
  } else {
    floatWindow.loadFile(path.join(__dirname, "../renderer/index.html"), { query: { float: "1" } });
  }

  floatWindow.on("closed", () => {
    floatWindow = null;
    // Restore main window when float is closed externally
    if (!mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function getProvider(providerName?: string): any {
  // Read provider config from SQLite settings
  const providersRaw = dbSettings.get("providers");
  const defaultProvider = dbSettings.get("defaultProvider") || "deepseek";
  const name = providerName || defaultProvider;
  let providers: Record<string, any> = {};
  if (providersRaw) {
    try {
      providers = JSON.parse(providersRaw);
    } catch {}
  }
  const config = providers[name];
  if (!config?.apiKey) {
    throw new Error(`Provider "${name}" not configured. Please add an API key in Settings.`);
  }
  switch (name) {
    case "deepseek":
      return new DeepSeekProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
      });
    case "claude":
      return new ClaudeProvider({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
      });
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

export function registerHandlers(mainWindow: BrowserWindow) {
  // 标签页变更时推送至渲染进程（同时发送 activeTabId）
  tabManager.setOnChange((tabs) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send("tab:updated", tabs, tabManager.getActiveId());
    }
    if (floatWindow && !floatWindow.isDestroyed()) {
      floatWindow.webContents.send("tab:updated", tabs, tabManager.getActiveId());
    }
  });

  // —— 窗口控制 ——
  ipcMain.handle("window:minimize", () => mainWindow.minimize());
  ipcMain.handle("window:maximize", () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle("window:close", () => mainWindow.close());
  ipcMain.handle("window:isMaximized", () => mainWindow.isMaximized());

  // —— 浮窗控制 ——
  ipcMain.handle("window:enterFloat", () => {
    if (floatWindow && !floatWindow.isDestroyed()) {
      floatWindow.focus();
      return true;
    }
    createFloatWindow(mainWindow);
    mainWindow.minimize();
    return true;
  });

  ipcMain.handle("window:exitFloat", () => {
    if (floatWindow && !floatWindow.isDestroyed()) {
      floatWindow.close();
      floatWindow = null;
    }
    if (!mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
    return true;
  });

  ipcMain.handle("window:isFloating", () => {
    return floatWindow !== null && !floatWindow.isDestroyed();
  });

  // —— 设置 ——
  // Build full settings object from SQLite key-value pairs
  const buildSettings = () => {
    const flat = dbSettings.getAll();
    const settings: Record<string, any> = {};

    // Handle known JSON-encoded keys
    for (const [key, value] of Object.entries(flat)) {
      if (key === "providers") {
        try {
          settings[key] = JSON.parse(value);
        } catch {
          settings[key] = {};
        }
      } else {
        settings[key] = value;
      }
    }

    // Apply defaults
    if (!settings.defaultProvider) settings.defaultProvider = "deepseek";
    if (!settings.theme) settings.theme = "system";
    if (!settings.searchEngine) settings.searchEngine = "google";
    if (!settings.providers) settings.providers = {};

    return settings;
  };

  ipcMain.handle("settings:get", () => buildSettings());

  ipcMain.handle("settings:set", (_e, key: string, value: any) => {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    dbSettings.set(key, serialized);
  });

  ipcMain.handle("settings:getProvider", (_e, name: string) => {
    const providersRaw = dbSettings.get("providers");
    if (!providersRaw) return null;
    try {
      const providers = JSON.parse(providersRaw);
      return providers[name] || null;
    } catch {
      return null;
    }
  });

  ipcMain.handle("settings:setProvider", (_e, name: string, config: any) => {
    const providersRaw = dbSettings.get("providers") || "{}";
    let providers: Record<string, any>;
    try {
      providers = JSON.parse(providersRaw);
    } catch {
      providers = {};
    }
    providers[name] = config;
    dbSettings.set("providers", JSON.stringify(providers));
  });

  // —— 标签页 ——
  ipcMain.handle("tab:create", (_e, url?: string) => {
    return tabManager.create(url);
  });

  ipcMain.handle("tab:list", () => {
    return tabManager.getAll();
  });

  ipcMain.handle("tab:navigate", (_e, id: string, url: string) => {
    return tabManager.navigate(id, url);
  });

  ipcMain.handle("tab:close", (_e, id: string) => {
    return tabManager.close(id);
  });

  ipcMain.handle("tab:back", (_e, id: string) => {
    return true;
  });

  ipcMain.handle("tab:forward", (_e, id: string) => {
    return true;
  });

  ipcMain.handle("tab:reload", (_e, id: string) => {
    return true;
  });

  ipcMain.handle("tab:activate", (_e, id: string) => {
    return tabManager.activate(id);
  });

  ipcMain.handle("tab:registerWebview", (_e, tabId: string, webContentsId: number) => {
    tabWebContents.set(tabId, webContentsId);
  });

  ipcMain.handle("tab:getContent", async (_e, id: string) => {
    // Try to extract actual page content via webContents
    const wcId = tabWebContents.get(id);
    if (wcId) {
      const wc = webContents.fromId(wcId);
      if (wc && !wc.isDestroyed()) {
        try {
          const text = await wc.executeJavaScript("document.body.innerText", true);
          return text || "";
        } catch {
          // Fallback to tab metadata
        }
      }
    }
    const tab = tabManager.getActive();
    return tab ? `${tab.url}\n${tab.title}` : "";
  });

  ipcMain.handle("tab:getAllInfo", () => {
    const allTabs = tabManager.getAll();
    return allTabs.map(t => ({
      id: t.id,
      url: t.url,
      title: t.title,
      favicon: t.favicon,
      isLoading: t.isLoading,
      isActive: t.id === tabManager.getActiveId(),
    }));
  });

  ipcMain.handle("tab:switch", async (_e, id: string) => {
    const tab = tabManager.activate(id);
    return tab ? true : false;
  });

  ipcMain.handle("tab:executeJS", async (_e, tabId: string, code: string) => {
    try {
      const wcId = tabWebContents.get(tabId);
      if (!wcId) return { success: false, error: "tab not found" };
      const wc = webContents.fromId(wcId);
      if (!wc || wc.isDestroyed()) return { success: false, error: "webview destroyed" };
      const result = await wc.executeJavaScript(code);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("tab:clickElement", async (_e, tabId: string, selector: string) => {
    try {
      const wcId = tabWebContents.get(tabId);
      if (!wcId) return { success: false, error: "tab not found" };
      const wc = webContents.fromId(wcId);
      if (!wc || wc.isDestroyed()) return { success: false, error: "webview destroyed" };
      await wc.executeJavaScript(`
        (() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return false;
          el.click();
          return true;
        })()
      `);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("tab:fillInput", async (_e, tabId: string, selector: string, value: string) => {
    try {
      const wcId = tabWebContents.get(tabId);
      if (!wcId) return { success: false, error: "tab not found" };
      const wc = webContents.fromId(wcId);
      if (!wc || wc.isDestroyed()) return { success: false, error: "webview destroyed" };
      await wc.executeJavaScript(`
        (() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return false;
          el.focus();
          el.value = ${JSON.stringify(value)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        })()
      `);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("tab:extractText", async (_e, tabId: string, selector?: string) => {
    try {
      const wcId = tabWebContents.get(tabId);
      if (!wcId) return { success: false, error: "tab not found" };
      const wc = webContents.fromId(wcId);
      if (!wc || wc.isDestroyed()) return { success: false, error: "webview destroyed" };
      const code = selector
        ? `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el ? el.innerText || el.textContent || "" : ""; })()`
        : `document.body.innerText`;
      const text = await wc.executeJavaScript(code);
      return { success: true, text: String(text) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("tab:scrollTo", async (_e, tabId: string, x: number, y: number) => {
    try {
      const wcId = tabWebContents.get(tabId);
      if (!wcId) return { success: false, error: "tab not found" };
      const wc = webContents.fromId(wcId);
      if (!wc || wc.isDestroyed()) return { success: false, error: "webview destroyed" };
      await wc.executeJavaScript(`window.scrollTo(${x}, ${y});`);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("tab:updateMeta", (_e, id: string, updates: Record<string, unknown>) => {
    return tabManager.updateSilent(id, updates);
  });

  // —— 创建网页 ——
  ipcMain.handle("tab:createPage", async (_e, html: string) => {
    try {
      const pagesDir = path.join(app.getPath("userData"), "pages");
      if (!fs.existsSync(pagesDir)) fs.mkdirSync(pagesDir, { recursive: true });
      const filename = `page_${Date.now()}.html`;
      const filePath = path.join(pagesDir, filename);
      fs.writeFileSync(filePath, html, "utf-8");
      return { success: true, url: `file://${filePath}` };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // —— AI ——
  ipcMain.handle("ai:chat", async (_e, messages: any[], providerName?: string) => {
    try {
      const provider = getProvider(providerName);
      const result = await provider.chat(messages);
      return result.choices?.[0]?.message?.content || JSON.stringify(result);
    } catch (err: any) {
      console.error("ai:chat error:", err);
      return `Error: ${err.message}`;
    }
  });

  ipcMain.handle("ai:stream", async (event, messages: any[], providerName?: string) => {
    try {
      const provider = getProvider(providerName);

      // AbortController for this stream
      currentAbortController = new AbortController();

      try {
        const stream = provider.stream(messages, { signal: currentAbortController.signal });
        for await (const chunk of stream) {
          if (!event.sender.isDestroyed()) {
            event.sender.send("ai:chunk", chunk);
          }
        }
        if (!event.sender.isDestroyed()) {
          event.sender.send("ai:chunk", { type: "done" });
        }
      } finally {
        currentAbortController = null;
      }
    } catch (err: any) {
      console.error("ai:stream error:", err);
      if (!event.sender.isDestroyed()) {
        event.sender.send("ai:chunk", { type: "error", content: err.message });
      }
    }
  });

  ipcMain.handle("ai:cancel", () => {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
      return true;
    }
    return false;
  });

  ipcMain.handle("ai:context", () => {
    const active = tabManager.getActive();
    if (!active) return { url: "", title: "", content: "" };
    return {
      url: active.url,
      title: active.title,
      content: `${active.url}\n${active.title}`,
    };
  });

  // —— 书签 ——
  ipcMain.handle("bookmark:list", () => {
    return bookmarks.list();
  });

  ipcMain.handle("bookmark:add", (_e, url: string, title: string) => {
    return bookmarks.add(url, title);
  });

  ipcMain.handle("bookmark:remove", (_e, id: number) => {
    return bookmarks.remove(id);
  });

  // —— 历史 ——
  ipcMain.handle("history:search", (_e, query: string) => {
    return history.search(query);
  });

  ipcMain.handle("history:list", (_e, opts?: {limit?: number; offset?: number; query?: string}) => {
    return history.list(opts);
  });

  ipcMain.handle("history:clear", () => {
    history.clear();
    return { success: true };
  });

  // —— Skills ——
  ipcMain.handle("skills:list", () => {
    return loadSkills();
  });

  ipcMain.handle("skills:run", async (_e, name: string, context?: Record<string, string>) => {
    try {
      // If the skill has context values passed from the renderer, use them
      const ctx = context || {
        page_content: "",
        selection: "",
        user_intent: "",
        page_fields: "",
      };
      const prompt = executeSkill(name, ctx);

      // Execute by sending to AI
      const provider = getProvider();
      const result = await provider.chat([
        { role: "system", content: "You are a helpful assistant. Execute the following prompt and return only the result." },
        { role: "user", content: prompt },
      ]);
      return result.choices?.[0]?.message?.content || JSON.stringify(result);
    } catch (err: any) {
      console.error("skills:run error:", err);
      return `Error: ${err.message}`;
    }
  });

  // —— 浏览器书签导入 ——
  ipcMain.handle("import:fromChrome", () => importFromChrome());
  ipcMain.handle("import:fromSafari", () => importFromSafari());
  ipcMain.handle("import:fromFirefox", () => importFromFirefox());
  ipcMain.handle("import:fromAll", () => importFromAll());

  // —— 搜索 ——
  ipcMain.handle("search:query", async (_e, query: string) => {
    try {
      const settingsRaw = dbSettings.get("searchProvider");
      if (!settingsRaw) {
        return { error: "未配置搜索后端，请在设置中配置" };
      }
      const searchConfig = JSON.parse(settingsRaw);
      const provider = getSearchProvider(searchConfig);
      const results = await provider.search(query, 8);
      return results;
    } catch (err: any) {
      console.error("search:query error:", err);
      return { error: err.message };
    }
  });

  ipcMain.handle("search:config", async () => {
    try {
      const raw = dbSettings.get("searchProvider");
      return raw ? JSON.parse(raw) : { provider: "tavily", tavilyApiKey: "", searxngUrl: "http://localhost:8888" };
    } catch {
      return { provider: "tavily", tavilyApiKey: "", searxngUrl: "http://localhost:8888" };
    }
  });

  ipcMain.handle("search:saveConfig", async (_e, config: any) => {
    dbSettings.set("searchProvider", JSON.stringify(config));
    return { success: true };
  });

  // —— Prompts (妙招) ——
  ipcMain.handle("prompts:list", () => {
    // Seed defaults if empty, then return all
    prompts.seedDefaults();
    return prompts.all();
  });

  ipcMain.handle("prompts:save", (_e, p: { id?: string; name: string; description?: string; prompt: string; category?: string }) => {
    const id = p.id || `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return prompts.add({ ...p, id });
  });

  ipcMain.handle("prompts:delete", (_e, id: string) => {
    return prompts.remove(id);
  });

  // —— Scheduled Tasks ——
  ipcMain.handle("tasks:list", () => {
    return dbTasks.all();
  });

  ipcMain.handle("tasks:create", (_e, task: Parameters<typeof dbTasks.add>[0]) => {
    return dbTasks.add(task);
  });

  ipcMain.handle("tasks:update", (_e, id: string, updates: Parameters<typeof dbTasks.update>[1]) => {
    return dbTasks.update(id, updates);
  });

  ipcMain.handle("tasks:delete", (_e, id: string) => {
    return dbTasks.remove(id);
  });

  ipcMain.handle("tasks:toggle", (_e, id: string, active: boolean) => {
    return dbTasks.update(id, { active });
  });

  // —— Conversation History ——
  ipcMain.handle("conversations:list", () => conversations.all());

  ipcMain.handle("conversations:create", (_e, title?: string) => conversations.create(title));

  ipcMain.handle("conversations:remove", (_e, id: string) => conversations.remove(id));

  ipcMain.handle("conversations:rename", (_e, id: string, title: string) =>
    conversations.update(id, { title })
  );

  ipcMain.handle("messages:list", (_e, conversationId: string) =>
    chatMessages.all(conversationId)
  );

  ipcMain.handle("messages:add", (_e, conversationId: string, role: string, content: string) =>
    chatMessages.add(conversationId, role, content)
  );

  ipcMain.handle("messages:clear", (_e, conversationId: string) =>
    chatMessages.clear(conversationId)
  );

  // —— Cleanup on window close ——
  mainWindow.on("closed", () => {
    taskScheduler.stop();
    closeDb();
  });

  // Connect scheduler to main window
  taskScheduler.setMainWindow(mainWindow);
  taskScheduler.start();
}
