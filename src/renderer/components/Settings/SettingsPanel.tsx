import { useState, useEffect, useCallback } from "react";
import ProviderConfig from "./ProviderConfig";
import { X, Key, SlidersHorizontal, Info, Search } from "lucide-react";

type Tab = "apiKeys" | "search" | "general" | "about";

const PROVIDER_META: Record<
  string,
  { label: string; defaultModel: string; defaultBaseUrl: string }
> = {
  deepseek: {
    label: "DeepSeek",
    defaultModel: "deepseek-v4-flash",
    defaultBaseUrl: "https://api.deepseek.com",
  },
  claude: {
    label: "Claude",
    defaultModel: "claude-sonnet-4-6",
    defaultBaseUrl: "https://api.anthropic.com",
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o",
    defaultBaseUrl: "https://api.openai.com/v1",
  },
};

interface SettingsPanelProps {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("apiKeys");
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [providers, setProviders] = useState<Record<string, any>>({});
  const [defaultProvider, setDefaultProvider] = useState("deepseek");
  const [theme, setTheme] = useState("system");
  const [searchEngine, setSearchEngine] = useState("ai-deep");
  const [searchConfig, setSearchConfig] = useState<SearchConfig>({ provider: "tavily", tavilyApiKey: "", searxngUrl: "http://localhost:8888" });
  const [version] = useState("0.1.0");
  const [dataPath, setDataPath] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      const settings = await window.tabby.settings.get();
      if (settings?.providers) setProviders(settings.providers);
      if (settings?.defaultProvider) setDefaultProvider(settings.defaultProvider);
      if (settings?.theme) setTheme(settings.theme);
      if (settings?.searchEngine) setSearchEngine(settings.searchEngine);
      // 加载搜索后端配置
      const sc = await window.tabby.search.getConfig();
      setSearchConfig(sc);
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleProviderSave = async (name: string, config: { apiKey: string; model: string; baseUrl?: string }) => {
    try {
      await window.tabby.settings.setProvider(name, config);
      setProviders((prev) => ({ ...prev, [name]: config }));
      setEditingProvider(null);
    } catch (err) {
      console.error("Failed to save provider config:", err);
    }
  };

