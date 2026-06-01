import { useRef } from "react";
import { X, Lightbulb, ChevronLeft, ChevronRight } from "lucide-react";

const tips = [
  {
    id: "ai-search",
    title: "🌐 AI 深度搜索",
    content: "在地址栏输入问题，AI 会自动联网搜索并综合回答",
  },
  {
    id: "tab-control",
    title: "📑 操控标签页",
    content: '让 AI 帮你打开、关闭、切换标签页："帮我打开百度"',
  },
  {
    id: "theme",
    title: "🎨 换主题色",
    content: '让 AI 换个主题："改成紫色主题"',
  },
  {
    id: "markdown",
    title: "📝 Markdown 回复",
    content: "AI 回复支持 Markdown 格式，代码块、表格、列表都能渲染",
  },
  {
    id: "import",
    title: "📥 导入数据",
    content: "设置中可从 Chrome/Safari/Firefox 一键导入书签",
  },
  {
    id: "sidebar-resize",
    title: "↔️ 调整侧边栏",
    content: "拖动 AI 侧边栏与浏览器之间的竖条，调整宽度",
  },
  {
    id: "plain-chat",
    title: "💬 纯聊天模式",
    content: "如果想直接对话不搜索，输入 /plain 你的问题",
  },
];

interface TipsPanelProps {
  onClose: () => void;
}

export default function TipsPanel({ onClose }: TipsPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -240, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 240, behavior: "smooth" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[600px] max-h-[80vh] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Lightbulb size={18} className="text-yellow-500" />
            Pivot 妙招
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-5">
            试试这些有趣的玩法，发现 Pivot 的更多可能 👇
          </p>

          <div className="relative">
            {/* Scroll arrows */}
            <button
              onClick={scrollLeft}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 shadow-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors -ml-3"
            >
              <ChevronLeft size={14} />
            </button>

            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide pb-1 px-2"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {tips.map((tip) => (
                <div
                  key={tip.id}
                  className="w-[200px] shrink-0 p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/70 border border-gray-100 dark:border-zinc-700 hover:shadow-md hover:border-gray-200 dark:hover:border-zinc-600 transition-all duration-200"
                >
                  <div className="text-base mb-2.5">{tip.title}</div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                    {tip.content}
                  </p>
                </div>
              ))}
            </div>

            <button
              onClick={scrollRight}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 shadow-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors -mr-3"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
