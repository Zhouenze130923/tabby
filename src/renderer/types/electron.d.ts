/* eslint-disable @typescript-eslint/no-explicit-any */

/** 扩展 JSX 原生元素以支持 Electron webview */
declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        nodeintegration?: string;
        enableremotemodule?: string;
        partition?: string;
        allowpopups?: string;
        preload?: string;
        httpreferrer?: string;
        useragent?: string;
        disablewebsecurity?: string;
        ref?: React.Ref<WebviewTag>;
      },
      HTMLElement
    >;
  }
}

/** webview DOM 元素上的方法 */
interface WebviewTag extends HTMLElement {
  src: string;
  canGoBack(): boolean;
  canGoForward(): boolean;
  goBack(): void;
  goForward(): void;
  reload(): void;
  stop(): void;
  loadURL(url: string): void;
  getURL(): string;
  getTitle(): string;
  isWaitingForResponse(): boolean;
  addEventListener(
    type: "did-navigate",
    listener: (e: WebviewNavigateEvent) => void
  ): void;
  addEventListener(
    type: "did-navigate-in-page",
    listener: (e: WebviewNavigateEvent) => void
  ): void;
  addEventListener(
    type: "did-start-loading",
    listener: (e: Event) => void
  ): void;
  addEventListener(
    type: "did-stop-loading",
    listener: (e: Event) => void
  ): void;
  addEventListener(
    type: "page-title-updated",
    listener: (e: WebviewTitleEvent) => void
  ): void;
  addEventListener(
    type: "page-favicon-updated",
    listener: (e: WebviewFaviconEvent) => void
  ): void;
  addEventListener(
    type: "did-fail-load",
    listener: (e: WebviewFailEvent) => void
  ): void;
  addEventListener(type: string, listener: (e: any) => void): void;
  removeEventListener(type: string, listener: (e: any) => void): void;
}

interface WebviewNavigateEvent extends Event {
  url: string;
}

interface WebviewTitleEvent extends Event {
  title: string;
}

interface WebviewFaviconEvent extends Event {
  favicons: string[];
}

interface WebviewFailEvent extends Event {
  errorCode: number;
  errorDescription: string;
  validatedURL: string;
}

interface Prompt {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
  created_at: string;
}

interface PromptInput {
  id?: string;
  name: string;
  description?: string;
  prompt: string;
  category?: string;
}

interface Window {
  tabby: {
    tab: {
      create: (url?: string) => Promise<Tab>;
      navigate: (id: string, url: string) => Promise<any>;
      close: (id: string) => Promise<any>;
      back: (id: string) => Promise<any>;
      forward: (id: string) => Promise<any>;
      reload: (id: string) => Promise<any>;
      list: () => Promise<Tab[]>;
      activate: (id: string) => Promise<any>;
      onUpdate: (cb: (tabs: Tab[], activeTabId: string | null) => void) => () => void;
      getContent: (id: string) => Promise<string>;
      updateMeta: (id: string, updates: Record<string, unknown>) => Promise<any>;
      registerWebview: (tabId: string, webContentsId: number) => Promise<any>;
      getAllInfo: () => Promise<Array<{id: string; url: string; title: string; favicon: string; isLoading: boolean; isActive: boolean}>>;
      switch: (id: string) => Promise<boolean>;
      executeJS: (tabId: string, code: string) => Promise<{success: boolean; result?: any; error?: string}>;
      clickElement: (tabId: string, selector: string) => Promise<{success: boolean; error?: string}>;
      fillInput: (tabId: string, selector: string, value: string) => Promise<{success: boolean; error?: string}>;
      extractText: (tabId: string, selector?: string) => Promise<{success: boolean; text?: string; error?: string}>;
      scrollTo: (tabId: string, x: number, y: number) => Promise<{success: boolean; error?: string}>;
      createPage: (html: string) => Promise<{success: boolean; url?: string; error?: string}>;
    };
    ai: {
      chat: (messages: any[], provider?: string) => Promise<string>;
      stream: (messages: any[], provider?: string) => Promise<any>;
      context: () => Promise<any>;
      onChunk: (cb: (chunk: {type: string; content: string}) => void) => () => void;
      cancel: () => Promise<void>;
    };
    settings: {
      get: () => Promise<any>;
      set: (key: string, value: any) => Promise<void>;
      getProvider: (name: string) => Promise<any>;
      setProvider: (name: string, config: any) => Promise<void>;
    };
    bookmark: {
      list: () => Promise<any[]>;
      add: (url: string, title: string) => Promise<any>;
      remove: (id: number) => Promise<any>;
    };
    history: {
      search: (query: string) => Promise<any[]>;
      list: (opts?: {limit?: number; offset?: number; query?: string}) => Promise<{entries: any[]; total: number}>;
      clear: () => Promise<{success: boolean}>;
    };
    skills: {
      list: () => Promise<any[]>;
      run: (name: string, context?: Record<string, string>) => Promise<string>;
    };
    import: {
      fromChrome: () => Promise<ImportResult>;
      fromSafari: () => Promise<ImportResult>;
      fromFirefox: () => Promise<ImportResult>;
      fromAll: () => Promise<ImportResult[]>;
    };
    prompts: {
      list: () => Promise<Prompt[]>;
      save: (p: PromptInput) => Promise<Prompt>;
      delete: (id: string) => Promise<boolean>;
    };
    search: {
      query: (q: string) => Promise<{results: SearchResult[]; answer?: string; error?: string}>;
      getConfig: () => Promise<SearchConfig>;
      saveConfig: (config: SearchConfig) => Promise<{success: boolean}>;
    };
    conversations: {
      list: () => Promise<Conversation[]>;
      create: (title?: string) => Promise<Conversation>;
      remove: (id: string) => Promise<boolean>;
      rename: (id: string, title: string) => Promise<boolean>;
    };
    messages: {
      list: (conversationId: string) => Promise<Message[]>;
      add: (conversationId: string, role: string, content: string) => Promise<Message>;
      clear: (conversationId: string) => Promise<boolean>;
    };
    tasks: {
      list: () => Promise<ScheduledTask[]>;
      create: (task: Omit<ScheduledTask, "created_at">) => Promise<ScheduledTask>;
      update: (id: string, updates: Partial<ScheduledTask>) => Promise<boolean>;
      delete: (id: string) => Promise<boolean>;
      toggle: (id: string, active: boolean) => Promise<boolean>;
      onExecute: (cb: (task: { id: string; name: string; prompt: string }) => void) => () => void;
    };
    window: {
      minimize: () => Promise<void>;
      maximize: () => Promise<void>;
      close: () => Promise<void>;
      isMaximized: () => Promise<boolean>;
      onMaximizedChange: (cb: (maximized: boolean) => void) => void;
    };
  };
}

interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

interface ImportResult {
  browser: string;
  count: number;
  success: boolean;
  error?: string;
}

interface ScheduledTask {
  id: string;
  name: string;
  type: "interval" | "cron" | "once";
  interval_ms?: number;
  cron_expr?: string;
  prompt: string;
  tab_url?: string;
  active: boolean;
  last_run?: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface Message {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string;
}

interface SearchConfig {
  provider: string;
  tavilyApiKey?: string;
  searxngUrl?: string;
}

interface Tab {
  id: string;
  url: string;
  title: string;
  favicon: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}