  const handleGeneralChange = async (key: string, value: string) => {
    try {
      await window.tabby.settings.set(key, value);
    } catch (err) {
      console.error("Failed to save setting:", err);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "apiKeys", label: "API Keys", icon: <Key size={16} /> },
    { id: "search", label: "搜索", icon: <Search size={16} /> },
    { id: "general", label: "通用", icon: <SlidersHorizontal size={16} /> },
    { id: "about", label: "关于", icon: <Info size={16} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[600px] max-h-[80vh] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">设置</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-zinc-700 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "accent-border accent-text accent-text-dark accent-border-dark"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "apiKeys" && (
            <div className="space-y-6">
              {editingProvider ? (
                <div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">
                    配置 {PROVIDER_META[editingProvider]?.label || editingProvider}
                  </h3>
                  <ProviderConfig
                    name={editingProvider}
                    label={PROVIDER_META[editingProvider]?.label || editingProvider}
                    defaultModel={PROVIDER_META[editingProvider]?.defaultModel || "gpt-4o"}
                    defaultBaseUrl={PROVIDER_META[editingProvider]?.defaultBaseUrl}
                    showBaseUrl={editingProvider !== "claude"}
                    onSave={(config) => handleProviderSave(editingProvider, config)}
                    onCancel={() => setEditingProvider(null)}
                    initialConfig={providers[editingProvider]}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(PROVIDER_META).map(([name, meta]) => {
                    const configured = providers[name]?.apiKey;
                    return (
                      <div
                        key={name}
                        className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-200 dark:border-zinc-700"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {meta.label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {configured
                              ? `已配置 · ${providers[name]?.model || meta.defaultModel}`
                              : "未配置"}
                          </div>
                        </div>
                        <button
                          onClick={() => setEditingProvider(name)}
                          className="px-3 py-1.5 rounded-lg accent-bg text-white text-xs accent-bg-hover\/90 transition-colors"
                        >
                          {configured ? "编辑" : "配置"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "search" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  联网搜索后端
                </label>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
                  选择搜索后端，地址栏的 AI 深度搜索将使用真实联网检索结果 + AI 综合回答
                </p>
                <select
                  value={searchConfig?.provider || "tavily"}
                  onChange={(e) => {
                    const newConfig = { ...searchConfig, provider: e.target.value };
                    setSearchConfig(newConfig);
                    window.tabby.search.saveConfig(newConfig);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-sm mb-4"
                >
                  <option value="tavily">Tavily — AI 优化搜索引擎（需 API Key）</option>
                  <option value="searxng">SearXNG — 自建元搜索引擎</option>
                </select>

                {searchConfig?.provider === "tavily" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tavily API Key
                    </label>
                    <input
                      type="password"
                      value={searchConfig?.tavilyApiKey || ""}
                      onChange={(e) => {
                        const newConfig = { ...searchConfig, tavilyApiKey: e.target.value };
                        setSearchConfig(newConfig);
                        window.tabby.search.saveConfig(newConfig);
                      }}
                      placeholder="tvly-..."
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">
                      <a href="https://tavily.com" target="_blank" className="accent-text hover:underline">tavily.com</a> 注册获取免费额度
                    </p>
                  </div>
                )}

                {searchConfig?.provider === "searxng" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      SearXNG 地址
                    </label>
                    <input
                      type="text"
                      value={searchConfig?.searxngUrl || "http://localhost:8888"}
                      onChange={(e) => {
                        const newConfig = { ...searchConfig, searxngUrl: e.target.value };
                        setSearchConfig(newConfig);
                        window.tabby.search.saveConfig(newConfig);
                      }}
                      placeholder="http://localhost:8888"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-sm"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">
                      ⚠️ 需要先部署 SearXNG 实例
                    </p>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-100 dark:border-zinc-800 pt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  地址栏搜索方式
                </label>
                <select
                  value={searchEngine}
                  onChange={(e) => {
                    setSearchEngine(e.target.value);
                    handleGeneralChange("searchEngine", e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="ai-deep">🌐 AI 深度搜索 — 联网检索 + AI 综合回答</option>
                  <option value="ai-quick">⚡ AI 快速搜索 — 直接 AI 问答（不联网）</option>
                  <option value="google">🔍 Google 搜索</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === "general" && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  主题
                </label>
                <select
                  value={theme}
                  onChange={(e) => {
                    setTheme(e.target.value);
                    handleGeneralChange("theme", e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-sm"
                >
                  <option value="light">浅色</option>
                  <option value="dark">深色</option>
                  <option value="system">跟随系统</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  默认 AI Provider
                </label>
                <select
                  value={defaultProvider}
                  onChange={(e) => {
                    setDefaultProvider(e.target.value);
                    handleGeneralChange("defaultProvider", e.target.value);
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-sm"
                >
                  {Object.entries(PROVIDER_META).map(([name, meta]) => (
                    <option key={name} value={name}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeTab === "about" && (
            <div className="space-y-4 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-zinc-800">
                <span className="text-gray-500 dark:text-gray-400">应用版本</span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">{version}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-zinc-800">
                <span className="text-gray-500 dark:text-gray-400">数据路径</span>
                <span className="text-gray-900 dark:text-gray-100 font-mono text-xs truncate max-w-[300px]">
                  {dataPath || "~/.tabby-data"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-zinc-800">
                <span className="text-gray-500 dark:text-gray-400">运行时</span>
                <span className="text-gray-900 dark:text-gray-100">Electron + React + SQLite</span>
              </div>
              <p className="text-gray-400 dark:text-gray-500 pt-4 text-xs">
                Tabby — AI 原生浏览器。自备 API Key，数据全本地存储。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
