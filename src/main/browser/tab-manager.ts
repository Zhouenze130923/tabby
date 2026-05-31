export interface Tab {
  id: string;
  url: string;
  title: string;
  favicon: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

let tabs: Tab[] = [];
let activeTabId: string | null = null;
let onChange: ((tabs: Tab[]) => void) | null = null;

function generateId(): string {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function notify() {
  onChange?.(tabs);
}

export const tabManager = {
  setOnChange(cb: (tabs: Tab[]) => void) {
    onChange = cb;
  },

  create(url?: string): Tab {
    const tab: Tab = {
      id: generateId(),
      url: url || "about:blank",
      title: "New Tab",
      favicon: "",
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
    };
    tabs.push(tab);
    activeTabId = tab.id;
    notify();
    return tab;
  },

  close(id: string): boolean {
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    tabs.splice(idx, 1);
    if (activeTabId === id) {
      activeTabId = tabs.length > 0 ? tabs[Math.min(idx, tabs.length - 1)].id : null;
    }
    notify();
    return true;
  },

  navigate(id: string, url: string): Tab | null {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return null;
    tab.url = url;
    notify();
    return tab;
  },

  update(id: string, updates: Partial<Tab>): Tab | null {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return null;
    Object.assign(tab, updates);
    notify();
    return tab;
  },

  /** Update tab metadata silently — no push to renderer (avoids nav loops) */
  updateSilent(id: string, updates: Partial<Tab>): Tab | null {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return null;
    Object.assign(tab, updates);
    return tab;
  },

  activate(id: string): Tab | null {
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return null;
    activeTabId = id;
    notify();
    return tab;
  },

  getAll(): Tab[] {
    return [...tabs];
  },

  getActive(): Tab | null {
    return tabs.find((t) => t.id === activeTabId) || null;
  },

  getActiveId(): string | null {
    return activeTabId;
  },
};
