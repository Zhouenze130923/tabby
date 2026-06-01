import { Settings, Lightbulb, Clock, Timer, AppWindow } from "lucide-react";

export default function TitleBar({ setShowSidePanel, showSidePanel, onOpenSettings, onOpenPrompts, onOpenHistory, onOpenTasks }: {
  setShowSidePanel: (v: boolean) => void;
  showSidePanel: boolean;
  onOpenSettings: () => void;
  onOpenPrompts: () => void;
  onOpenHistory: () => void;
  onOpenTasks: () => void;
}) {
  return (
    <div className="flex items-center h-9 px-3 border-b border-gray-200 dark:border-zinc-700 draggable-area shrink-0" style={{ background: "var(--pivot-ui-bg)" }}>
      <span className="text-sm font-medium text-gray-600 dark:text-gray-300 ml-8">Pivot</span>
      <div className="flex-1" />
      <button
        onClick={onOpenTasks}
        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500 dark:text-gray-400 mr-1"
        title="定时任务"
      >
        <Timer size={15} />
      </button>
      <button
        onClick={onOpenPrompts}
        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500 dark:text-gray-400 mr-1"
        title="妙招 — AI 提示词模板库"
      >
        <Lightbulb size={15} />
      </button>
      <button
        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500 dark:text-gray-400 mr-1"
        title="浮窗模式 — 弹出小窗口"
      >
        <AppWindow size={15} />
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
