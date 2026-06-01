import { useEffect, useState, useCallback, useRef } from "react";
import { X, Search, Clock, Trash2, ExternalLink } from "lucide-react";

interface HistoryEntry {
  id: number;
  url: string;
  title: string;
  visited_at: string;
}

function getDateLabel(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);

  // Normalize to start of day
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (target.getTime() === today.getTime()) return "今天";
  if (target.getTime() === yesterday.getTime()) return "昨天";
  if (target >= weekStart) return "本周";
  if (target >= monthStart) return "本月";
  if (target >= yearStart) return "今年";
  return "更早";
}

interface GroupedHistory {
  label: string;
  entries: HistoryEntry[];
}

function groupByDate(entries: HistoryEntry[]): GroupedHistory[] {
  const groups = new Map<string, HistoryEntry[]>();
  entries.forEach((entry) => {
    const label = getDateLabel(entry.visited_at);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(entry);
  });

  const order = ["今天", "昨天", "本周", "本月", "今年", "更早"];
  return order
    .filter((label) => groups.has(label))
    .map((label) => ({ label, entries: groups.get(label)! }));
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const hours = d.getHours().toString().padStart(2, "0");
  const mins = d.getMinutes().toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${month}-${day}`;
}

function getDateDisplay(dateStr: string, groupLabel: string): string {
  if (groupLabel === "今天" || groupLabel === "昨天") return formatTime(dateStr);
  if (groupLabel === "本周" || groupLabel === "本月") return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
}

interface HistoryPanelProps {
  onClose: () => void;
}

export default function HistoryPanel({ onClose }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadedAll, setLoadedAll] = useState(false);
  const pageSize = 50;
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(
    async (append = false) => {
      setLoading(true);
      try {
        const offset = append ? entries.length : 0;
        const result = await window.tabby.history.list({
          limit: pageSize,
          offset,
          query: searchQuery || undefined,
        });
        if (append) {
          setEntries((prev) => [...prev, ...result.entries]);
        } else {
          setEntries(result.entries);
        }
        setTotal(result.total);
        setLoadedAll(offset + result.entries.length >= result.total);
      } catch (err) {
        console.error("Failed to load history:", err);
      } finally {
        setLoading(false);
      }
    },
    [searchQuery]
  );

  useEffect(() => {
    setEntries([]);
    setLoadedAll(false);
    loadHistory(false);
  }, [searchQuery]);

  useEffect(() => {
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  const handleNavigate = async (url: string) => {
    try {
      const tabs = await window.tabby.tab.list();
      if (tabs.length > 0) {
        await window.tabby.tab.navigate(tabs[0].id, url);
      } else {
        await window.tabby.tab.create(url);
      }
    } catch (err) {
      console.error("Failed to navigate:", err);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("确定清除所有浏览历史记录？此操作不可恢复。")) return;
    try {
      await window.tabby.history.clear();
      setEntries([]);
      setTotal(0);
    } catch (err) {
      console.error("Failed to clear history:", err);
    }
  };

  const grouped = groupByDate(entries);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[640px] max-h-[85vh] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Clock size={16} className="accent-text" />
            浏览历史
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 py-3 border-b border-gray-100 dark:border-zinc-800">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500"
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜索浏览历史…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none accent-ring"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 pt-3">
          {loading && entries.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400 dark:text-zinc-500 text-sm">
              <div className="w-4 h-4 border-2 border-gray-300 dark:border-zinc-600 border-t-transparent rounded-full animate-spin mr-2" />
              加载中…
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-zinc-500">
              <Clock size={40} className="mb-3 opacity-40" />
              <p className="text-sm">
                {searchQuery ? "没有匹配的历史记录" : "暂无浏览历史"}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map((group) => (
                <div key={group.label}>
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                    {group.label} · {group.entries.length} 条
                  </h3>
                  <div className="space-y-1">
                    {group.entries.map((entry) => (
                      <button
                        key={entry.id}
                        onClick={() => handleNavigate(entry.url)}
                        className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800/60 text-left transition-colors group"
                      >
                        <div className="w-6 h-6 shrink-0 rounded-md bg-gray-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden mt-0.5">
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(entry.url).hostname)}&sz=32`}
                            alt=""
                            className="w-4 h-4"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 dark:text-gray-100 truncate group-hover:accent-text transition-colors">
                            {entry.title || new URL(entry.url).hostname}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-400 dark:text-zinc-500 truncate">
                              {entry.url}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-zinc-600 shrink-0">
                              {getDateDisplay(entry.visited_at, group.label)}
                            </span>
                          </div>
                        </div>
                        <ExternalLink
                          size={14}
                          className="text-gray-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Load more */}
          {!loadedAll && entries.length > 0 && (
            <div className="flex justify-center pt-4 pb-2">
              <button
                onClick={() => loadHistory(true)}
                disabled={loading}
                className="px-5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-600 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                {loading ? "加载中…" : `加载更多 (${entries.length}/${total})`}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-zinc-800 shrink-0">
            <span className="text-xs text-gray-400 dark:text-zinc-500">
              共 {total} 条记录
            </span>
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={13} />
              清除历史
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
