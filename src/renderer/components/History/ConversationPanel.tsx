import { useEffect, useState, useRef, useCallback } from "react";
import { X, Search, MessageSquare, Plus, Trash2, Edit3, Check, XCircle } from "lucide-react";

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface ConversationPanelProps {
  onClose: () => void;
  onLoadConversation: (conversationId: string) => Promise<void>;
  onNewConversation: () => Promise<string | null>;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;

  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${month}-${day}`;
}

export default function ConversationPanel({
  onClose,
  onLoadConversation,
  onNewConversation,
}: ConversationPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const list = await window.tabby.conversations.list();
      setConversations(list);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    setTimeout(() => searchInputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleNewConversation = async () => {
    const id = await onNewConversation();
    if (id) {
      onClose();
    }
  };

  const handleLoad = async (id: string) => {
    await onLoadConversation(id);
    onClose();
  };

  const handleRemove = async (id: string) => {
    try {
      await window.tabby.conversations.remove(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Failed to remove conversation:", err);
    }
  };

  const handleStartRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleConfirmRename = async () => {
    if (!editingId || !editTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await window.tabby.conversations.rename(editingId, editTitle.trim());
      setConversations((prev) =>
        prev.map((c) =>
          c.id === editingId ? { ...c, title: editTitle.trim() } : c
        )
      );
    } catch (err) {
      console.error("Failed to rename conversation:", err);
    }
    setEditingId(null);
  };

  const handleCancelRename = () => {
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirmRename();
    } else if (e.key === "Escape") {
      handleCancelRename();
    }
  };

  const filtered = searchQuery
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[520px] max-h-[80vh] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MessageSquare size={16} className="accent-text" />
            对话历史
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs accent-bg text-white hover:opacity-90 transition-opacity"
            >
              <Plus size={13} />
              新建对话
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400"
            >
              <X size={18} />
            </button>
          </div>
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
              placeholder="搜索对话…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none accent-ring"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 pt-3">
          {loading && conversations.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-400 dark:text-zinc-500 text-sm">
              <div className="w-4 h-4 border-2 border-gray-300 dark:border-zinc-600 border-t-transparent rounded-full animate-spin mr-2" />
              加载中…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-zinc-500">
              <MessageSquare size={40} className="mb-3 opacity-40" />
              <p className="text-sm">
                {searchQuery ? "没有匹配的对话" : "暂无对话记录"}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleNewConversation}
                  className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs accent-bg text-white hover:opacity-90 transition-opacity"
                >
                  <Plus size={13} />
                  开始新对话
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((conv) => (
                <div
                  key={conv.id}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
                  onClick={() => handleLoad(conv.id)}
                >
                  <MessageSquare
                    size={16}
                    className="text-gray-400 dark:text-zinc-500 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    {editingId === conv.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-2 py-0.5 text-sm rounded border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none accent-ring"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmRename();
                          }}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 text-green-600 dark:text-green-400"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelRename();
                          }}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-500"
                        >
                          <XCircle size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                          {conv.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400 dark:text-zinc-500">
                            {conv.messageCount} 条消息
                          </span>
                          <span className="text-xs text-gray-400 dark:text-zinc-600">
                            {formatDate(conv.updatedAt)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  {/* Hover actions */}
                  {editingId !== conv.id && (
                    <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(conv);
                        }}
                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        title="重命名"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(conv.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 dark:text-zinc-500 hover:text-red-500 transition-colors"
                        title="删除"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {conversations.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-zinc-800 shrink-0">
            <span className="text-xs text-gray-400 dark:text-zinc-500">
              共 {conversations.length} 个对话
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
