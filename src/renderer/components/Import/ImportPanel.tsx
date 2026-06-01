import { useState } from "react";
import {
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
} from "lucide-react";

interface BrowserCard {
  id: "chrome" | "safari" | "firefox";
  label: string;
  icon: string;
  description: string;
  importFn: () => Promise<ImportResult>;
}

export default function ImportPanel() {
  const [results, setResults] = useState<Record<string, ImportResult | null>>({
    chrome: null,
    safari: null,
    firefox: null,
  });
  const [loading, setLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const browsers: BrowserCard[] = [
    {
      id: "chrome",
      label: "Google Chrome",
      icon: "C",
      description: "导入 Chrome 浏览器收藏夹中的书签",
      importFn: () => window.tabby.import.fromChrome(),
    },
    {
      id: "safari",
      label: "Safari",
      icon: "S",
      description: "导入 Safari 浏览器书签",
      importFn: () => window.tabby.import.fromSafari(),
    },
    {
      id: "firefox",
      label: "Firefox",
      icon: "F",
      description: "导入 Firefox 浏览器书签",
      importFn: () => window.tabby.import.fromFirefox(),
    },
  ];

  const doImport = async (browser: BrowserCard) => {
    setLoading(browser.id);
    setResults((prev) => ({ ...prev, [browser.id]: null }));
    try {
      const result = await browser.importFn();
      setResults((prev) => ({ ...prev, [browser.id]: result }));
    } catch (err: any) {
      setResults((prev) => ({
        ...prev,
        [browser.id]: {
          browser: browser.label,
          count: 0,
          success: false,
          error: err.message || "导入失败",
        },
      }));
    } finally {
      setLoading(null);
    }
  };

  const doImportAll = async () => {
    setBulkLoading(true);
    setResults({ chrome: null, safari: null, firefox: null });
    try {
      const allResults = await window.tabby.import.fromAll();
      const mapped: Record<string, ImportResult> = {
        chrome: allResults[0],
        safari: allResults[1],
        firefox: allResults[2],
      };
      setResults(mapped);
    } catch (err: any) {
      const errResult = {
        browser: "未知",
        count: 0,
        success: false,
        error: err.message || "批量导入失败",
      };
      setResults({ chrome: errResult, safari: errResult, firefox: errResult });
    } finally {
      setBulkLoading(false);
    }
  };

  const totalImported = Object.values(results).reduce(
    (sum, r) => sum + (r?.success ? r.count : 0),
    0
  );
  const anySuccess = Object.values(results).some((r) => r?.success);
  const hasResults = Object.values(results).some((r) => r !== null);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-gray-600 dark:text-zinc-400">
          从其他浏览器导入书签到 Pivot。书签数据仅保存在本地，不会上传到任何云端。
        </p>
      </div>

      {/* 一键全部导入 */}
      <button
        onClick={doImportAll}
        disabled={bulkLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg accent-bg text-white text-sm font-medium accent-bg-hover/90 transition-colors disabled:accent-bg-disabled"
      >
        {bulkLoading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Download size={18} />
        )}
        {bulkLoading ? "正在导入..." : "一键全部导入"}
      </button>

      {hasResults && !bulkLoading && (
        <div
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${
            anySuccess
              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
              : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
          }`}
        >
          {anySuccess ? (
            <CheckCircle2 size={16} className="shrink-0" />
          ) : (
            <AlertCircle size={16} className="shrink-0" />
          )}
          <span>
            {anySuccess
              ? `成功导入 ${totalImported} 个书签`
              : "未成功导入任何书签，请检查浏览器书签文件是否存在"}
          </span>
        </div>
      )}

      {/* 浏览器卡片 */}
      <div className="space-y-3">
        {browsers.map((browser) => {
          const result = results[browser.id];
          const isThisLoading = loading === browser.id;

          return (
            <div
              key={browser.id}
              className="flex items-center justify-between px-4 py-3.5 rounded-lg border border-gray-200 dark:border-zinc-700"
            >
              <div className="flex items-center gap-3">
                {/* Browser icon placeholder */}
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold text-gray-500 dark:text-gray-400 shrink-0">
                  {browser.icon}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {browser.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {result?.success
                      ? `已导入 ${result.count} 个书签`
                      : result && !result.success
                      ? `导入失败: ${result.error}`
                      : browser.description}
                  </div>
                </div>
              </div>
              <button
                onClick={() => doImport(browser)}
                disabled={isThisLoading || bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg accent-bg text-white text-xs font-medium accent-bg-hover/90 transition-colors disabled:accent-bg-disabled"
              >
                {isThisLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : result?.success ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <Download size={14} />
                )}
                {isThisLoading
                  ? "导入中..."
                  : result?.success
                  ? "已导入"
                  : "导入"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
