import { useState, useEffect, useCallback } from "react";
import { Clock, RotateCcw, Trash2, Camera, History } from "lucide-react";

interface TimelineSnapshot {
  id: string;
  label: string;
  snapshot_data: string;
  created_at: string;
}

export default function TimelinePanel({ onClose, onRestoreTabs }: { onClose: () => void; onRestoreTabs?: (tabs: Array<{url: string; title: string}>) => void }) {
  const [snapshots, setSnapshots] = useState<TimelineSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await window.tabby.timeline.list(100);
      setSnapshots(items || []);
    } catch { setSnapshots([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    await window.tabby.timeline.remove(id);
    load();
  };

  const handleRestore = (snapshot: TimelineSnapshot) => {
    try {
      const data = JSON.parse(snapshot.snapshot_data);
      if (data.tabs && data.tabs.length > 0) {
        // Restore tabs — open each in a new tab
        for (const tab of data.tabs) {
          if (tab.url && tab.url !== "about:blank") {
            window.tabby.tab.create(tab.url);
          }
        }
      }
      onClose();
    } catch (err) {
      console.error("Failed to restore snapshot:", err);
    }
  };

  const handleTakeSnapshot = async () => {
    try {
      const tabs = await window.tabby.tab.getAllInfo();
      if (tabs.length === 0) return;
      const now = new Date().toLocaleString("zh-CN");
      const label = `📸 快照 ${now} (${tabs.length} 个标签页)`;
      await window.tabby.timeline.save(label);
      load();
    } catch (err) {
      console.error("Failed to take snapshot:", err);
    }
  };

  // Group snapshots by date
  const grouped = snapshots.reduce((acc, s) => {
    const date = new Date(s.created_at).toLocaleDateString("zh-CN");
    if (!acc[date]) acc[date] = [];
    acc[date].push(s);
    return acc;
  }, {} as Record<string, TimelineSnapshot[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[680px] max-h-[85vh] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            🕰️ 浏览时间线
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTakeSnapshot}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Camera size={14} />
              保存快照
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500">
              <span>✕</span>
            </button>
          </div>
        </div>

        {/* Timeline content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12 text-gray-400">
              <span className="w-3 h-3 border-2 rounded-full animate-spin accent-spin" />
            </div>
          ) : snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <History size={32} className="mb-2 text-gray-300 dark:text-zinc-600" />
              <p className="text-sm">还没有浏览快照</p>
              <p className="text-xs text-gray-400 mt-1">浏览时会自动生成快照，你也可以手动保存</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(grouped).map(([date, items]) => (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-2 h-2 rounded-full accent-bg shrink-0" />
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                      {date}
                    </h3>
                    <div className="flex-1 h-px bg-gray-200 dark:bg-zinc-700" />
                  </div>
                  <div className="space-y-3 ml-4 pl-6 border-l-2 border-gray-100 dark:border-zinc-800">
                    {items.map((snap) => {
                      let tabCount = 0;
                      let activeUrl = "";
                      try {
                        const data = JSON.parse(snap.snapshot_data);
                        tabCount = data.tabs?.length || 0;
                        activeUrl = data.activeUrl || "";
                      } catch {}
                      return (
                        <div key={snap.id} className="group relative p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/70 border border-gray-100 dark:border-zinc-700 hover:shadow-md transition-all">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                {snap.label}
                              </h4>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                                <Clock size={12} />
                                <span>{new Date(snap.created_at).toLocaleTimeString("zh-CN")}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                <span>{tabCount} 个标签页</span>
                              </div>
                              {activeUrl && (
                                <p className="text-xs text-gray-400 mt-1 truncate">
                                  当前页面: {activeUrl}
                                </p>
                              )}
                              {/* Show tab previews */}
                              {(() => {
                                try {
                                  const data = JSON.parse(snap.snapshot_data);
                                  return (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {(data.tabs || []).slice(0, 5).map((t: any, i: number) => (
                                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400 truncate max-w-[120px]">
                                          {t.title?.slice(0, 20) || t.url?.slice(0, 20) || "新标签页"}
                                        </span>
                                      ))}
                                      {data.tabs?.length > 5 && (
                                        <span className="text-[10px] text-gray-400">
                                          +{data.tabs.length - 5} 更多
                                        </span>
                                      )}
                                    </div>
                                  );
                                } catch { return null; }
                              })()}
                            </div>
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleRestore(snap)}
                                className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-500 transition-all"
                                title="恢复快照"
                              >
                                <RotateCcw size={13} />
                              </button>
                              <button
                                onClick={() => handleDelete(snap.id)}
                                className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all"
                                title="删除"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
