import { useMemo } from "react";
import { useTabStore } from "../../stores/tabStore";
import { useTabGroupStore } from "../../stores/tabGroupStore";
import { Plus, X } from "lucide-react";
import { TabGroupDot, TabGroupChip } from "./TabGroupIndicator";

export default function TabBar() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const removeTab = useTabStore((s) => s.removeTab);
  const groups = useTabGroupStore((s) => s.groups);

  // Build a tabId → group map for fast lookup
  const tabGroupMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    groups.forEach((g) => {
      g.tabIds.forEach((tid) => {
        map.set(tid, { name: g.name, color: g.color });
      });
    });
    return map;
  }, [groups]);

  // create 通过 IPC 触发主进程 → tab:updated 推送自动更新 store，无需手动 addTab
  const handleCreate = () => {
    window.tabby.tab.create();
  };

  const handleActivate = async (id: string) => {
    await window.tabby.tab.activate(id);
    setActiveTab(id);
  };

  const handleClose = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await window.tabby.tab.close(id);
    removeTab(id);
  };

  if (tabs.length === 0) {
    return (
      <div className="flex items-center h-9 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 shrink-0 px-2">
        <button
          onClick={handleCreate}
          className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-md transition-colors"
        >
          <Plus size={14} />
          新建标签页
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center h-9 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 shrink-0 overflow-x-auto">
      <div className="flex items-center flex-1 min-w-0 px-1 gap-0.5">
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId;
          const groupInfo = tabGroupMap.get(tab.id);
          const prevGroupInfo =
            idx > 0 ? tabGroupMap.get(tabs[idx - 1].id) : null;

          // Show a group chip when the group changes (including at the very first tab)
          const showGroupChip =
            groupInfo &&
            (idx === 0 || groupInfo.name !== prevGroupInfo?.name);

          return (
            <div key={tab.id} className="flex items-center gap-0.5 shrink-0">
              {showGroupChip && (
                <TabGroupChip
                  name={groupInfo!.name}
                  color={groupInfo!.color}
                />
              )}
              <button
                onClick={() => handleActivate(tab.id)}
                className={`
                  group flex items-center gap-1.5 max-w-[180px] h-7 px-2.5 rounded-md text-xs shrink-0 transition-colors
                  ${
                    isActive
                      ? "bg-white dark:bg-zinc-700 text-gray-800 dark:text-gray-100 shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-zinc-700/50"
                  }
                `}
              >
                {/* Group color dot */}
                {groupInfo && <TabGroupDot color={groupInfo.color} />}

                {tab.isLoading ? (
                  <span className="w-3.5 h-3.5 border-2 accent-spin rounded-full animate-spin shrink-0" />
                ) : tab.favicon ? (
                  <img
                    src={tab.favicon}
                    alt=""
                    className="w-3.5 h-3.5 shrink-0"
                  />
                ) : (
                  <span className="w-3.5 h-3.5 bg-gray-300 dark:bg-zinc-600 rounded-sm shrink-0" />
                )}
                <span className="truncate">{tab.title || "New Tab"}</span>
                <span
                  onClick={(e) => handleClose(e, tab.id)}
                  className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-300 dark:hover:bg-zinc-600 transition-opacity ml-0.5"
                >
                  <X size={11} />
                </span>
              </button>
            </div>
          );
        })}
      </div>
      <button
        onClick={handleCreate}
        className="shrink-0 w-7 h-7 flex items-center justify-center mx-0.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
        title="新建标签页"
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
