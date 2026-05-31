import { create } from "zustand";

export interface Tab {
  id: string;
  url: string;
  title: string;
  favicon: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
}

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  setTabs: (tabs: Tab[]) => void;
  setActiveTab: (id: string) => void;
  addTab: (tab: Tab) => void;
  removeTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
}

export const useTabStore = create<TabState>((set) => ({
  tabs: [],
  activeTabId: null,

  setTabs: (tabs) => set({ tabs }),

  setActiveTab: (activeTabId) => set({ activeTabId }),

  addTab: (tab) =>
    set((s) => ({ tabs: [...s.tabs, tab], activeTabId: tab.id })),

  removeTab: (id) =>
    set((s) => {
      const idx = s.tabs.findIndex((t) => t.id === id);
      const tabs = s.tabs.filter((t) => t.id !== id);
      const activeTabId =
        s.activeTabId === id
          ? tabs.length > 0
            ? tabs[Math.min(idx, tabs.length - 1)].id
            : null
          : s.activeTabId;
      return { tabs, activeTabId };
    }),

  updateTab: (id, updates) =>
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
}));
