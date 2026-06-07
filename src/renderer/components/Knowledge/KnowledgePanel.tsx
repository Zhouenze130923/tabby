import { useState, useEffect, useCallback, useRef } from "react";
import { BookOpen, RefreshCw, Lightbulb, ExternalLink, ChevronRight } from "lucide-react";

interface KnowledgeItem {
  title: string;
  content: string;
  source: string;
  score: number;
}

export default function KnowledgePanel() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const lastDetectRef = useRef(0);
  const initialLoad = useRef(false);
  const detectTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const detectKnowledge = useCallback(async () => {
    // 节流：5 秒内不重复检测
    const now = Date.now();
    if (now - lastDetectRef.current < 5000) return;
    lastDetectRef.current = now;

    setLoading(true);
    try {
      const results = await window.tabby.knowledge.autoDetect();
      setItems(results || []);
    } catch {
      // Silent fail
    }
    setLoading(false);
  }, []);

  // 页面加载完成后才检测（通过 did-stop-loading 间接触发）
  // 不使用 setInterval，改用按需 + 标签页切换触发
  useEffect(() => {
    // 初始检测（延迟 2 秒，等页面稳定）
    const initialTimer = setTimeout(() => detectKnowledge(), 2000);

    // 只响应标签页切换（不响应导航事件）
    const unsub = window.tabby.tab.onUpdate(() => {
      // 用节流控制频率，避免导航过程中的多次触发
      if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
      detectTimerRef.current = setTimeout(() => detectKnowledge(), 3000); // 延迟 3 秒等页面加载完
    });

    return () => {
      clearTimeout(initialTimer);
      if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
      unsub();
    };
  }, [detectKnowledge]);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
        title="展开知识面板"
      >
        <BookOpen size={14} />
        <ChevronRight size={12} />
      </button>
    );
  }

  return (
    <div className="border-t border-gray-200 dark:border-zinc-700">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <BookOpen size={14} className="text-amber-500" />
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">知识库关联</span>
          {items.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
              {items.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={detectKnowledge}
            className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ${loading ? 'animate-spin' : ''}`}
            title="刷新知识关联"
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="收起"
          >
            <span className="text-xs">✕</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 pb-3 space-y-2 max-h-48 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <span className="w-3 h-3 border-2 rounded-full animate-spin accent-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-4 text-center">
            <Lightbulb size={16} className="mx-auto mb-1 text-gray-300 dark:text-zinc-600" />
            <p className="text-[10px] text-gray-400 dark:text-zinc-500">
              浏览网页时将自动关联知识库
            </p>
          </div>
        ) : (
          items.map((item, i) => (
            <div
              key={i}
              className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              title="点击在对话中引用"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("pivot:knowledge-ref", {
                  detail: `关于"${item.title}"我有以下知识：${item.content.slice(0, 300)}`
                }));
              }}
            >
              <div className="flex items-start gap-2">
                <BookOpen size={12} className="text-amber-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300 truncate">
                    {item.title}
                  </p>
                  <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 line-clamp-2 mt-0.5 leading-relaxed">
                    {item.content.slice(0, 150)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] px-1 py-0.5 rounded-full bg-amber-200/50 dark:bg-amber-800/30 text-amber-600 dark:text-amber-400">
                      {item.source === "zero-kb" ? "零酱知识库" : item.source === "personal-kb" ? "个人知识库" : "知识库"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
