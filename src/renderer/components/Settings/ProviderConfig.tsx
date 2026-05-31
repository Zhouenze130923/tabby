import { useState, useEffect } from "react";

interface ProviderConfigProps {
  name: string;
  label: string;
  defaultModel: string;
  defaultBaseUrl?: string;
  showBaseUrl?: boolean;
  onSave: (config: { apiKey: string; model: string; baseUrl?: string }) => void;
  onCancel: () => void;
  initialConfig?: { apiKey?: string; model?: string; baseUrl?: string } | null;
}

export default function ProviderConfig({
  name,
  label,
  defaultModel,
  defaultBaseUrl,
  showBaseUrl = true,
  onSave,
  onCancel,
  initialConfig,
}: ProviderConfigProps) {
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey ?? "");
  const [model, setModel] = useState(initialConfig?.model ?? defaultModel);
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? defaultBaseUrl ?? "");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (initialConfig) {
      setApiKey(initialConfig.apiKey ?? "");
      setModel(initialConfig.model ?? defaultModel);
      setBaseUrl(initialConfig.baseUrl ?? defaultBaseUrl ?? "");
    }
  }, [initialConfig, defaultModel, defaultBaseUrl]);

  const handleSave = () => {
    onSave({
      apiKey,
      model,
      ...(showBaseUrl ? { baseUrl } : {}),
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          API Key
        </label>
        <div className="flex gap-2">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={`输入 ${label} API Key`}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 accent-ring"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-700"
          >
            {showKey ? "隐藏" : "显示"}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          模型
        </label>
        <input
          type="text"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={defaultModel}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 accent-ring"
        />
      </div>

      {showBaseUrl && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            API Base URL
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={defaultBaseUrl}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 accent-ring"
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-700"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg accent-bg text-white text-sm accent-bg-hover\/90 transition-colors"
        >
          保存
        </button>
      </div>
    </div>
  );
}
