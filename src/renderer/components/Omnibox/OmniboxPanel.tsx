import { useState, useRef, useEffect, useCallback } from "react";

interface Suggestion {
  type: string;
  label: string;
  value: string;
}

interface OmniboxPanelProps {
  onClose: () => void;
  onNavigate: (url: string) => void;
  onSearch: (query: string) => void;
  onAiAsk: (query: string) => void;
  onExecutePrompt: (text: string) => void;
}

export default function OmniboxPanel({ onClose, onNavigate, onSearch, onAiAsk, onExecutePrompt }: OmniboxPanelProps) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const fetchSuggestions = useCallback(async (text: string) => {
    if (!text.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const results = await window.tabby.omnibox.suggest(text);
      setSuggestions(results || []);
      setSelectedIndex(0);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 150);
  };

  const executeAction = (value: string) => {
    if (value.startsWith("https://") || value.startsWith("http://") || value.startsWith("file://")) {
      onNavigate(value);
      onClose();
    } else if (value.startsWith("search:")) {
      onSearch(value.slice(7));
      onClose();
    } else if (value.startsWith("ask:")) {
      onAiAsk(value.slice(4));
      onClose();
    } else if (value.startsWith("@tab:")) {
      const tabId = value.slice(5);
      window.tabby.tab.switch(tabId);
      onClose();
    } else if (value.startsWith("@clip:")) {
      onAiAsk(`帮我查看这个收藏片段: ${value}`);
      onClose();
    } else if (value.startsWith("/research")) {
      onAiAsk("启动自主调研模式：请帮我规划并执行一个调研任务");
      onClose();
    } else if (value.startsWith("/snapshot")) {
      window.tabby.timeline.save(`手动快照 ${new Date().toLocaleString("zh-CN")}`);
      setInput("");
      onClose();
    } else if (value.startsWith("/clip")) {
      // Will be handled by caller
      onClose();
    } else if (value.startsWith("/timeline")) {
      onClose();
    } else if (value.startsWith("@kb:")) {
      const kbQuery = value.slice(4);
      onAiAsk(`关于"${kbQuery}"我已有的知识点有哪些？`);
      onClose();
    } else if (value.startsWith("/")) {
      // Execute as prompt command
      onExecutePrompt(value);
      onClose();
    } else {
      // Default: AI ask
      onAiAsk(value);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && !(e as any).nativeEvent?.isComposing) {
      e.preventDefault();
      if (suggestions.length > 0 && selectedIndex >= 0) {
        executeAction(suggestions[selectedIndex].value);
      } else if (input.trim()) {
        // Enter with no suggestions — treat as URL or search
        const trimmed = input.trim();
        if (trimmed.includes(".") && !trimmed.includes(" ")) {
          const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
          onNavigate(url);
        } else {
          onAiAsk(trimmed);
        }
        onClose();
      }
    } else if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      executeAction(suggestions[0].value);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div
        className="w-[680px] max-w-[90vw] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <span className="text-lg text-gray-400 shrink-0">
            {input.startsWith("/") ? "⚡" : input.startsWith("@") ? "@" : input.includes(".") ? "🌐" : "🤖"}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="输入网址、搜索关键词、提问、或使用 / 命令..."
            className="flex-1 text-base bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-zinc-500 outline-none"
          />
          {input && (
            <button
              onClick={() => { setInput(""); setSuggestions([]); }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg"
            >
              ✕
            </button>
          )}
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="max-h-80 overflow-y-auto p-2">
            {suggestions.map((s, i) => (
              <div
                key={`${s.type}-${i}`}
                onClick={() => executeAction(s.value)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all ${
                  i === selectedIndex
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                }`}
              >
                <span className="text-sm flex-1 truncate">{s.label}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0 ${
                  s.type === "url" ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400" :
                  s.type.startsWith("@") ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400" :
                  s.type.startsWith("/") ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400" :
                  s.type === "search" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" :
                  "bg-gray-100 dark:bg-zinc-700 text-gray-500"
                }`}>
                  {s.type}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Quick tips */}
        {!input && (
          <div className="px-5 py-4 space-y-2">
            <div className="text-xs text-gray-400 dark:text-zinc-500 flex items-center gap-2">
              <span className="font-semibold text-gray-500 dark:text-zinc-400">快速操作：</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "/research", label: "🔬 自主调研" },
                { key: "/snapshot", label: "📸 保存快照" },
                { key: "/timeline", label: "🕰️ 时间线" },
                { key: "/clip", label: "📎 收藏页面" },
                { key: "任意关键词", label: "🤖 AI 问答" },
              ].map((tip) => (
                <button
                  key={tip.key}
                  onClick={() => { setInput(tip.key + " "); inputRef.current?.focus(); }}
                  className="px-3 py-1.5 text-xs rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  {tip.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
