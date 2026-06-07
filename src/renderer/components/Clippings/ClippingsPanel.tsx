import { useState, useEffect, useCallback } from "react";
import { Search, Trash2, Link as LinkIcon, Clock, Tag, FileText, Image, Code, Plus } from "lucide-react";

interface Clipping {
  id: string;
  source_url: string;
  source_title: string;
  type: "text" | "image" | "note" | "code";
  content: string;
  note: string;
  tags: string;
  created_at: string;
}

export default function ClippingsPanel({ onClose }: { onClose: () => void }) {
  const [clippings, setClippings] = useState<Clipping[]>([]);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await window.tabby.clippings.list(filter === "all" ? undefined : filter);
      setClippings(items || []);
    } catch { setClippings([]); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { load(); return; }
    setLoading(true);
    try {
      const results = await window.tabby.clippings.search(q);
      setClippings(results || []);
    } catch { setClippings([]); }
    setLoading(false);
  }, [load]);

  const handleDelete = async (id: string) => {
    await window.tabby.clippings.remove(id);
    load();
  };

  const handleClipCurrentPage = async () => {
    try {
      const tabs = await window.tabby.tab.getAllInfo();
      const active = tabs.find(t => t.isActive);
      if (!active) return;
      // Extract text from the page
      const result = await window.tabby.tab.getContent(active.id);
      await window.tabby.clippings.add({
        source_url: active.url,
        source_title: active.title,
        type: "text",
        content: (result || "").slice(0, 2000),
        note: "",
        tags: "",
      });
      load();
    } catch (err) {
      console.error("Failed to clip page:", err);
    }
  };

  const types = [
    { key: "all", label: "全部", icon: FileText },
    { key: "text", label: "文本", icon: FileText },
    { key: "image", label: "图片", icon: Image },
    { key: "code", label: "代码", icon: Code },
    { key: "note", label: "笔记", icon: Tag },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[720px] max-h-[85vh] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            📎 智能收藏夹
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClipCurrentPage}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Plus size={14} />
              收藏当前页
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500">
              <span>✕</span>
            </button>
          </div>
        </div>

        {/* Search & Type filter */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-zinc-700">
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="搜索收藏内容 (支持语义搜索)..."
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 accent-ring"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {types.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                  filter === t.key
                    ? "accent-bg text-white"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
                }`}
              >
                <t.icon size={12} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Clipping list */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12 text-gray-400">
              <span className="w-3 h-3 border-2 rounded-full animate-spin accent-spin" />
            </div>
          ) : clippings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <FileText size={32} className="mb-2 text-gray-300 dark:text-zinc-600" />
              <p className="text-sm">暂无收藏</p>
              <button onClick={handleClipCurrentPage} className="mt-3 text-xs accent-text hover:underline">
                收藏当前页面 →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {clippings.map((clip) => (
                <div
                  key={clip.id}
                  className="group p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/70 border border-gray-100 dark:border-zinc-700 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {clip.type === "text" ? <FileText size={14} className="text-blue-500" /> :
                         clip.type === "image" ? <Image size={14} className="text-green-500" /> :
                         clip.type === "code" ? <Code size={14} className="text-purple-500" /> :
                         <Tag size={14} className="text-yellow-500" />}
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {clip.source_title || "无标题"}
                        </h4>
                      </div>
                      {clip.source_url && (
                        <a href={clip.source_url} target="_blank" className="text-[10px] text-blue-500 hover:underline truncate block">
                          {clip.source_url.slice(0, 60)}...
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(clip.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">
                    {clip.content.slice(0, 300)}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400 capitalize">
                      {clip.type}
                    </span>
                    {clip.tags && clip.tags.split(",").filter(Boolean).map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                        #{tag.trim()}
                      </span>
                    ))}
                    <span className="text-[10px] text-gray-400 ml-auto flex items-center gap-1">
                      <Clock size={10} />
                      {new Date(clip.created_at).toLocaleDateString("zh-CN")}
                    </span>
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
