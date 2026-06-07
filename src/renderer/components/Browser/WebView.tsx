/**
 * WebView — 浏览器页面容器
 * 
 * 使用 webview 池的混合策略：
 * - 最多保留 3 个 webview（活跃 + 2 个最近切换的）
 * - 切回最近使用的标签页时无需重建，秒切
 * - 打开新标签页或切到很久以前的标签页时创建 webview
 * - 内存控制在 3 个渲染进程以内
 */
import { useRef, useCallback, useEffect } from "react";
import { useTabStore } from "../../stores/tabStore";
import NewTabPage from "./NewTabPage";

/** 最多同时保留多少个 webview */
const MAX_WEBVIEWS = 3;

export default function WebView({ onAiSearch }: { onAiSearch?: (query: string) => void }) {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const updateTab = useTabStore((s) => s.updateTab);

  // webview 池: tabId → webview
  const webviewPool = useRef<Map<string, WebviewTag>>(new Map());
  // 最近使用顺序 (最新在前)
  const recentTabs = useRef<string[]>([]);
  // 最后一次设置的 URL (用于判断导航来源)
  const lastSetUrl = useRef<Map<string, string>>(new Map());

  /** 回收多余的 webview */
  const evictIfNeeded = useCallback(() => {
    while (recentTabs.current.length > MAX_WEBVIEWS) {
      const oldest = recentTabs.current.pop();
      if (oldest && oldest !== activeTabId) {
        const wv = webviewPool.current.get(oldest);
        if (wv) {
          if ((wv as any).__tabby_cleanup) (wv as any).__tabby_cleanup();
          try { wv.remove(); } catch {}
          webviewPool.current.delete(oldest);
          lastSetUrl.current.delete(oldest);
        }
      }
    }
  }, [activeTabId]);

  /** 给 webview 绑定事件 */
  const setupWebview = useCallback((tabId: string, wv: WebviewTag) => {
    const onNavigate = (e: WebviewNavigateEvent) => {
      const url = e.url;
      const prevSet = lastSetUrl.current.get(tabId);
      if (url === prevSet) return;
      updateTab(tabId, { url });
      lastSetUrl.current.set(tabId, url);
      window.tabby.tab.updateMeta(tabId, { url });
    };
    const onStartLoading = () => updateTab(tabId, { isLoading: true });
    const onStopLoading = () => updateTab(tabId, { isLoading: false });
    const onTitleUpdated = (e: WebviewTitleEvent) => {
      updateTab(tabId, { title: e.title });
      window.tabby.tab.updateMeta(tabId, { title: e.title });
    };
    const onFaviconUpdated = (e: WebviewFaviconEvent) => {
      if (e.favicons.length > 0) {
        const f = e.favicons[0];
        updateTab(tabId, { favicon: f });
        window.tabby.tab.updateMeta(tabId, { favicon: f });
      }
    };
    const onNewWindow = (e: any) => {
      if (e.url) window.tabby.tab.create(e.url);
    };

    wv.addEventListener("did-navigate", onNavigate);
    wv.addEventListener("did-navigate-in-page", onNavigate);
    wv.addEventListener("did-start-loading", onStartLoading);
    wv.addEventListener("did-stop-loading", onStopLoading);
    wv.addEventListener("page-title-updated", onTitleUpdated);
    wv.addEventListener("page-favicon-updated", onFaviconUpdated);
    wv.addEventListener("new-window", onNewWindow);

    (wv as any).__tabby_cleanup = () => {
      wv.removeEventListener("did-navigate", onNavigate);
      wv.removeEventListener("did-navigate-in-page", onNavigate);
      wv.removeEventListener("did-start-loading", onStartLoading);
      wv.removeEventListener("did-stop-loading", onStopLoading);
      wv.removeEventListener("page-title-updated", onTitleUpdated);
      wv.removeEventListener("page-favicon-updated", onFaviconUpdated);
      wv.removeEventListener("new-window", onNewWindow);
    };
  }, [updateTab]);

  /** 确保活跃标签页的 webview 可见，其余隐藏 */
  const syncWebviewVisibility = useCallback(() => {
    const active = activeTabId;
    for (const [id, wv] of webviewPool.current.entries()) {
      try {
        wv.style.display = id === active ? "flex" : "none";
      } catch {}
    }
  }, [activeTabId]);

  /** 创建或激活一个 webview，返回是否已存在 */
  const ensureWebview = useCallback((tabId: string, url: string): boolean => {
    // 已存在 → 只是显示/隐藏切换，无需重建
    if (webviewPool.current.has(tabId)) {
      syncWebviewVisibility();
      return true;
    }

    // 创建新 webview
    const wv = document.createElement("webview") as WebviewTag;
    wv.setAttribute("data-tab-id", tabId);
    wv.setAttribute("allowpopups", "true");
    wv.src = url || "about:blank";
    wv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";

    const container = document.getElementById("pivot-webview-container");
    if (container) {
      container.appendChild(wv);
    } else {
      // fallback: 直接添加到 body 同级
      const root = document.getElementById("root") || document.body;
      root.appendChild(wv);
    }

    webviewPool.current.set(tabId, wv);
    lastSetUrl.current.set(tabId, url || "about:blank");
    setupWebview(tabId, wv);

    // 注册 webContentsId
    try {
      const wcId = (wv as any).getWebContentsId?.();
      if (wcId) window.tabby.tab.registerWebview(tabId, wcId);
    } catch {}

    syncWebviewVisibility();
    evictIfNeeded();
    return false;
  }, [setupWebview, syncWebviewVisibility, evictIfNeeded]);

  /** 当活跃标签页切换时，更新最近使用列表 */
  useEffect(() => {
    if (!activeTabId) return;

    // 更新最近使用列表
    recentTabs.current = [
      activeTabId,
      ...recentTabs.current.filter((id) => id !== activeTabId),
    ];

    // 如果这个标签页已有 webview，直接切换显示
    if (webviewPool.current.has(activeTabId)) {
      syncWebviewVisibility();
      return;
    }

    // 否则创建
    const tab = tabs.find((t) => t.id === activeTabId);
    if (tab) {
      ensureWebview(activeTabId, tab.url || "about:blank");
    }
  }, [activeTabId, tabs, syncWebviewVisibility, ensureWebview]);

  /** 当 tabs 变化（关闭标签页时清理对应 webview） */
  useEffect(() => {
    const validIds = new Set(tabs.map((t) => t.id));
    for (const [id, wv] of webviewPool.current.entries()) {
      if (!validIds.has(id)) {
        if ((wv as any).__tabby_cleanup) (wv as any).__tabby_cleanup();
        try { wv.remove(); } catch {}
        webviewPool.current.delete(id);
        lastSetUrl.current.delete(id);
        const idx = recentTabs.current.indexOf(id);
        if (idx >= 0) recentTabs.current.splice(idx, 1);
      }
    }
  }, [tabs]);

  /** 外部 URL 更新同步到活跃 webview */
  useEffect(() => {
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || !tab.url) return;
    const wv = webviewPool.current.get(activeTabId);
    if (!wv) return;
    const prevSet = lastSetUrl.current.get(activeTabId);
    if (tab.url !== prevSet && tab.url !== "about:blank") {
      lastSetUrl.current.set(activeTabId, tab.url);
      try { wv.loadURL(tab.url); } catch { wv.src = tab.url; }
    }
  }, [tabs, activeTabId]);

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="text-center">
          <p className="text-gray-400 dark:text-zinc-600 text-sm mb-3">无打开标签页</p>
          <button
            onClick={() => window.tabby.tab.create()}
            className="px-4 py-2 text-sm accent-bg text-white rounded-lg accent-bg-hover transition-colors"
          >
            新建标签页
          </button>
        </div>
      </div>
    );
  }

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const showNewTab = activeTab && (activeTab.url === "about:blank" || activeTab.url === "");

  return (
    <div className="flex-1 relative">
      {showNewTab && (
        <div className="absolute inset-0 z-10 flex" style={{ pointerEvents: "auto" }}>
          <NewTabPage onAiSearch={onAiSearch} />
        </div>
      )}
      <div id="pivot-webview-container" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </div>
  );
}
