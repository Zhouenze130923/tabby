import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChat, ChatMessage } from "./hooks";
import { useThemeStore } from "../../stores/themeStore";
import { useTabGroupStore } from "../../stores/tabGroupStore";
import { userMemory } from "../../stores/userMemoryStore";
import ConversationPanel from "../History/ConversationPanel";
import KnowledgePanel from "../Knowledge/KnowledgePanel";

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
  const [groupInfo, setGroupInfo] = useState<string>("");
  const [showHistory, setShowHistory] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState("新对话");
  const pendingPromptRef = useRef(false);
  // Research Agent state
  const [researchActive, setResearchActive] = useState(false);
  const [researchLogs, setResearchLogs] = useState<string[]>([]);
  const [researchReport, setResearchReport] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialSent = useRef(false);
  // Track saved messages to avoid duplicate saves
  const lastSavedCountRef = useRef(0);
  const conversationInitialized = useRef(false);

  // Build user memory string for the system prompt
  const buildUserMemoryStr = useCallback((): string => {
    try {
      const memory = userMemory.get();
      const parts: string[] = [];

      if (memory.preferences && Object.keys(memory.preferences).length > 0) {
        parts.push("用户偏好: " + Object.entries(memory.preferences)
          .map(([k, v]) => `${k}: ${v}`).join(", "));
      }

      if (memory.commonTopics && memory.commonTopics.length > 0) {
        parts.push("用户常讨论的主题: " + memory.commonTopics.join(", "));
      }

      if (memory.factsLearned && memory.factsLearned.length > 0) {
        const recentFacts = memory.factsLearned.slice(-5);
        parts.push("关于用户: " + recentFacts.join("; "));
      }

      return parts.length > 0 ? "\n\n[用户记忆]\n" + parts.join("\n") : "";
    } catch {
      return "";
    }
  }, []);

  // 构建包含标签页信息的系统提示
  const buildSystemPrompt = (tabsInfo: string, groupsText: string) =>
  `You are an AI assistant inside the Pivot browser. You control the browser by including command tags in your response.

Open tabs:
${tabsInfo || "(none)"}

WEB SEARCH — You can request real-time web search! When the user asks about current events, weather, news, prices, or any information that requires up-to-date data, include [search: the user's question] in your response and I will search the web and give you the results to answer with.

Examples:
User: 今天天气怎么样 → [search: 今天天气] I'll look that up for you.
User: 最近有什么新闻 → [search: 最新新闻] Searching the web now.
User: 苹果股价多少 → [search: 苹果股价]
User: 华为Mate70评测 → [search: 华为Mate70评测]

IMPORTANT: For any question about current events, real-time data, or facts you're unsure about, use [search: ...] to get real information.

COMMANDS:
- [tab-action: open URL] — open URL in new tab
- [tab-action: switch tabId] — switch to tab
- [tab-action: close tabId] — close tab
- [tab-action: navigate tabId, URL] — navigate tab
- [tab-action: click tabId, .selector] — click element
- [tab-action: type tabId, #input, text] — fill input
- [tab-action: extract tabId] — extract text
- [tab-action: classify] — group tabs
- [tab-action: schedule name, ms, prompt] — create task
- [tab-action: create-page, full HTML content here] — create a webpage from HTML and open it
- [set-accent: #HEX] — change browser accent color

FILE COMMANDS:
- [file-action: read /path/to/file] — read file content
- [file-action: write /path/to/file, content to write] — write to file
- [file-action: list /path/to/dir] — list directory
- [file-action: select] — open file picker dialog
- [file-action: screenshot tabId] — take screenshot of tab (_active_ for current)
- [file-action: getPageInfo tabId] — get full page info (title, url, text, html)
- [file-action: highlight tabId, .selector] — highlight element on page
- [file-action: js tabId, code] — execute JS in tab
- [file-action: delete /path/to/file] — permanently delete file
- [file-action: trash /path/to/file] — move file to trash

BROWSER STYLE:
- [browser-style: dark/light] — switch theme
- [browser-style: bg, color/gradient] — set background
- [browser-style: sidebar-bg, color] — set sidebar
- [browser-style: radius, px] — border radius
- [browser-style: font-size, px] — font size

Examples:
User: 今天天气怎么样 → [search: 今天天气] 让我查一下...
User: 改为深色模式 → [browser-style: dark] 已切换
User: 打开百度 → [tab-action: open https://baidu.com] 已打开
User: 帮我生成一个登录页面 → [tab-action: create-page, <html>...</html>] 已创建

Current accent: ${accentColor}
Tab Groups: ${groupsText || "(none)"}

Current accent: ${accentColor}
Tab Groups: ${groupsText || "(none)"}
Respond in Chinese.${buildUserMemoryStr()}`;

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

  // Initialize a new conversation on mount
  useEffect(() => {
    if (conversationInitialized.current) return;
    conversationInitialized.current = true;
    createNewConversation();
  }, []);

  const createNewConversation = useCallback(async () => {
    try {
      const conv = await window.tabby.conversations.create();
      setCurrentConversationId(conv.id);
      setConversationTitle(conv.title);
      clear();
      lastSavedCountRef.current = 0;
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  }, []);

  const loadConversationById = useCallback(async (conversationId: string) => {
    try {
      // Load messages from DB
      const msgs = await window.tabby.messages.list(conversationId);
      const chatMsgs: ChatMessage[] = msgs.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));
      // Set them in the hook
      loadMessages(chatMsgs);
      setCurrentConversationId(conversationId);
      lastSavedCountRef.current = chatMsgs.filter(
        (m) => m.role === "user" || m.role === "assistant"
      ).length;
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  }, []);

  // Save messages after each response round
  const handleAfterResponse = useCallback(
    async (userMsg: ChatMessage, assistantMsg: ChatMessage) => {
      if (!currentConversationId) return;
      try {
        await window.tabby.messages.add(currentConversationId, userMsg.role, userMsg.content);
        await window.tabby.messages.add(currentConversationId, assistantMsg.role, assistantMsg.content);
        lastSavedCountRef.current += 2;

        // Extract title from first user message
        const msgs = await window.tabby.messages.list(currentConversationId);
        if (msgs.length === 2) {
          // First exchange — auto-title from user's first message
          const firstUserMsg = msgs.find((m) => m.role === "user");
          if (firstUserMsg) {
            const title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? "…" : "");
            await window.tabby.conversations.rename(currentConversationId, title);
            setConversationTitle(title);
          }
        }

        // Update user memory after conversation
        try {
          userMemory.updateFromMessages([userMsg, assistantMsg]);
        } catch {}
      } catch (err) {
        console.error("Failed to save messages:", err);
      }
    },
    [currentConversationId]
  );

  const [systemPrompt, setSystemPrompt] = useState("");
  useEffect(() => {
    setSystemPrompt(buildSystemPrompt(tabList, groupInfo));
  }, [tabList, accentColor, groupInfo]);

  // 在 hooks 的 done 回调中直接执行 tab-action
  const onTabActionRef = useRef(async (action: any) => {
    try {
      switch (action.type) {
        case "open": await window.tabby.tab.create(action.url); break;
        case "switch": await window.tabby.tab.switch(action.tabId); break;
        case "close": await window.tabby.tab.close(action.tabId); break;
        case "navigate": await window.tabby.tab.navigate(action.tabId, action.url); break;
        case "classify": {
          const tabs = await window.tabby.tab.getAllInfo();
          useTabGroupStore.getState().autoClassify(tabs);
          break;
        }
        case "create-page": {
          const res = await window.tabby.tab.createPage(action.html);
          if (res.success && res.url) await window.tabby.tab.create(res.url);
          break;
        }
        case "schedule": {
          await window.tabby.tasks.create(action.task);
          break;
        }
      }
    } catch (e) { console.error("onTabAction error:", e); }
  });

  const { messages, loading, error, send, clear, abort, loadMessages } = useChat({
    onAccentColor: setAccentColor,
    onTabAction: (action) => { onTabActionRef.current(action); },
    onAfterResponse: handleAfterResponse,
    systemPrompt,
  });

  // 过滤掉隐藏的工具消息（必须在 messages 初始化之后）
  var visibleMessages = messages.filter(function(m: any) {
    return !(m.role === "user" && m.content.startsWith("[文件内容:"));
  });

  // 流完成后再检查一次 tab-action 标记（作为补充）
  const processedMsgCount = useRef(0);
  useEffect(() => {
    if (loading) return;
    if (messages.length <= processedMsgCount.current) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    processedMsgCount.current = messages.length;

    const tabRegex = /\[tab-action:\s*(\w+)\s*,?\s*([^\]]*)\]/g;
    let match;
    while ((match = tabRegex.exec(last.content)) !== null) {
      const actionType = match[1].trim();
      let args = match[2].trim();
      // Replace _active_ with the current tab ID in the first argument
      if (args.startsWith("_active_")) {
        const rest = args.slice(8).trim();
        args = (tabId || "") + (rest ? "," + rest : "");
      }
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
            window.tabby.tab.getAllInfo().then((tabs) => {
              useTabGroupStore.getState().autoClassify(tabs);
            });
            break;
          }
          case "group": {
            const parts = args.split(",").map((s) => s.trim());
            const groupName = parts[0];
            const tabIds = parts.slice(1).filter((id) => id.length > 0);
            if (groupName) {
              useTabGroupStore.getState().createGroup(groupName, tabIds);
            }
            break;
          }
          case "click": {
            const sep = args.indexOf(",");
            if (sep > 0) {
              const tid = args.slice(0, sep).trim();
              const selector = args.slice(sep + 1).trim();
              window.tabby.tab.clickElement(tid, selector);
            }
            break;
          }
          case "type": {
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
            const parts = args.split(",").map((s) => s.trim());
            const taskName = parts[0];
            if (!taskName) break;
            const typeOrInterval = parts[1];
            if (!typeOrInterval) break;
            if (typeOrInterval === "cron") {
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
          case "create-page": {
            const htmlContent = args.trim();
            if (htmlContent) {
              window.tabby.tab.createPage(htmlContent).then(res => {
                if (res.success && res.url) {
                  window.tabby.tab.create(res.url);
                }
              });
            }
            break;
          }
        }
      } catch (e) {
        console.error("tab-action failed:", e);
      }
    }

    // 处理 [file-action:] 命令
    const fileRegex = /\[file-action:\s*(\w+)\s*,?\s*([^\]]*)\]/g;
    let fileMatch;
    while ((fileMatch = fileRegex.exec(last.content)) !== null) {
      const actionType = fileMatch[1].trim();
      const args = fileMatch[2].trim();
      try {
        switch (actionType) {
          case "read": {
            // 静默读取文件，不显示结果
            window.tabby.file.read(args).catch(function(){});
            break;
          }
          case "write": {
            var writeSep = args.indexOf(",");
            if (writeSep > 0) {
              window.tabby.file.write(args.slice(0, writeSep).trim(), args.slice(writeSep + 1).trim()).catch(function(){});
            }
            break;
          }
          case "list": {
            window.tabby.file.list(args).catch(function(){});
            break;
          }
          case "delete": {
            window.tabby.file.delete(args).catch(function(){});
            break;
          }
          case "trash": {
            window.tabby.file.trash(args).catch(function(){});
            break;
          }
          case "select": {
            window.tabby.file.select().catch(function(){});
            break;
          }
          case "screenshot": {
            var sTargetId = !args || args === "_active_" ? tabId : args;
            if (sTargetId) window.tabby.tab.screenshot(sTargetId).catch(function(){});
            break;
          }
          case "getPageInfo": {
            var gTargetId = !args || !isNaN(Number(args)) ? tabId : args;
            if (gTargetId) window.tabby.tab.getPageInfo(gTargetId).catch(function(){});
            break;
          }
          case "highlight": {
            var hParts = args.split(",");
            var hTid = hParts[0].trim();
            var hSel = hParts.slice(1).join(",").trim();
            var hTabId2 = (!hTid || hTid === "_active_" || !isNaN(Number(hTid))) ? tabId : hTid;
            if (hTabId2 && hSel.length > 0) window.tabby.tab.highlight(hTabId2, hSel);
            break;
          }
          case "js": {
            var jParts = args.split(",");
            var jTid = jParts[0].trim();
            var jCode = jParts.slice(1).join(",").trim();
            var jsTabId2 = (!jTid || jTid === "_active_" || !isNaN(Number(jTid))) ? tabId : jTid;
            if (jsTabId2 && jCode) window.tabby.tab.executeJS(jsTabId2, jCode).catch(function(){});
            break;
          }
        }
      } catch (e) {
        console.error("file-action failed:", e);
      }
    }
  }, [messages, loading]);

  // Use refs to avoid stale closures with send
  const sendRef = useRef(send);
  sendRef.current = send;

  // Research Agent — detect /research commands
  useEffect(() => {
    if (executePrompt?.text?.startsWith("/research")) {
      startResearch(executePrompt.text.replace("/research", "").trim() || "帮我调研这个主题");
      onPromptExecuted?.();
    }
  }, [executePrompt]);

  // Listen for research:done events
  useEffect(() => {
    const unsub = window.tabby.research.onDone((data: any) => {
      setResearchActive(false);
      if (data.report) {
        setResearchReport(data.report);
        const sectionsText = (data.report.sections || []).map((s: any) => "### " + s.heading + "\n" + s.content).join("\n\n");
        const reportText = "## 📊 调研报告: " + data.report.title + "\n\n" + data.report.summary + "\n\n" + sectionsText + "\n\n### 结论\n" + data.report.conclusion;
        sendRef.current(reportText, false);
      }
      if (data.logs) {
        setResearchLogs(data.logs);
      }
    });
    return unsub;
  }, []);

  const startResearch = async (query: string) => {
    try {
      setResearchActive(true);
      setResearchLogs([]);
      setResearchReport(null);
      await window.tabby.research.start(query);
    } catch (err: any) {
      setResearchActive(false);
      sendRef.current("调研启动失败: " + err.message, false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Execute prompt template from PromptsPanel
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

  const handleNewConversation = async (): Promise<string | null> => {
    try {
      const conv = await window.tabby.conversations.create();
      setCurrentConversationId(conv.id);
      setConversationTitle(conv.title);
      clear();
      lastSavedCountRef.current = 0;
      return conv.id;
    } catch (err) {
      console.error("Failed to create conversation:", err);
      return null;
    }
  };

  const handleAiSearch = async (query: string) => {
    send(query, includeContext);
  };

  const handleSend = () => {
    if (!input.trim() || loading || searching) return;
    handleAiSearch(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 中文输入法：Enter 用于选词，不发送
    if ((e as any).nativeEvent?.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearAndNew = () => {
    handleNewConversation();
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--pivot-ui-sidebar-bg)" }}>
      {/* Header with history button */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-zinc-700">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate" title={conversationTitle}>
            {conversationTitle}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="w-3 h-3 rounded border-gray-300 dark:border-zinc-600"
            />
            上下文
          </label>
          <button
            onClick={() => setShowHistory(true)}
            className="px-2 py-1 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            title="对话历史"
          >
            历史
          </button>
          {visibleMessages.length > 0 && (
            <>
              <button
                onClick={handleClearAndNew}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="新建对话"
              >
                新建
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="text-3xl mb-3">🤖</div>
            <p className="text-xs text-gray-400 dark:text-zinc-500 text-center leading-relaxed">AI 侧边栏<br />输入消息与 AI 对话</p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {visibleMessages.map(function(msg: any, i: number) {
              return <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "user" ? "accent-bg text-white rounded-br-sm whitespace-pre-wrap" : "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-200 rounded-bl-sm markdown-content"}`}>
                  {msg.role === "assistant" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>;
            })}
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

      {/* Research Agent progress */}
      {researchActive && (
        <div className="px-3 py-2 border-t border-gray-200 dark:border-zinc-700 bg-blue-50/50 dark:bg-blue-900/10">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-400">自主调研进行中...</span>
          </div>
          <div className="max-h-20 overflow-y-auto space-y-0.5">
            {researchLogs.map((log, i) => (
              <p key={i} className="text-[10px] text-blue-600/70 dark:text-blue-400/70 font-mono">{log}</p>
            ))}
          </div>
        </div>
      )}
      {researchReport && (
        <div className="px-3 py-2 border-t border-gray-200 dark:border-zinc-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">📊 调研报告</span>
            <button
              onClick={() => setResearchReport(null)}
              className="text-[10px] text-gray-400 hover:text-gray-600"
            >
              关闭
            </button>
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 max-h-40 overflow-y-auto leading-relaxed">
            {researchReport.summary && (
              <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">{researchReport.summary.slice(0, 200)}</p>
            )}
            {researchReport.sections?.map((s: any, i: number) => (
              <details key={i} className="mb-1">
                <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">{s.heading}</summary>
                <p className="mt-1 text-gray-500 dark:text-zinc-400">{s.content.slice(0, 300)}</p>
              </details>
            ))}
            {researchReport.sources?.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-zinc-700">
                <p className="text-[10px] text-gray-400 mb-1">来源:</p>
                {researchReport.sources.map((src: string, i: number) => (
                  <p key={i} className="text-[10px] text-blue-500 truncate">{src}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* Knowledge Panel — 知识库增强浏览 (独家功能) */}
      <KnowledgePanel />

      {/* Conversation History Panel */}
      {showHistory && (
        <ConversationPanel
          onClose={() => setShowHistory(false)}
          onLoadConversation={loadConversationById}
          onNewConversation={handleNewConversation}
        />
      )}
    </div>
  );
}
