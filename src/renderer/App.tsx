import { useEffect, useRef, useState, useCallback } from "react";
import { useTabStore } from "./stores/tabStore";
import { useThemeStore } from "./stores/themeStore";
import TabBar from "./components/Browser/TabBar";
import AddressBar from "./components/Browser/AddressBar";
import WebView from "./components/Browser/WebView";
import SidePanel from "./components/AI/SidePanel";
import TitleBar from "./components/Browser/TitleBar";
import ErrorBoundary from "./components/ErrorBoundary";
import SettingsPanel from "./components/Settings/SettingsPanel";
import HistoryPanel from "./components/History/HistoryPanel";
import PromptsPanel from "./components/Tips/TipsPanel";
import TasksPanel from "./components/Tasks/TasksPanel";

export default function App() {
  const activeTabId = useTabStore((s) => s.activeTabId);
  const accentColor = useThemeStore((s) => s.accentColor);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState<string | null>(null);
  const [aiPromptToExecute, setAiPromptToExecute] = useState<{ text: string } | null>(null);
  const taskExecutionInProgress = useRef(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const initialized = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  // Sidebar resize handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setSidebarWidth(Math.max(260, Math.min(600, newWidth)));
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  useEffect(() => {
    // StrictMode 下 effect 会跑两次，用 ref 防止重复初始化
    if (initialized.current) return;
    initialized.current = true;

    // 先注册推送监听，再加载初始状态
    const unsub = window.tabby.tab.onUpdate((tabs, activeTabId) => {
      useTabStore.getState().setTabs(tabs);
      if (activeTabId) useTabStore.getState().setActiveTab(activeTabId);
    });

    window.tabby.tab.list().then((tabs) => {
      if (tabs.length === 0) {
        // 首次启动 — 创建空标签页，tab:updated 推送会自动更新 store
        window.tabby.tab.create();
      } else {
        useTabStore.getState().setTabs(tabs);
        if (tabs.length > 0) {
          useTabStore.getState().setActiveTab(tabs[0].id);
        }
      }
    });

    // 注册定时任务执行监听
    const unsubTasks = window.tabby.tasks.onExecute((task) => {
      if (taskExecutionInProgress.current) return;
      taskExecutionInProgress.current = true;

      setShowSidePanel(true);
      setAiPromptToExecute({ text: `[定时任务: ${task.name}] ${task.prompt}` });

      // Reset the flag after a delay
      setTimeout(() => {
        taskExecutionInProgress.current = false;
      }, 5000);
    });

    return () => {
      unsub();
      unsubTasks();
    };
  }, []);

  return (
    <ErrorBoundary>
    <div className="flex flex-col h-screen bg-white dark:bg-zinc-900">
      <TitleBar
        setShowSidePanel={setShowSidePanel}
        showSidePanel={showSidePanel}
        onOpenSettings={() => setShowSettings(true)}
        onOpenPrompts={() => setShowPrompts(true)}
        onOpenHistory={() => setShowHistory(true)}
        onOpenTasks={() => setShowTasks(true)}
      />
      <TabBar />
      <AddressBar onAiSearch={(query) => { setShowSidePanel(true); setAiSearchQuery(query); }} />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <WebView onAiSearch={(query) => { setShowSidePanel(true); setAiSearchQuery(query); }} />
        </div>
        {showSidePanel && (
          <>
            {/* Resize handle */}
            <div
              className="w-1 hover:w-1.5 active:w-1.5 shrink-0 resize-handle transition-[width] duration-75 bg-gray-200 dark:bg-zinc-700 accent-bg-hover active:accent-bg"
              onMouseDown={handleMouseDown}
            />
            <div
              ref={sidebarRef}
              className="border-l border-gray-200 dark:border-zinc-700 flex flex-col shrink-0"
              style={{ width: sidebarWidth }}
            >
              <SidePanel tabId={activeTabId} initialQuery={aiSearchQuery} onQueryConsumed={() => setAiSearchQuery(null)} executePrompt={aiPromptToExecute} onPromptExecuted={() => setAiPromptToExecute(null)} />
            </div>
          </>
        )}
      </div>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      {showPrompts && (
        <PromptsPanel
          onClose={() => setShowPrompts(false)}
          onExecutePrompt={(text) => {
            setShowSidePanel(true);
            setAiPromptToExecute({ text });
          }}
        />
      )}
      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
      {showTasks && <TasksPanel onClose={() => setShowTasks(false)} />}
    </div>
    </ErrorBoundary>
  );
}
