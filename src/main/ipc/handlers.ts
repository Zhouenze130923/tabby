import { ipcMain, BrowserWindow, webContents, app, dialog } from "electron";
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
  clippings,
  timeline,
  macros as dbMacros,
  knowledgeCache,
} from "../storage/db";
import { loadSkills, getSkill, executeSkill } from "../skills/loader";
import { tasks as dbTasks } from "../storage/db";
import { taskScheduler } from "../tasks/scheduler";
import { importFromChrome, importFromSafari, importFromFirefox, importFromAll } from "../import/browsers";
import { DeepSeekProvider } from "../ai/providers/deepseek";
import { ClaudeProvider } from "../ai/providers/claude";
import { OpenAIProvider } from "../ai/providers/openai";
import { getSearchProvider } from "../search/engine";
import { ResearchAgent } from "../ai/research-agent";
import { searchKnowledge, buildKnowledgeContext, autoDetectKnowledge } from "../knowledge/bridge";

// Track the current AbortController for AI stream cancellation
let currentAbortController: AbortController | null = null;

// Map tabId → webContentsId for page content extraction
const tabWebContents = new Map<string, number>();

// ── Research Agent instances ──
const activeAgents = new Map<string, any>();
function generateAgentId(): string {
  return `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
      return new DeepSeekProvider({ apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.model });
    case "claude":
      return new ClaudeProvider({ apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.model });
    case "openai":
      return new OpenAIProvider({ apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.model });
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
  });

  // —— 窗口控制 ——
  ipcMain.handle("window:minimize", () => mainWindow.minimize());
  ipcMain.handle("window:maximize", () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle("window:close", () => mainWindow.close());
  ipcMain.handle("window:isMaximized", () => mainWindow.isMaximized());

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
    if (!hasPermission("tabExecute")) return { success: false, error: "JS 执行权限已被关闭" };
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

  // —— Clippings (智能片段收藏) ——
  ipcMain.handle("clippings:list", (_e, type?: string) => clippings.all(type));
  ipcMain.handle("clippings:add", (_e, clip: any) => clippings.add(clip));
  ipcMain.handle("clippings:remove", (_e, id: string) => clippings.remove(id));
  ipcMain.handle("clippings:update", (_e, id: string, updates: any) => clippings.update(id, updates));
  ipcMain.handle("clippings:search", (_e, query: string) => clippings.search(query));

  // —— Timeline (浏览时间线) ——
  ipcMain.handle("timeline:list", (_e, limit?: number) => timeline.all(limit));
  ipcMain.handle("timeline:save", async (_e, label: string) => {
    const allTabs = tabManager.getAll();
    const active = tabManager.getActive();
    const snapshotData = JSON.stringify({
      tabs: allTabs.map(t => ({ id: t.id, url: t.url, title: t.title })),
      activeUrl: active?.url || "",
      timestamp: new Date().toISOString(),
    });
    return timeline.add(label, snapshotData);
  });
  ipcMain.handle("timeline:remove", (_e, id: string) => timeline.remove(id));
  ipcMain.handle("timeline:clear", () => timeline.clear());
  ipcMain.handle("timeline:autoSnapshot", async () => {
    // Auto-save snapshot every 30 minutes (called by frontend timer)
    const allTabs = tabManager.getAll();
    if (allTabs.length === 0) return null;
    const active = tabManager.getActive();
    const label = `自动快照 ${new Date().toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
    const snapshotData = JSON.stringify({
      tabs: allTabs.map(t => ({ id: t.id, url: t.url, title: t.title })),
      activeUrl: active?.url || "",
      timestamp: new Date().toISOString(),
    });
    return timeline.add(label, snapshotData);
  });

  // —— Macros (浏览器宏) ——
  ipcMain.handle("macros:list", () => dbMacros.all());
  ipcMain.handle("macros:save", (_e, name: string, desc: string, steps: any[]) => dbMacros.add(name, desc, steps));
  ipcMain.handle("macros:delete", (_e, id: string) => dbMacros.remove(id));
  ipcMain.handle("macros:execute", async (_e, macroId: string) => {
    const macro = dbMacros.get(macroId);
    if (!macro) return { success: false, error: "Macro not found" };
    const steps = JSON.parse(macro.steps);
    const results: any[] = [];
    for (const step of steps) {
      try {
        const wcId = tabWebContents.get(tabManager.getActiveId() || "");
        const wc = wcId ? webContents.fromId(wcId) : null;
        switch (step.type) {
          case "navigate":
            tabManager.navigate(tabManager.getActiveId() || "", step.params.url);
            await new Promise(r => setTimeout(r, 2000));
            results.push({ success: true, type: "navigate" });
            break;
          case "click":
            if (wc) {
              await wc.executeJavaScript(`document.querySelector(${JSON.stringify(step.params.selector)})?.click()`);
              results.push({ success: true, type: "click" });
            }
            break;
          case "type":
            if (wc) {
              await wc.executeJavaScript(`
                (() => { const el = document.querySelector(${JSON.stringify(step.params.selector)});
                if (el) { el.value = ${JSON.stringify(step.params.text || "")};
                el.dispatchEvent(new Event('input', { bubbles: true })); return true; } return false; })()`);
              results.push({ success: true, type: "type" });
            }
            break;
          case "wait":
            await new Promise(r => setTimeout(r, step.params.ms || 1000));
            results.push({ success: true, type: "wait" });
            break;
          case "extract":
            if (wc) {
              const text = await wc.executeJavaScript("document.body.innerText");
              results.push({ success: true, type: "extract", data: text.slice(0, 500) });
            }
            break;
          default:
            results.push({ success: false, type: step.type, error: "Unknown step type" });
        }
      } catch (err: any) {
        results.push({ success: false, type: step.type, error: err.message });
      }
    }
    return { success: true, results };
  });

  // —— File System (本地文件操作) ——
  /** 展开路径中的 ~ 为 home 目录 */
  function resolvePath(p: string): string {
    if (p.startsWith("~")) {
      return path.join(app.getPath("home"), p.slice(1));
    }
    return path.resolve(p);
  }

  /** 检查某项权限是否允许 — 默认全部允许 */
  function hasPermission(perm: string): boolean {
    try {
      const raw = dbSettings.get("permissions");
      if (!raw) return true;
      const perms = JSON.parse(raw);
      return perms[perm] !== false;
    } catch { return true; }
  }

  ipcMain.handle("file:read", async (_e, filePath: string) => {
    if (!hasPermission("fileRead")) return { success: false, error: "文件读取权限已被关闭，请在设置中开启" };
    try {
      const home = app.getPath("home");
      const resolved = resolvePath(filePath);
      // Security: only allow files within user's home directory and allowed paths
      if (!resolved.startsWith(home) && !resolved.startsWith(app.getPath("userData")) && !resolved.startsWith("/tmp")) {
        return { success: false, error: "不允许访问该路径（仅限于家目录内）" };
      }
      if (!fs.existsSync(resolved)) {
        return { success: false, error: "文件不存在: " + resolved };
      }
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        return { success: false, error: "这是一个目录，请使用 file:list" };
      }
      const content = fs.readFileSync(resolved, "utf-8");
      return { success: true, content, path: resolved, size: stat.size };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("file:write", async (_e, filePath: string, content: string) => {
    if (!hasPermission("fileWrite")) return { success: false, error: "文件写入权限已被关闭" };
    try {
      const home = app.getPath("home");
      const resolved = resolvePath(filePath);
      if (!resolved.startsWith(home) && !resolved.startsWith(app.getPath("userData"))) {
        return { success: false, error: "不允许写入该路径" };
      }
      const dir = path.dirname(resolved);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(resolved, content, "utf-8");
      return { success: true, path: resolved };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

    ipcMain.handle("file:trash", async (_e, filePath: string) => {
    if (!hasPermission("fileDelete")) return { success: false, error: "文件删除权限已被关闭" };
    try {
      const home = app.getPath("home");
      const resolved = resolvePath(filePath);
      if (!resolved.startsWith(home) && !resolved.startsWith(app.getPath("userData"))) {
        return { success: false, error: "不允许操作该路径" };
      }
      if (!fs.existsSync(resolved)) {
        return { success: false, error: "文件不存在: " + resolved };
      }
      const { shell } = require("electron");
      await shell.trashItem(resolved);
      return { success: true, path: resolved };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("file:delete", async (_e, filePath: string) => {
    if (!hasPermission("fileDelete")) return { success: false, error: "文件删除权限已被关闭" };
    try {
      const home = app.getPath("home");
      const resolved = resolvePath(filePath);
      if (!resolved.startsWith(home) && !resolved.startsWith(app.getPath("userData"))) {
        return { success: false, error: "不允许删除该路径" };
      }
      if (!fs.existsSync(resolved)) {
        return { success: false, error: "文件不存在: " + resolved };
      }
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        fs.rmSync(resolved, { recursive: true });
      } else {
        fs.unlinkSync(resolved);
      }
      return { success: true, path: resolved };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("file:list", async (_e, dirPath: string) => {
    try {
      const home = app.getPath("home");
      const resolved = resolvePath(dirPath);
      if (!resolved.startsWith(home) && !resolved.startsWith(app.getPath("userData")) && resolved !== "/tmp") {
        return { success: false, error: "不允许访问该路径" };
      }
      if (!fs.existsSync(resolved)) {
        return { success: false, error: "目录不存在" };
      }
      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      const items = entries.map((entry) => ({
        name: entry.name,
        path: path.join(resolved, entry.name),
        isDirectory: entry.isDirectory(),
        isFile: entry.isFile(),
        size: entry.isFile() ? fs.statSync(path.join(resolved, entry.name)).size : 0,
      }));
      return { success: true, path: resolved, items };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("file:select", async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile", "multiSelections"],
        filters: [
          { name: "所有文件", extensions: ["*"] },
          { name: "代码", extensions: ["ts", "tsx", "js", "jsx", "py", "rs", "go", "java", "c", "cpp"] },
          { name: "文档", extensions: ["md", "txt", "json", "yaml", "yml", "toml"] },
          { name: "图片", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] },
        ],
      });
      if (result.canceled || !result.filePaths.length) {
        return { success: false, canceled: true };
      }
      return { success: true, paths: result.filePaths };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("file:selectDir", async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
      });
      if (result.canceled || !result.filePaths.length) {
        return { success: false, canceled: true };
      }
      return { success: true, path: result.filePaths[0] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // —— Enhanced Tab Operations ——
  ipcMain.handle("tab:screenshot", async (_e, tabId: string) => {
    if (!hasPermission("tabScreenshot")) return { success: false, error: "截图权限已被关闭" };
    try {
      const wcId = tabWebContents.get(tabId);
      if (!wcId) return { success: false, error: "tab not found" };
      const wc = webContents.fromId(wcId);
      if (!wc || wc.isDestroyed()) return { success: false, error: "webview destroyed" };
      const img = await wc.capturePage();
      const base64 = img.toDataURL();
      return { success: true, screenshot: base64 };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("tab:getPageInfo", async (_e, tabId: string) => {
    if (!hasPermission("tabExtract")) return { success: false, error: "页面内容提取权限已被关闭" };
    try {
      const wcId = tabWebContents.get(tabId);
      if (!wcId) return { success: false, error: "tab not found" };
      const wc = webContents.fromId(wcId);
      if (!wc || wc.isDestroyed()) return { success: false, error: "webview destroyed" };
      const [title, url, html, text] = await Promise.all([
        wc.executeJavaScript("document.title").catch(() => ""),
        wc.executeJavaScript("window.location.href").catch(() => ""),
        wc.executeJavaScript("document.documentElement.outerHTML").catch(() => ""),
        wc.executeJavaScript("document.body.innerText").catch(() => ""),
      ]);
      return { success: true, title, url, html: html?.slice(0, 50000), text: text?.slice(0, 20000) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("tab:highlight", async (_e, tabId: string, selector: string) => {
    try {
      const wcId = tabWebContents.get(tabId);
      if (!wcId) return { success: false, error: "tab not found" };
      const wc = webContents.fromId(wcId);
      if (!wc || wc.isDestroyed()) return { success: false, error: "webview destroyed" };
      await wc.executeJavaScript(`
        (() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return false;
          el.style.outline = "3px solid #ff0000";
          el.style.outlineOffset = "2px";
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => { el.style.outline = ""; el.style.outlineOffset = ""; }, 2000);
          return true;
        })()
      `);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // —— Knowledge Bridge (知识库增强) ——
  ipcMain.handle("knowledge:search", async (_e, query: string) => {
    return searchKnowledge(query);
  });
  ipcMain.handle("knowledge:context", async (_e, query: string) => {
    return buildKnowledgeContext(query);
  });
  ipcMain.handle("knowledge:autoDetect", async (_e) => {
    const active = tabManager.getActive();
    if (!active) return [];
    const wcId = tabWebContents.get(active.id);
    let pageContent = "";
    if (wcId) {
      const wc = webContents.fromId(wcId);
      if (wc && !wc.isDestroyed()) {
        try {
          pageContent = await wc.executeJavaScript("document.body.innerText", true);
        } catch {}
      }
    }
    const items = await autoDetectKnowledge(active.title, active.url, pageContent);
    // Cache results
    for (const item of items) {
      knowledgeCache.add(item.title, item.content.slice(0, 500), item.source, "");
    }
    return items;
  });
  ipcMain.handle("knowledge:cache", () => knowledgeCache.all());

  // —— Research Agent (自主调研) ——
  ipcMain.handle("research:start", async (_e, query: string) => {
    const agent = new ResearchAgent();
    const agentId = generateAgentId();
    activeAgents.set(agentId, agent);
    // Start research in background
    agent.research(query).then(report => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send("research:done", { agentId, report, logs: agent.getLogs() });
      }
    }).catch(err => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send("research:done", { agentId, error: err.message });
      }
    });
    return { agentId, message: "调研已启动" };
  });
  ipcMain.handle("research:status", async (_e, agentId: string) => {
    const agent = activeAgents.get(agentId);
    if (!agent) return { error: "Agent not found" };
    return { logs: agent.getLogs(), report: agent.getReport() };
  });

  // —— Omnibox (全能输入框) ——
  ipcMain.handle("omnibox:suggest", async (_e, input: string) => {
    const suggestions: Array<{ type: string; label: string; value: string }> = [];
    const trimmed = input.trim();

    // URL detection
    if (trimmed.includes(".") && !trimmed.includes(" ")) {
      const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
      suggestions.push({ type: "url", label: `🌐 访问 ${trimmed}`, value: url });
    }

    // @ references
    if (trimmed.startsWith("@")) {
      const ref = trimmed.slice(1).toLowerCase();
      // @tab: search open tabs
      const allTabs = tabManager.getAll();
      for (const t of allTabs) {
        if (t.title.toLowerCase().includes(ref) || t.url.toLowerCase().includes(ref)) {
          suggestions.push({ type: "@tab", label: `📄 ${t.title.slice(0, 40)}`, value: `@tab:${t.id}` });
        }
      }
      // @clip: search clippings
      if (ref.length > 0) {
        const clips = clippings.search(ref);
        for (const c of clips.slice(0, 5)) {
          suggestions.push({ type: "@clip", label: `📎 ${c.source_title.slice(0, 40)}`, value: `@clip:${c.id}` });
        }
      }
      // @kb: search knowledge base
      if (ref.length > 0) {
        const kbItems = await searchKnowledge(ref);
        for (const k of kbItems.slice(0, 3)) {
          suggestions.push({ type: "@kb", label: `🧠 ${k.title.slice(0, 40)}`, value: `@kb:${k.title}` });
        }
      }
    }

    // /commands
    if (trimmed.startsWith("/")) {
      const cmd = trimmed.slice(1).toLowerCase();
      const allPrompts = prompts.all();
      for (const p of allPrompts) {
        if (p.name.toLowerCase().includes(cmd)) {
          suggestions.push({ type: "/prompt", label: `⚡ ${p.name}: ${p.description}`, value: p.prompt });
        }
      }
      // Built-in commands
      if ("research".includes(cmd)) {
        suggestions.push({ type: "/research", label: "🔬 启动自主调研", value: "/research" });
      }
      if ("snapshot".includes(cmd)) {
        suggestions.push({ type: "/snapshot", label: "📸 保存浏览快照", value: "/snapshot" });
      }
      if ("clip".includes(cmd)) {
        suggestions.push({ type: "/clip", label: "📎 收藏当前页面", value: "/clip" });
      }
      if ("timeline".includes(cmd)) {
        suggestions.push({ type: "/timeline", label: "🕰️ 浏览时间线", value: "/timeline" });
      }
    }

    // Search suggestions (when it's a general query)
    if (!trimmed.startsWith("@") && !trimmed.startsWith("/") && !trimmed.includes(".") && trimmed.length > 1) {
      suggestions.push({ type: "search", label: `🔍 搜索: ${trimmed}`, value: `search:${trimmed}` });
      suggestions.push({ type: "ask", label: `🤖 AI 提问: ${trimmed}`, value: `ask:${trimmed}` });
    }

    return suggestions.slice(0, 10);
  });

  // —— Cleanup on window close ——
  mainWindow.on("closed", () => {
    taskScheduler.stop();
    closeDb();
  });

  // Connect scheduler to main window
  taskScheduler.setMainWindow(mainWindow);
  taskScheduler.start();
}
