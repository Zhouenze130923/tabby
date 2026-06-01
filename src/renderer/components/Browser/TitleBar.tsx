import { Settings, Lightbulb, Clock } from "lucide-react";

export default function TitleBar({ setShowSidePanel, showSidePanel, onOpenSettings, onOpenTips, onOpenHistory }: {
  setShowSidePanel: (v: boolean) => void;
  showSidePanel: boolean;
  onOpenSettings: () => void;
  onOpenTips: () => void;
  onOpenHistory: () => void;
}) {
  return (
    <div className="flex items-center h-9 px-3 bg-gray-100 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 draggable-area shrink-0">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-300 ml-8">Pivot</span>
      <div className="flex-1" />
      <button
        onClick={onOpenTips}
        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500 dark:text-gray-400 mr-1"
        title="Pivot 妙招"
      >
        <Lightbulb size={15} />
      </button>
      <button
        onClick={onOpenHistory}
        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500 dark:text-gray-400 mr-1"
        title="浏览历史"
      >
        <Clock size={15} />
      </button>
      <button
        onClick={onOpenSettings}
        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500 dark:text-gray-400 mr-1"
        title="设置"
      >
        <Settings size={15} />
      </button>
      <button
        onClick={() => setShowSidePanel(!showSidePanel)}
        className="px-2 py-1 text-xs rounded hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-300"
        title="AI 侧边栏"
      >
        {showSidePanel ? "隐藏 AI" : "AI"}
      </button>
    </div>
  );
}
