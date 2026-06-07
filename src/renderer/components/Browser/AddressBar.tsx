import { useState } from "react";
import OmniboxPanel from "../Omnibox/OmniboxPanel";

interface AddressBarProps {
  onAiSearch: (query: string) => void;
  onAiAsk?: (query: string) => void;
  onOpenOmnibox?: () => void;
}

export default function AddressBar({ onAiSearch, onAiAsk }: AddressBarProps) {
  const [showOmnibox, setShowOmnibox] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");

  const handleNavigate = (url: string) => {
    setCurrentUrl(url);
    // Navigate active tab to URL
    window.tabby.tab.getAllInfo().then(tabs => {
      const active = tabs.find(t => t.isActive);
      if (active) {
        window.tabby.tab.navigate(active.id, url);
      } else {
        window.tabby.tab.create(url);
      }
    });
  };

  const handleSearch = (query: string) => {
    // Perform web search in a new tab
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.tabby.tab.create(searchUrl);
  };

  const handleAiAsk = (query: string) => {
    onAiAsk?.(query);
    onAiSearch(query);
  };

  const handleOmniboxExecutePrompt = (text: string) => {
    onAiSearch(text);
  };

  return (
    <>
      {/* Omnibox trigger — click anywhere on the bar */}
      <div
        onClick={() => setShowOmnibox(true)}
        className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 cursor-text group"
      >
        {/* Icon */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-sm">🔍</span>
        </div>

        {/* Placeholder / URL display */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {currentUrl ? (
            <span className="text-sm text-gray-600 dark:text-gray-400 truncate">{currentUrl}</span>
          ) : (
            <span className="text-sm text-gray-400 dark:text-zinc-500">
              输入网址、搜索关键词、提问、或使用 <kbd className="px-1 py-0.5 text-xs rounded bg-gray-100 dark:bg-zinc-800 font-mono">/</kbd> 命令...
            </span>
          )}
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {[
            { icon: "🔬", label: "调研", action: () => onAiAsk?.("/research") },
            { icon: "📸", label: "快照", action: () => { window.tabby.timeline.save(`快照 ${new Date().toLocaleString("zh-CN")}`); } },
            { icon: "📎", label: "收藏", action: () => { onAiAsk?.("/clip 收藏当前页面"); } },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={(e) => { e.stopPropagation(); btn.action(); }}
              className="px-2 py-1 text-xs rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              title={btn.label}
            >
              {btn.icon}
            </button>
          ))}
        </div>

        {/* Search or Go button */}
        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-400 font-mono shrink-0">
          {navigator?.platform?.includes("Mac") ? "⌘K" : "Ctrl+K"}
        </kbd>
      </div>

      {/* Omnibox overlay */}
      {showOmnibox && (
        <OmniboxPanel
          onClose={() => setShowOmnibox(false)}
          onNavigate={handleNavigate}
          onSearch={handleSearch}
          onAiAsk={handleAiAsk}
          onExecutePrompt={handleOmniboxExecutePrompt}
        />
      )}
    </>
  );
}
