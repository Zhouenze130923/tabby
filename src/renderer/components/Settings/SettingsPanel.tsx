import { useState, useEffect, useCallback } from "react";
import ProviderConfig from "./ProviderConfig";
import ImportPanel from "../Import/ImportPanel";
import { X, Key, SlidersHorizontal, Info, Search, Download, Shield } from "lucide-react";

type Tab = "apiKeys" | "search" | "general" | "permissions" | "about" | "import";

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
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
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

  // 加载权限设置
  useEffect(() => {
    window.tabby.settings.get().then((s: any) => {
      const saved = s.permissions;
      if (saved) {
        setPermissions(typeof saved === "string" ? JSON.parse(saved) : saved);
      }
    });
  }, []);

  const togglePermission = (key: string) => {
    const next = { ...permissions, [key]: !permissions[key] };
    setPermissions(next);
    window.tabby.settings.set("permissions", JSON.stringify(next));
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "apiKeys", label: "API Keys", icon: <Key size={16} /> },
    { id: "search", label: "搜索", icon: <Search size={16} /> },
    { id: "general", label: "通用", icon: <SlidersHorizontal size={16} /> },
    { id: "permissions", label: "权限", icon: <Shield size={16} /> },
    { id: "about", label: "关于", icon: <Info size={16} /> },
    { id: "import", label: "导入", icon: <Download size={16} /> },
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

          {activeTab === "permissions" && (
            <div className="space-y-4">
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Shield size={16} className="text-green-500" />
                AI 权限控制
              </h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                控制 AI 可以执行哪些操作。关闭后 AI 调用的相关命令将被静默忽略。
              </p>
              <div className="space-y-3">
                {[
                  { key: "fileRead", label: "读取文件", desc: "AI 可以读取家目录中的文件内容" },
                  { key: "fileWrite", label: "写入文件", desc: "AI 可以创建和修改文件" },
                  { key: "fileDelete", label: "删除文件", desc: "AI 可以删除文件和目录" },
                  { key: "tabControl", label: "操控标签页", desc: "AI 可以打开/关闭/导航标签页" },
                  { key: "tabExtract", label: "提取页面内容", desc: "AI 可以读取当前网页的文本和HTML" },
                  { key: "tabScreenshot", label: "截图", desc: "AI 可以对标签页截图" },
                  { key: "tabExecute", label: "执行JS", desc: "AI 可以在页面中执行 JavaScript" },
                  { key: "webSearch", label: "联网搜索", desc: "AI 可以联网搜索信息" },
                ].map((p) => (
                  <div key={p.key} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-zinc-800/70 border border-gray-100 dark:border-zinc-700">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{p.label}</span>
                        <span className={"text-[10px] px-1.5 py-0.5 rounded-full " + (permissions[p.key] !== false ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" : "bg-gray-200 dark:bg-zinc-700 text-gray-500")}>
                          {permissions[p.key] !== false ? "允许" : "禁止"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{p.desc}</p>
                    </div>
                    <button
                      onClick={() => togglePermission(p.key)}
                      className={"relative w-11 h-6 rounded-full transition-colors shrink-0 " + (permissions[p.key] !== false ? "accent-bg" : "bg-gray-300 dark:bg-zinc-600")}
                    >
                      <span className={"absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform " + (permissions[p.key] !== false ? "translate-x-5" : "")} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 dark:text-zinc-600 italic">
                💡 默认全部允许。所有操作仅限于家目录内的文件。
              </p>
            </div>
          )}

          {activeTab === "import" && (
            <div>
              <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">
                从其他浏览器导入书签
              </h3>
              <ImportPanel />
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
                Pivot — AI 原生浏览器。自备 API Key，数据全本地存储。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
