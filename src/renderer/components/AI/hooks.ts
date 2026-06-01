import { useState, useCallback, useRef, useEffect } from "react";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamChunk {
  type: "text" | "error" | "done";
  content?: string;
}

export type TabAction = 
  | { type: "switch"; tabId: string }
  | { type: "open"; url: string }
  | { type: "close"; tabId: string }
  | { type: "navigate"; tabId: string; url: string }
  | { type: "content"; tabId: string };

export interface UseChatOptions {
  providerName?: string;
  systemPrompt?: string;
  onAccentColor?: (color: string) => void;
  onTabAction?: (action: TabAction) => void;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  send: (content: string, includeContext?: boolean) => Promise<void>;
  clear: () => void;
  abort: () => void;
}

/**
 * React hook for AI chat with streaming support.
 *
 * Uses window.tabby.ai APIs (exposed via preload/bridge.ts):
 * - window.tabby.ai.stream() — starts streaming
 * - window.tabby.ai.onChunk() — listens for stream chunks
 * - window.tabby.ai.context() — gets current page context
 */
export function useChat(options?: UseChatOptions): UseChatReturn {
  const providerName = options?.providerName;
  const systemPrompt =
    options?.systemPrompt ||
    "You are a helpful assistant with access to the current browser page content.";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onAccentColor = options?.onAccentColor;
  const onTabAction = options?.onTabAction;
  const searchingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const send = useCallback(
    async (content: string, includeContext?: boolean) => {
      if (!content.trim()) return;

      // Abort any previous pending request
      abortRef.current?.abort();

      setLoading(true);
      setError(null);

      const userMsg: ChatMessage = { role: "user", content: content.trim() };
      const previousMessages = messages;
      setMessages((prev) => [...prev, userMsg]);

      try {
        // Optionally include current page context
        let contextInfo = "";
        if (includeContext) {
          try {
            const ctx = await window.tabby.ai.context();
            if (ctx?.url) {
              contextInfo = `\n\n[Current Page]\nTitle: ${ctx.title}\nURL: ${ctx.url}`;
            }
          } catch {
            // Silently fail — context is optional
          }
        }

        // Build the messages array
        const fullSystemPrompt = systemPrompt + (contextInfo ? contextInfo : "");
        const msgs: ChatMessage[] = [
          { role: "system", content: fullSystemPrompt },
          ...previousMessages,
          userMsg,
        ];

        // Set up streaming
        let fullContent = "";

        const cleanup = window.tabby.ai.onChunk((chunk: { type: string; content?: string }) => {
          if (chunk.type === "text" && chunk.content) {
            fullContent += chunk.content;
            // Update the last assistant message (or create one)
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last && last.role === "assistant") {
                copy[copy.length - 1] = {
                  ...last,
                  content: fullContent,
                };
              } else {
                copy.push({ role: "assistant", content: fullContent });
              }
              return copy;
            });
          } else if (chunk.type === "error") {
            const errMsg = chunk.content || "Unknown streaming error";
            setError(errMsg);
            setLoading(false);
            cleanup();
          } else if (chunk.type === "done") {
            setLoading(false);
            cleanup();
            // Check for accent color command in complete response
            if (onAccentColor && fullContent) {
              const match = fullContent.match(/\[set-accent:\s*(#[0-9a-fA-F]{3,8})\]/);
              if (match) {
                onAccentColor(match[1]);
              }
            }
            // Check for browser-style commands and execute IMMEDIATELY
            if (fullContent) {
              const styleRegex = /\[browser-style:\s*(\w+)\s*,?\s*([^\]]*)\]/g;
              let m;
              while ((m = styleRegex.exec(fullContent)) !== null) {
                const prop = m[1].trim().toLowerCase();
                const val = m[2].trim();
                try {
                  switch (prop) {
                    case "dark":
                      document.documentElement.classList.add("dark");
                      localStorage.setItem("pivot-theme", "dark");
                      break;
                    case "light":
                      document.documentElement.classList.remove("dark");
                      localStorage.setItem("pivot-theme", "light");
                      break;
                    case "bg":
                      document.body.style.background = val;
                      document.documentElement.style.setProperty("--pivot-ui-bg", val);
                      const rootEl = document.getElementById("root");
                      if (rootEl) rootEl.style.background = val;
                      localStorage.setItem("pivot-ui-bg", val);
                      break;
                    case "sidebar-bg":
                      document.documentElement.style.setProperty("--pivot-ui-sidebar-bg", val);
                      const sb = document.querySelector("[class*='sidebar']") as HTMLElement | null;
                      if (sb) sb.style.background = val;
                      localStorage.setItem("pivot-ui-sidebar-bg", val);
                      break;
                    case "font-size":
                      document.body.style.fontSize = val;
                      localStorage.setItem("pivot-ui-font-size", val);
                      break;
                  }
                  console.log(`[Pivot] browser-style: ${prop} = ${val}`);
                } catch (e) {
                  console.error("[Pivot] browser-style error:", e);
                }
              }
            }
            // Check for AI-requested search: [search: query]
            const searchMatch = fullContent.match(/\[search:\s*([^\]]+)\]/);
            if (!searchingRef.current && searchMatch) {
              searchingRef.current = true;
              const searchQuery = searchMatch[1].trim();
              (window as any).tabby.search.query(searchQuery).then((res: any) => {
                if (!res.error && res.results?.length) {
                  const sources = res.results.slice(0, 5)
                    .map((r: any, i: number) => `[${i+1}] ${r.title}\n来源: ${r.url}\n摘要: ${r.content}`)
                    .join("\n\n");
                  send(`联网搜索结果如下:\n\n${sources}\n\n请基于以上搜索结果回答用户的原始问题。如果搜索结果不够，请如实说明。`);
                } else {
                  searchingRef.current = false;
                }
              }).catch(() => { searchingRef.current = false; });
            }
            // Check for tab action commands
            if (onTabAction && fullContent) {
              const tabRegex = /\[tab-action:\s*(\w+)\s*,?\s*([^\]]*)\]/g;
              let tabMatch;
              while ((tabMatch = tabRegex.exec(fullContent)) !== null) {
                const actionType = tabMatch[1].trim();
                const args = tabMatch[2].trim();
                switch (actionType) {
                  case "switch":
                    onTabAction({ type: "switch", tabId: args });
                    break;
                  case "open":
                    onTabAction({ type: "open", url: args });
                    break;
                  case "close":
                    onTabAction({ type: "close", tabId: args });
                    break;
                  case "navigate":
                    const [tabId, ...urlParts] = args.split(",");
                    onTabAction({ type: "navigate", tabId: tabId.trim(), url: urlParts.join(",").trim() });
                    break;
                  case "content":
                    onTabAction({ type: "content", tabId: args });
                    break;
                }
              }
            }
          }
        });

        // Start the stream
        await window.tabby.ai.stream(msgs, providerName);
      } catch (err: any) {
        // Check if it was an abort
        if (err?.name === "AbortError") return;
        setError(err?.message || "Failed to send message");
        setLoading(false);
      }
    },
    [messages, providerName, systemPrompt]
  );

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setLoading(false);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
  }, []);

  return { messages, loading, error, send, clear, abort };
}
