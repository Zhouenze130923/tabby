import { useState, useEffect, useCallback } from "react";
import { X, Lightbulb, Search, Plus, Trash2, Sparkles } from "lucide-react";

interface Prompt {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
  created_at: string;
}

interface PromptsPanelProps {
  onClose: () => void;
  onExecutePrompt: (text: string) => void;
}

const CATEGORIES = ["全部", "通用", "写作", "编程", "信息提取", "自定义"];

export default function PromptsPanel({ onClose, onExecutePrompt }: PromptsPanelProps) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formCategory, setFormCategory] = useState("通用");

  const loadPrompts = useCallback(async () => {
    try {
      setLoading(true);
      const items = await window.tabby.prompts.list();
      setPrompts(items);
    } catch (err) {
      console.error("Failed to load prompts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  const filteredPrompts = prompts.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "全部" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleExecute = (prompt: Prompt) => {
    onExecutePrompt(prompt.prompt);
    onClose();
  };

  const handleDelete = async (id: string) => {
    try {
      await window.tabby.prompts.delete(id);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete prompt:", err);
    }
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formPrompt.trim()) return;
    try {
      const newPrompt = await window.tabby.prompts.save({
        name: formName.trim(),
        description: formDescription.trim(),
        prompt: formPrompt.trim(),
        category: formCategory,
      });
      setPrompts((prev) => [...prev, newPrompt]);
      // Reset form
      setFormName("");
      setFormDescription("");
      setFormPrompt("");
      setFormCategory("通用");
      setShowCreateForm(false);
    } catch (err) {
      console.error("Failed to save prompt:", err);
    }
  };

  // Group prompts by category for display
  const groupedByCategory = CATEGORIES.filter((c) => c !== "全部").reduce(
    (acc, cat) => {
      const items = filteredPrompts.filter((p) => p.category === cat);
      if (items.length > 0) acc[cat] = items;
      return acc;
    },
    {} as Record<string, Prompt[]>,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[680px] max-h-[85vh] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Lightbulb size={18} className="text-yellow-500" />
            妙招 — AI 提示词模板
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Plus size={14} />
              创建妙招
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">名称</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="妙招名称"
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 accent-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">描述</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="简短描述（可选）"
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 accent-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">提示词</label>
                <textarea
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  placeholder="输入 AI 提示词模板..."
                  rows={3}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 accent-ring resize-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 dark:text-zinc-400 mb-1">分类</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 accent-ring"
                  >
                    {CATEGORIES.filter((c) => c !== "全部").map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={!formName.trim() || !formPrompt.trim()}
                  className="mt-5 px-4 py-1.5 text-sm rounded-lg accent-bg accent-bg-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Sparkles size={14} />
                  保存
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="mt-5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search & Categories */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-zinc-700">
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索妙招..."
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 accent-ring transition-all"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  selectedCategory === cat
                    ? "accent-bg text-white"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt Cards */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 accent-spin rounded-full animate-spin shrink-0" />
                <span className="text-sm">加载中...</span>
              </div>
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Lightbulb size={32} className="mb-2 text-gray-300 dark:text-zinc-600" />
              <p className="text-sm">没有找到匹配的妙招</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-3 text-xs accent-text hover:underline"
              >
                创建一个 →
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* When filtering/searching, show flat list */}
              {(searchQuery || selectedCategory !== "全部")
                ? filteredPrompts.map((prompt) => (
                    <PromptCard
                      key={prompt.id}
                      prompt={prompt}
                      onExecute={handleExecute}
                      onDelete={handleDelete}
                    />
                  ))
                : // When no filter, show grouped by category
                Object.entries(groupedByCategory).map(([category, items]) => (
                  <div key={category}>
                    <h3 className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
                      {category}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {items.map((prompt) => (
                        <PromptCard
                          key={prompt.id}
                          prompt={prompt}
                          onExecute={handleExecute}
                          onDelete={handleDelete}
                        />
                      ))}
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

function PromptCard({
  prompt,
  onExecute,
  onDelete,
}: {
  prompt: Prompt;
  onExecute: (p: Prompt) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group relative p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/70 border border-gray-100 dark:border-zinc-700 hover:shadow-md hover:border-gray-200 dark:hover:border-zinc-600 transition-all duration-200 cursor-pointer"
      onClick={() => onExecute(prompt)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={14} className="text-yellow-500 shrink-0" />
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {prompt.name}
          </h4>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(prompt.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all shrink-0"
          title="删除"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {prompt.description && (
        <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2 line-clamp-2">
          {prompt.description}
        </p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
          {prompt.category}
        </span>
        <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
          点击执行 →
        </span>
      </div>
    </div>
  );
}
