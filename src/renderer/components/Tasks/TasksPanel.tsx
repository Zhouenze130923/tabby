import { useState, useEffect, useCallback } from "react";
import { X, Plus, Play, Square, Trash2, Clock, RefreshCw } from "lucide-react";
import { useThemeStore } from "../../stores/themeStore";

interface Props {
  onClose: () => void;
}

export default function TasksPanel({ onClose }: Props) {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Create form state ──
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"interval" | "cron" | "once">("interval");
  const [newInterval, setNewInterval] = useState("300000"); // 5 min default
  const [newCron, setNewCron] = useState("0 * * * *");
  const [newPrompt, setNewPrompt] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const loadTasks = useCallback(async () => {
    try {
      const list = await window.tabby.tasks.list();
      setTasks(list);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const getNextRun = (task: ScheduledTask): string => {
    const now = Date.now();
    const lastRun = task.last_run ? new Date(task.last_run).getTime() : 0;

    switch (task.type) {
      case "interval": {
        if (!task.interval_ms) return "—";
        const next = lastRun + task.interval_ms;
        if (next <= now) return "即将执行";
        const diff = next - now;
        if (diff < 60000) return "不到1分钟";
        if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟后`;
        return `${Math.floor(diff / 3600000)} 小时后`;
      }
      case "cron": {
        if (!task.cron_expr) return "—";
        // Try to parse and estimate next run (simplified)
        const parts = task.cron_expr.trim().split(/\s+/);
        if (parts.length === 5) {
          const m = parseInt(parts[0]) || 0;
          const h = parseInt(parts[1]) || 0;
          const nextDate = new Date(now);
          nextDate.setHours(h, m, 0, 0);
          if (nextDate.getTime() <= now) {
            nextDate.setDate(nextDate.getDate() + 1);
          }
          return nextDate.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
        }
        return task.cron_expr;
      }
      case "once":
        return task.last_run ? "已执行" : "待执行";
      default:
        return "—";
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newPrompt.trim()) return;

    try {
      const task = {
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: newName.trim(),
        type: newType,
        interval_ms: newType === "interval" ? parseInt(newInterval) || 300000 : undefined,
        cron_expr: newType === "cron" ? newCron.trim() : undefined,
        prompt: newPrompt.trim(),
        tab_url: newUrl.trim() || undefined,
        active: true,
      };

      await window.tabby.tasks.create(task);
      await loadTasks();

      // Reset form
      setNewName("");
      setNewType("interval");
      setNewInterval("300000");
      setNewCron("0 * * * *");
      setNewPrompt("");
      setNewUrl("");
      setShowCreate(false);
    } catch (err) {
      console.error("Failed to create task:", err);
    }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await window.tabby.tasks.toggle(id, active);
    await loadTasks();
  };

  const handleDelete = async (id: string) => {
    await window.tabby.tasks.delete(id);
    await loadTasks();
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case "interval": return "间隔";
      case "cron": return "定时";
      case "once": return "一次性";
      default: return type;
    }
  };

  const getIntervalLabel = (ms: number): string => {
    if (ms < 60000) return `${Math.floor(ms / 1000)}秒`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}分钟`;
    if (ms < 86400000) return `${Math.floor(ms / 3600000)}小时`;
    return `${Math.floor(ms / 86400000)}天`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-700 w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <Clock size={15} />
            定时任务
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={loadTasks}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400"
              title="刷新"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">加载中...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              暂无定时任务
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${task.active ? "text-gray-800 dark:text-gray-200" : "text-gray-400 dark:text-zinc-500 line-through"}`}>
                      {task.name}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      task.type === "interval" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                      task.type === "cron" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                    }`}>
                      {getTypeLabel(task.type)}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-gray-500 dark:text-zinc-400 truncate">
                    {task.prompt}
                  </div>

                  <div className="mt-1.5 flex items-center gap-3 text-[10px] text-gray-400 dark:text-zinc-500">
                    {task.type === "interval" && task.interval_ms && (
                      <span>每 {getIntervalLabel(task.interval_ms)}</span>
                    )}
                    {task.type === "cron" && task.cron_expr && (
                      <span className="font-mono">{task.cron_expr}</span>
                    )}
                    {task.tab_url && (
                      <span className="truncate max-w-[120px]">{task.tab_url}</span>
                    )}
                    <span>下次: {getNextRun(task)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(task.id, !task.active)}
                    className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                      task.active
                        ? "text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30"
                        : "text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
                    }`}
                    title={task.active ? "暂停" : "启用"}
                  >
                    {task.active ? <Play size={13} /> : <Square size={13} />}
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                    title="删除"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create New Task */}
        {showCreate ? (
          <div className="border-t border-gray-200 dark:border-zinc-700 p-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-zinc-400 mb-1 block">任务名称</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例如: 自动刷新检查"
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 dark:text-zinc-400 mb-1 block">任务类型</label>
              <div className="flex gap-2">
                {(["interval", "cron", "once"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setNewType(type)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      newType === type
                        ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-400"
                        : "border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {type === "interval" ? "间隔" : type === "cron" ? "定时" : "一次性"}
                  </button>
                ))}
              </div>
            </div>

            {newType === "interval" && (
              <div>
                <label className="text-xs text-gray-500 dark:text-zinc-400 mb-1 block">间隔时间 (毫秒)</label>
                <input
                  type="number"
                  value={newInterval}
                  onChange={(e) => setNewInterval(e.target.value)}
                  placeholder="300000"
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <div className="mt-1 text-[10px] text-gray-400">快捷: 1分钟=60000, 5分钟=300000, 30分钟=1800000, 1小时=3600000</div>
              </div>
            )}

            {newType === "cron" && (
              <div>
                <label className="text-xs text-gray-500 dark:text-zinc-400 mb-1 block">Cron 表达式 (分 时 日 月 周)</label>
                <input
                  type="text"
                  value={newCron}
                  onChange={(e) => setNewCron(e.target.value)}
                  placeholder="0 * * * *"
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <div className="mt-1 text-[10px] text-gray-400">
                  例如: 每分钟=* * * * *, 每小时=0 * * * *, 每天8点=0 8 * * *
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 dark:text-zinc-400 mb-1 block">执行提示</label>
              <textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="告诉 AI 要做什么..."
                rows={2}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 dark:text-zinc-400 mb-1 block">目标网址 (可选)</label>
              <input
                type="text"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="执行前切换到该页面"
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || !newPrompt.trim()}
                className="flex-1 px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                创建
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 border-t border-gray-200 dark:border-zinc-700">
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border border-dashed border-gray-300 dark:border-zinc-600 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <Plus size={14} />
              创建定时任务
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
