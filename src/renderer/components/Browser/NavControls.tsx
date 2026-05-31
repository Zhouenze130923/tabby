import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react";

export default function NavControls({ tabId }: { tabId: string | null }) {
  const handleBack = () => {
    if (!tabId) return;
    window.tabby.tab.back(tabId);
    // 实际导航由 webview ref 处理
    const el = document.querySelector(
      `webview[data-tab-id="${tabId}"]`
    ) as WebviewTag | null;
    el?.goBack();
  };

  const handleForward = () => {
    if (!tabId) return;
    window.tabby.tab.forward(tabId);
    const el = document.querySelector(
      `webview[data-tab-id="${tabId}"]`
    ) as WebviewTag | null;
    el?.goForward();
  };

  const handleReload = () => {
    if (!tabId) return;
    window.tabby.tab.reload(tabId);
    const el = document.querySelector(
      `webview[data-tab-id="${tabId}"]`
    ) as WebviewTag | null;
    if (el) {
      el.reload();
    }
  };

  return (
    <div className="flex items-center gap-0.5 shrink-0">
      <button
        onClick={handleBack}
        disabled={!tabId}
        className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-default transition-colors"
        title="后退"
      >
        <ArrowLeft size={15} />
      </button>
      <button
        onClick={handleForward}
        disabled={!tabId}
        className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-default transition-colors"
        title="前进"
      >
        <ArrowRight size={15} />
      </button>
      <button
        onClick={handleReload}
        disabled={!tabId}
        className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-default transition-colors"
        title="刷新"
      >
        <RotateCw size={14} />
      </button>
    </div>
  );
}
