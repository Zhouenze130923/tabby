import { useRef, useCallback, useEffect } from "react";
import { useTabStore } from "../../stores/tabStore";
import NewTabPage from "./NewTabPage";

export default function WebView({ onAiSearch }: { onAiSearch?: (query: string) => void }) {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const updateTab = useTabStore((s) => s.updateTab);
  const webviewRefs = useRef<Map<string, WebviewTag>>(new Map());
  // 记录上一次我们主动设置的 URL，用于：① 判断导航来源 ② 避免重复赋值
  const lastSetUrl = useRef<Map<string, string>>(new Map());
  /** 为 webview 绑定事件监听 */
  const setupWebview = useCallback(
    (tabId: string, wv: WebviewTag) => {
      const onNavigate = (e: WebviewNavigateEvent) => {
        const currentUrl = e.url;
        const prevSet = lastSetUrl.current.get(tabId);

        if (currentUrl === prevSet) {
          // 我们主动触发的导航 — 不重复更新 store
          return;
        }

        // 用户点击链接等自发导航 — 更新 store 并静默同步主进程
        updateTab(tabId, { url: currentUrl });
        lastSetUrl.current.set(tabId, currentUrl);
        window.tabby.tab.updateMeta(tabId, { url: currentUrl });
      };

      const onStartLoading = () => {
        updateTab(tabId, { isLoading: true });
      };

      const onStopLoading = () => {
        updateTab(tabId, { isLoading: false });
      };

      const onTitleUpdated = (e: WebviewTitleEvent) => {
        updateTab(tabId, { title: e.title });
        window.tabby.tab.updateMeta(tabId, { title: e.title });
      };

      const onFaviconUpdated = (e: WebviewFaviconEvent) => {
        if (e.favicons.length > 0) {
          updateTab(tabId, { favicon: e.favicons[0] });
          window.tabby.tab.updateMeta(tabId, { favicon: e.favicons[0] });
        }
      };

      const onNewWindow = (e: any) => {
        // 点击 target=_blank 或中键打开链接时，在 Pivot 中创建新标签页
        const url = e.url || "";
        if (url) window.tabby.tab.create(url);
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
    },
    [updateTab]
  );

  /** ref 回调：注册/注销 webview */
  const setWebviewRef = useCallback(
    (tabId: string) => (el: WebviewTag | null) => {
      if (el) {
        webviewRefs.current.set(tabId, el);
        // 标记初始 URL（来自 JSX 的 src 属性），避免 useEffect 重复赋值
        lastSetUrl.current.set(tabId, el.src || "about:blank");
        setupWebview(tabId, el);
        // 注册 webContentsId 到主进程（用于提取页面内容）
        try {
          const wcId = (el as any).getWebContentsId?.();
          if (wcId) window.tabby.tab.registerWebview(tabId, wcId);
        } catch {}
      } else {
        const wv = webviewRefs.current.get(tabId);
        if (wv && (wv as any).__tabby_cleanup) {
          (wv as any).__tabby_cleanup();
        }
        webviewRefs.current.delete(tabId);
        lastSetUrl.current.delete(tabId);
      }
    },
    [setupWebview]
  );

  /** 当 tab URL 由外部（AddressBar）变更时，同步到 webview */
  useEffect(() => {
    tabs.forEach((tab) => {
      const wv = webviewRefs.current.get(tab.id);
      if (!wv) return;
      const prevSet = lastSetUrl.current.get(tab.id);
      // 只有 URL 确实变化且非 about:blank 时才更新 webview
      // about:blank 的初始加载由 JSX src 属性处理，这里不重复赋值
      if (tab.url && tab.url !== prevSet && tab.url !== "about:blank") {
        lastSetUrl.current.set(tab.id, tab.url);
        try { wv.loadURL(tab.url); } catch { wv.src = tab.url; }
      }
    });
  }, [tabs]);

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
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <webview
            key={tab.id}
            data-tab-id={tab.id}
            ref={setWebviewRef(tab.id)}
            src={tab.url}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              display: isActive ? "flex" : "none",
            }}
          />
        );
      })}
    </div>
  );
}
