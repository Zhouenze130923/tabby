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
import ClippingsPanel from "./components/Clippings/ClippingsPanel";
import TimelinePanel from "./components/Timeline/TimelinePanel";
import OmniboxPanel from "./components/Omnibox/OmniboxPanel";
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
  const [showClippings, setShowClippings] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showOmnibox, setShowOmnibox] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState<string | null>(null);
  const [aiPromptToExecute, setAiPromptToExecute] = useState<{ text: string } | null>(null);
  const taskExecutionInProgress = useRef(false);
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const initialized = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  // Auto snapshot timer
  const autoSnapshotTimer = useRef<ReturnType<typeof setInterval>>();

  // 加载保存的 UI 样式（browser-style 持久化）
  useEffect(() => {
    const root = document.documentElement;
    const load = (key: string, varName: string) => {
      const v = localStorage.getItem(key);
      if (v) root.style.setProperty(varName, v);
    };
    const uiBg = localStorage.getItem("pivot-ui-bg");
    if (uiBg) {
      document.body.style.background = uiBg;
      document.getElementById("root")!.style.background = uiBg;
    }
    load("pivot-ui-sidebar-bg", "--pivot-ui-sidebar-bg");
    const uiFontSize = localStorage.getItem("pivot-ui-font-size");
    if (uiFontSize) document.body.style.fontSize = uiFontSize;
    const theme = localStorage.getItem("pivot-theme");
    if (theme === "dark") root.classList.add("dark");
    if (theme === "light") root.classList.remove("dark");
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+K for Omnibox
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowOmnibox(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Auto snapshot every 5 minutes
  useEffect(() => {
    autoSnapshotTimer.current = setInterval(() => {
      window.tabby.timeline.autoSnapshot().catch(() => {});
    }, 300000); // 5 minutes
    return () => {
      if (autoSnapshotTimer.current) clearInterval(autoSnapshotTimer.current);
    };
  }, []);

  // Sidebar resize handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setSidebarWidth(Math.max(300, Math.min(700, newWidth)));
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
    if (initialized.current) return;
    initialized.current = true;

    const unsub = window.tabby.tab.onUpdate((tabs, activeTabId) => {
      useTabStore.getState().setTabs(tabs);
      if (activeTabId) useTabStore.getState().setActiveTab(activeTabId);
    });

    window.tabby.tab.list().then((tabs) => {
      if (tabs.length === 0) {
        window.tabby.tab.create();
      } else {
        useTabStore.getState().setTabs(tabs);
        if (tabs.length > 0) {
          useTabStore.getState().setActiveTab(tabs[0].id);
        }
      }
    });

    const unsubTasks = window.tabby.tasks.onExecute((task) => {
      if (taskExecutionInProgress.current) return;
      taskExecutionInProgress.current = true;
      setShowSidePanel(true);
      setAiPromptToExecute({ text: `[定时任务: ${task.name}] ${task.prompt}` });
      setTimeout(() => { taskExecutionInProgress.current = false; }, 5000);
    });

    // Listen for knowledge reference events (from KnowledgePanel)
    const handleKnowledgeRef = (e: CustomEvent) => {
      setShowSidePanel(true);
      setAiPromptToExecute({ text: e.detail });
    };
    window.addEventListener("pivot:knowledge-ref", handleKnowledgeRef as EventListener);

    return () => {
      unsub();
      unsubTasks();
      window.removeEventListener("pivot:knowledge-ref", handleKnowledgeRef as EventListener);
    };
  }, []);

  // Omnibox navigation handlers
  const handleOmniboxNavigate = useCallback((url: string) => {
    window.tabby.tab.getAllInfo().then(tabs => {
      const active = tabs.find(t => t.isActive);
      if (active) window.tabby.tab.navigate(active.id, url);
      else window.tabby.tab.create(url);
    });
  }, []);

  const handleOmniboxSearch = useCallback((query: string) => {
    window.tabby.tab.create(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
  }, []);

  const handleOmniboxAsk = useCallback((query: string) => {
    setShowSidePanel(true);
    setAiSearchQuery(query);
  }, []);

  return (
    <ErrorBoundary>
    <div className="flex flex-col h-screen">
      <TitleBar
        setShowSidePanel={setShowSidePanel}
        showSidePanel={showSidePanel}
        onOpenSettings={() => setShowSettings(true)}
        onOpenPrompts={() => setShowPrompts(true)}
        onOpenHistory={() => setShowHistory(true)}
        onOpenTasks={() => setShowTasks(true)}
        onOpenOmnibox={() => setShowOmnibox(true)}
        onOpenClippings={() => setShowClippings(true)}
        onOpenTimeline={() => setShowTimeline(true)}
      />
      <TabBar />
      <AddressBar
        onAiSearch={(query) => { setShowSidePanel(true); setAiSearchQuery(query); }}
        onAiAsk={(query) => { setShowSidePanel(true); setAiSearchQuery(query); }}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <WebView onAiSearch={(query) => { setShowSidePanel(true); setAiSearchQuery(query); }} />
        </div>
        {showSidePanel && (
          <>
            <div
              className="w-1 hover:w-1.5 active:w-1.5 shrink-0 resize-handle transition-[width] duration-75 bg-gray-200 dark:bg-zinc-700 accent-bg-hover active:accent-bg"
              onMouseDown={handleMouseDown}
            />
            <div
              ref={sidebarRef}
              className="border-l border-gray-200 dark:border-zinc-700 flex flex-col shrink-0"
              style={{ width: sidebarWidth }}
            >
              <SidePanel
                tabId={activeTabId}
                initialQuery={aiSearchQuery}
                onQueryConsumed={() => setAiSearchQuery(null)}
                executePrompt={aiPromptToExecute}
                onPromptExecuted={() => setAiPromptToExecute(null)}
              />
            </div>
          </>
        )}
      </div>

      {/* Modal Panels */}
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
      {showClippings && <ClippingsPanel onClose={() => setShowClippings(false)} />}
      {showTimeline && <TimelinePanel onClose={() => setShowTimeline(false)} />}
      {showOmnibox && (
        <OmniboxPanel
          onClose={() => setShowOmnibox(false)}
          onNavigate={handleOmniboxNavigate}
          onSearch={handleOmniboxSearch}
          onAiAsk={handleOmniboxAsk}
          onExecutePrompt={(text) => {
            setShowSidePanel(true);
            setAiPromptToExecute({ text });
          }}
        />
      )}
    </div>
    </ErrorBoundary>
  );
}
