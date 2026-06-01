import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChat } from "./hooks";
import { useThemeStore } from "../../stores/themeStore";
import { useTabGroupStore } from "../../stores/tabGroupStore";

interface SidePanelProps {
  tabId: string | null;
  initialQuery?: string | null;
  onQueryConsumed?: () => void;
  executePrompt?: { text: string } | null;
  onPromptExecuted?: () => void;
}

export default function SidePanel({ tabId, initialQuery, onQueryConsumed, executePrompt, onPromptExecuted }: SidePanelProps) {
  const setAccentColor = useThemeStore((s) => s.setAccentColor);
  const accentColor = useThemeStore((s) => s.accentColor);
  const [input, setInput] = useState("");
  const [includeContext, setIncludeContext] = useState(true);
  const [searching, setSearching] = useState(false);
  const [tabList, setTabList] = useState<string>("");
  const pendingPromptRef = useRef(false);
  const [groupInfo, setGroupInfo] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialSent = useRef(false);

  // 构建包含标签页信息的系统提示
  const buildSystemPrompt = (tabsInfo: string, groupsText: string) =>
    `You are a helpful assistant inside a browser. I will handle web searches for you — you don't need to search.

Open tabs:
${tabsInfo || "(no tabs yet)"}

When the user asks you to open a website, switch tabs, close tabs, or navigate, use these commands:
- [tab-action: open https://example.com] — open URL in new tab
- [tab-action: switch tab_xxx] — switch to tab (use the id from the list above)
- [tab-action: close tab_xxx] — close a tab
- [tab-action: navigate tab_xxx, https://example.com] — navigate a tab to URL
- [tab-action: content tab_xxx] — read the page text from a tab

Tab group commands:
- [tab-action: classify] — analyze all open tabs and group them by category (shopping, social, work, entertainment, etc.)
- [tab-action: group Name, tabId1, tabId2] — create or reassign a named group (use tab IDs from the list above)

Page manipulation — directly interact with pages:
- [tab-action: click tab_xxx, .button-class] — click an element by CSS selector
- [tab-action: type tab_xxx, #input-id, text to type] — fill an input field
- [tab-action: extract tab_xxx, .content] — extract text from page/element
- [tab-action: scroll tab_xxx, 0, 500] — scroll page to position

Schedule commands:
- [tab-action: schedule 名称, 间隔毫秒, 要执行的提示] — create a repeating task (e.g. schedule 自动检查, 300000, 检查页面更新)
- [tab-action: schedule 名称, cron, cron表达式, 要执行的提示] — create a cron-scheduled task (e.g. schedule 日报, cron, 0 8 * * *, 生成今日日报)
- [tab-action: schedule 名称, once, 要执行的提示] — create a one-time task

Tab style commands — inject CSS into any tab to change how it looks:
- [tab-action: style tab_xxx, body { background: #1a1a2e !important; color: #eee !important; }] — apply custom CSS to a page
- [tab-action: style tab_xxx, * { font-size: 18px !important; }] — change font size
- [tab-action: style tab_xxx, .sidebar, #sidebar { display: none !important; }] — hide elements like sidebars

Theme command:
- [set-accent: #ff0000] — change browser theme color

Current accent: ${accentColor}

Tab Groups:
${groupsText || "(none yet)"}
Respond in Chinese.`;

  // 加载标签页列表
  useEffect(() => {
    const loadTabs = async () => {
      try {
        const tabs = await window.tabby.tab.getAllInfo();
        const tabStr = tabs.map(t => `[${t.id.slice(0,8)}] ${t.title || "(untitled)"} — ${t.url}${t.isActive ? " ← 当前" : ""}`).join("\n");
        setTabList(tabStr);
      } catch {}
    };
    loadTabs();
    // 监听标签页变化刷新列表
    const unsub = window.tabby.tab.onUpdate(() => loadTabs());
    return unsub;
  }, []);

  // 订阅标签组变化
  useEffect(() => {
    const updateGroups = () => {
      const groups = useTabGroupStore.getState().groups;
      if (groups.length === 0) {
        setGroupInfo("");
        return;
      }
      setGroupInfo(
        groups
          .map(
            (g) =>
              `- "${g.name}" (${g.tabIds.length} tabs) — tabs: ${g.tabIds.map((id) => id.slice(0, 8)).join(", ")}`,
          )
          .join("\n"),
      );
    };
    updateGroups();
    const unsub = useTabGroupStore.subscribe(updateGroups);
    return unsub;
  }, []);

  const [systemPrompt, setSystemPrompt] = useState("");
  useEffect(() => {
    setSystemPrompt(buildSystemPrompt(tabList, groupInfo));
  }, [tabList, accentColor, groupInfo]);

  const { messages, loading, error, send, clear, abort } = useChat({
    onAccentColor: setAccentColor,
    systemPrompt,
  });

  // 监听 AI 输出中的 tab-action 标记（每个 AI 消息只执行一次）
  const processedActions = useRef(new Set<string>());
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    // 已处理过的消息跳过
    if (processedActions.current.has(last.content)) return;
    processedActions.current.add(last.content);

    const tabRegex = /\[tab-action:\s*(\w+)\s*,?\s*([^\]]*)\]/g;
    let match;
    while ((match = tabRegex.exec(last.content)) !== null) {
      const actionType = match[1].trim();
      const args = match[2].trim();
      try {
        switch (actionType) {
          case "switch": window.tabby.tab.switch(args); break;
          case "open": window.tabby.tab.create(args); break;
          case "close": window.tabby.tab.close(args); break;
          case "navigate": {
            const idx = args.indexOf(",");
            if (idx > 0) {
              const tid = args.slice(0, idx).trim();
              const url = args.slice(idx + 1).trim();
              window.tabby.tab.navigate(tid, url);
            }
            break;
          }
          case "classify": {
            // AI 自动分类所有标签页
            window.tabby.tab.getAllInfo().then((tabs) => {
              useTabGroupStore.getState().autoClassify(tabs);
            });
            break;
          }
          case "group": {
            // 格式: group 组名, tabId1, tabId2, ...
            const parts = args.split(",").map((s) => s.trim());
            const groupName = parts[0];
            const tabIds = parts.slice(1).filter((id) => id.length > 0);
            if (groupName) {
              useTabGroupStore.getState().createGroup(groupName, tabIds);
            }
            break;
          }
          case "click": {
            // 格式: click tabId, selector
            const sep = args.indexOf(",");
            if (sep > 0) {
              const tid = args.slice(0, sep).trim();
              const selector = args.slice(sep + 1).trim();
              window.tabby.tab.clickElement(tid, selector);
            }
            break;
          }
          case "type": {
            // 格式: type tabId, selector, text
            const parts = args.split(",").map((s) => s.trim());
            if (parts.length >= 3) {
              const tid = parts[0];
              const selector = parts[1];
              const text = parts.slice(2).join(",");
              window.tabby.tab.fillInput(tid, selector, text);
            }
            break;
          }
          case "extract": {
            // 格式: extract tabId, selector? (selector 可选)
            const sep = args.indexOf(",");
            if (sep > 0) {
              const tid = args.slice(0, sep).trim();
              const selector = args.slice(sep + 1).trim();
              window.tabby.tab.extractText(tid, selector);
            } else {
              window.tabby.tab.extractText(args.trim());
            }
            break;
          }
          case "scroll": {
            // 格式: scroll tabId, x, y
            const parts = args.split(",").map((s) => s.trim());
            if (parts.length >= 3) {
              const tid = parts[0];
              const x = parseInt(parts[1], 10) || 0;
              const y = parseInt(parts[2], 10) || 0;
              window.tabby.tab.scrollTo(tid, x, y);
            }
            break;
          }
          case "schedule": {
            // 格式: schedule 名称, 间隔毫秒, 要执行的提示
            // 或: schedule 名称, cron, cron表达式, 要执行的提示
            // 或: schedule 名称, once, 要执行的提示
            const parts = args.split(",").map((s) => s.trim());
            const taskName = parts[0];
            if (!taskName) break;

            const typeOrInterval = parts[1];
            if (!typeOrInterval) break;

            if (typeOrInterval === "cron") {
              // schedule name, cron, expression, prompt
              const cronExpr = parts[2];
              const prompt = parts.slice(3).join(", ").trim();
              if (!cronExpr || !prompt) break;
              window.tabby.tab.getAllInfo().then((tabs) => {
                const active = tabs.find((t) => t.isActive);
                window.tabby.tasks.create({
                  id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  name: taskName,
                  type: "cron",
                  cron_expr: cronExpr,
                  prompt,
                  tab_url: active?.url || "",
                  active: true,
                });
              });
            } else if (typeOrInterval === "once") {
              // schedule name, once, prompt
              const prompt = parts.slice(2).join(", ").trim();
              if (!prompt) break;
              window.tabby.tab.getAllInfo().then((tabs) => {
                const active = tabs.find((t) => t.isActive);
                window.tabby.tasks.create({
                  id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  name: taskName,
                  type: "once",
                  prompt,
                  tab_url: active?.url || "",
                  active: true,
                });
              });
            } else {
              // schedule name, intervalMs, prompt
              const intervalMs = parseInt(typeOrInterval, 10);
              const prompt = parts.slice(2).join(", ").trim();
              if (isNaN(intervalMs) || !prompt) break;
              window.tabby.tab.getAllInfo().then((tabs) => {
                const active = tabs.find((t) => t.isActive);
                window.tabby.tasks.create({
                  id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                  name: taskName,
                  type: "interval",
                  interval_ms: intervalMs,
                  prompt,
                  tab_url: active?.url || "",
                  active: true,
                });
              });
            }
            break;
          }
          case "style": {
            // 格式: style tabId, CSS代码
            const sep = args.indexOf(",");
            if (sep > 0) {
              const tid = args.slice(0, sep).trim();
              const css = args.slice(sep + 1).trim();
              window.tabby.tab.injectStyle(tid, css);
            }
            break;
          }
        }
      } catch (e) {
        console.error("tab-action failed:", e);
      }
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Execute prompt template from PromptsPanel (send directly to AI, no web search)
  useEffect(() => {
    if (executePrompt?.text && !pendingPromptRef.current && !loading && !searching) {
      pendingPromptRef.current = true;
      send(executePrompt.text, true);
      onPromptExecuted?.();
    }
  }, [executePrompt]);

  useEffect(() => {
    if (initialQuery && !initialSent.current && !loading && !searching) {
      initialSent.current = true;
      handleAiSearch(initialQuery);
      onQueryConsumed?.();
    }
  }, [initialQuery, loading, searching]);

  const handleAiSearch = async (query: string) => {
    // 判断意图：标签页操控 / 主题颜色 / 需要联网搜索 / 其他
    const tabCommands = /打开|关闭|切换|跳转|导航|新建|标签/i.test(query);
    const themeCommands = /主题|颜色|改成|换.*色|配色/i.test(query);
    const needsSearch = /搜索|查找|找一下|查一下|最新|今天|新闻|天气|价格|对比|是什么|怎么样|好不好/i.test(query);

    if (tabCommands) {
      // 标签页操控：直接发给 AI
      send(query, includeContext);
      return;
    }

    if (themeCommands) {
      // 主题颜色命令：直接发给 AI，不需要联网搜索
      send(query, includeContext);
      return;
    }

    // 否则：联网搜索 + AI 综合回答
    setSearching(true);
    try {
      const searchRes = await window.tabby.search.query(query);
      setSearching(false);

      if (searchRes.error) {
        console.error("search error:", searchRes.error);
        const errorMsg = `[联网检索失败: ${searchRes.error}]\n\n---\n\n用户提问: ${query}`;
        send(errorMsg, false);
        return;
      }

      if (!searchRes.results?.length) {
        send(query, includeContext);
        return;
      }

      const sources = searchRes.results
        .slice(0, 6)
        .map((r, i) => `[${i + 1}] ${r.title}\n  来源: ${r.url}\n  摘要: ${r.content}`)
        .join("\n\n");
      const deepPrompt = `用户提问: ${query}\n\n以下是从互联网搜索到的相关信息：\n\n${sources}\n\n请基于以上搜索结果，用中文综合回答用户的问题。在回答末尾列出信息来源。如果搜索结果不足以回答，请如实说明。`;
      send(deepPrompt, false);
    } catch {
      setSearching(false);
      send(query, includeContext);
    }
  };

  const handleSend = () => {
    if (!input.trim() || loading || searching) return;
    handleAiSearch(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-zinc-700">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">AI 助手</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="w-3 h-3 rounded border-gray-300 dark:border-zinc-600"
            />
            上下文
          </label>
          {messages.length > 0 && (
            <button onClick={clear} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="清除对话">清除</button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="text-3xl mb-3">🤖</div>
            <p className="text-xs text-gray-400 dark:text-zinc-500 text-center leading-relaxed">AI 侧边栏<br />输入消息与 AI 对话</p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "accent-bg text-white rounded-br-sm whitespace-pre-wrap" : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 rounded-bl-sm markdown-content"}`}>
                  {msg.role === "assistant" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {searching && (
              <div className="flex justify-center">
                <div className="accent-bg\/10 accent-border rounded-lg px-3 py-2 text-xs accent-text flex items-center gap-2">
                  <span className="w-3 h-3 border-2 accent-spin rounded-full animate-spin shrink-0" />
                  正在联网检索...
                </div>
              </div>
            )}
            {loading && !searching && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-zinc-800 rounded-xl rounded-bl-sm px-3.5 py-2.5 text-sm">
                  <span className="inline-flex items-center gap-1 text-gray-400">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
            {error && (
              <div className="flex justify-center">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-600 dark:text-red-400 max-w-full break-words">⚠️ {error}</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-200 dark:border-zinc-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            disabled={loading || searching}
            className="flex-1 px-3.5 py-2 text-sm rounded-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:accent-ring disabled:opacity-50 transition-all"
          />
          {loading ? (
            <button onClick={abort} className="px-3.5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm transition-colors flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" rx="1" /></svg>
              停止
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim() || searching} className="px-3.5 py-2 accent-bg accent-bg-hover accent-bg-disabled text-white rounded-xl text-sm transition-colors disabled:cursor-not-allowed flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              发送
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
