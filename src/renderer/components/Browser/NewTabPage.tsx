import { useState, useEffect } from "react";
import { Search } from "lucide-react";

interface NewTabPageProps {
  onAiSearch?: (query: string) => void;
}

export default function NewTabPage({ onAiSearch }: NewTabPageProps) {
  const [query, setQuery] = useState("");
  const [providerName, setProviderName] = useState("");

  useEffect(() => {
    window.tabby.settings.get().then((s) => {
      setProviderName(s?.defaultProvider || "deepseek");
    });
  }, []);

  const handleSearch = () => {
    if (!query.trim()) return;
    onAiSearch?.(query.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-0" style={{ background: "var(--pivot-ui-bg)" }}>
      <div className="w-full max-w-2xl px-6 -mt-16">
        {/* Logo / Title */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-4">🦊</div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            Pivot
          </h1>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-2">
            AI 原生浏览器 · 深度搜索
          </p>
        </div>

        {/* Search Box */}
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="relative flex items-center bg-white dark:bg-zinc-800 rounded-2xl shadow-lg shadow-gray-200/50 dark:shadow-black/20 border border-gray-200 dark:border-zinc-700 group-focus-within:ring-2 group-focus-within:accent-ring group-focus-within:accent-border transition-all">
            <div className="pl-5 pr-3 text-gray-400">
              <Search size={20} />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入任何问题，AI 帮你搜索全网..."
              spellCheck={false}
              autoFocus
              className="flex-1 h-14 bg-transparent text-base text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-zinc-500 outline-none"
            />
            <div className="pr-3 flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-gray-400 dark:text-zinc-500">
                Enter 搜索
              </span>
              <button
                onClick={handleSearch}
                disabled={!query.trim()}
                className="px-4 py-2 accent-bg accent-bg-hover\/90 accent-bg-disabled text-white text-sm font-medium rounded-xl transition-colors disabled:cursor-not-allowed"
              >
                深度搜索
              </button>
            </div>
          </div>
        </div>

        {/* Quick suggestions */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {[
            "今天的热点新闻",
            "DeepSeek V4 最新功能",
            "AI 编程工具对比",
            "本周科技要闻",
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => {
                setQuery(suggestion);
                onAiSearch?.(suggestion);
              }}
              className="px-3.5 py-1.5 text-xs text-gray-500 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Provider info */}
        <p className="text-center text-xs text-gray-300 dark:text-zinc-600 mt-10">
          当前 AI 模型：{providerName || "未配置，请在设置中添加 API Key"}
        </p>
      </div>
    </div>
  );
}
