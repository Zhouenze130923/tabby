import { useState, useCallback, useRef, useEffect } from "react";
import { useTabStore } from "../../stores/tabStore";
import NavControls from "./NavControls";

// 搜索引擎配置
const SEARCH_ENGINES: Record<string, string> = {
  google: "https://www.google.com/search?q=",
  bing: "https://www.bing.com/search?q=",
  baidu: "https://www.baidu.com/s?wd=",
};

function guessUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed) && !/\s/.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return ""; // 不是 URL，走 AI 搜索
}

export default function AddressBar({ onAiSearch }: { onAiSearch?: (query: string) => void }) {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const activeTab = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [searchMode, setSearchMode] = useState<string>("ai-deep");
  const inputRef = useRef<HTMLInputElement>(null);

  // 加载搜索模式设置
  useEffect(() => {
    window.tabby.settings.get().then((s) => {
      if (s?.searchEngine) setSearchMode(s.searchEngine);
    });
  }, []);

  // 当 activeTab URL 变化时同步到输入框（非聚焦状态下）
  useEffect(() => {
    if (!isFocused && activeTab) {
      setInputValue(activeTab.url === "about:blank" ? "" : activeTab.url);
    }
  }, [activeTab?.url, isFocused]);

  const handleNavigate = useCallback(() => {
    if (!activeTabId || !inputValue.trim()) return;
    const url = guessUrl(inputValue);
    
    // 如果是 URL，直接导航
    if (url) {
      window.tabby.tab.navigate(activeTabId, url);
      inputRef.current?.blur();
      return;
    }
    
    // 否则根据搜索模式处理
    const query = inputValue.trim();
    
    if (searchMode === "ai-deep" || searchMode === "ai-quick") {
      // AI 搜索 — 打开侧边栏，发送查询
      onAiSearch?.(query);
      inputRef.current?.blur();
      return;
    }
    
    // 传统搜索引擎
    const engineUrl = SEARCH_ENGINES[searchMode] || SEARCH_ENGINES.google;
    window.tabby.tab.navigate(activeTabId, engineUrl + encodeURIComponent(query));
    inputRef.current?.blur();
  }, [activeTabId, inputValue, searchMode, onAiSearch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleNavigate();
    if (e.key === "Escape") {
      setInputValue(activeTab?.url === "about:blank" ? "" : activeTab?.url || "");
      inputRef.current?.blur();
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    inputRef.current?.select();
  };

  return (
    <div className="flex items-center h-10 px-3 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 shrink-0 gap-2">
      <NavControls tabId={activeTabId} />
      <div
        className={`
          flex-1 flex items-center h-7 px-3 rounded-full text-xs transition-colors
          ${
            isFocused
              ? "bg-white dark:bg-zinc-800 ring-2 accent-ring"
              : "bg-gray-100 dark:bg-zinc-800"
          }
        `}
      >
        {!isFocused && activeTab?.isLoading && (
          <span className="w-3 h-3 mr-2 border-2 accent-spin rounded-full animate-spin shrink-0" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={() => setIsFocused(false)}
          placeholder="搜索或输入网址"
          spellCheck={false}
          className="flex-1 bg-transparent outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400 min-w-0"
        />
      </div>
    </div>
  );
}
