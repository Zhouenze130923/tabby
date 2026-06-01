import { create } from "zustand";

const GROUP_PALETTE = [
  "#3b82f6",
  "#22c55e",
  "#ef4444",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

const CATEGORY_COLORS: Record<string, string> = {
  "购物": "#ef4444",
  "社交": "#22c55e",
  "工作": "#3b82f6",
  "娱乐": "#f59e0b",
  "新闻": "#8b5cf6",
  "开发": "#ec4899",
  "搜索": "#06b6d4",
  "其他": "#f97316",
};

export interface TabGroup {
  id: string;
  name: string;
  color: string;
  tabIds: string[];
}

interface TabGroupState {
  groups: TabGroup[];
  createGroup: (name: string, tabIds: string[], color?: string) => void;
  removeGroup: (id: string) => void;
  addTabToGroup: (groupId: string, tabId: string) => void;
  removeTabFromGroup: (groupId: string, tabId: string) => void;
  getGroupForTab: (tabId: string) => TabGroup | undefined;
  autoClassify: (
    tabsByUrl: Array<{ id: string; url: string; title: string }>,
  ) => void;
  renameGroup: (id: string, name: string) => void;
  setGroupColor: (id: string, color: string) => void;
}

function classifyTab(url: string, title: string): string {
  const text = `${url} ${title}`.toLowerCase();

  // Shopping
  if (
    /\b(amazon|ebay|taobao|tmall|jd\.|jd\b|shopify|shop\b|aliexpress|shein|walmart|target|bestbuy|pinduoduo|拼多多|buy\b|cart\b|checkout)\b/.test(
      text,
    )
  ) {
    return "购物";
  }

  // Social
  if (
    /\b(twitter|x\.com|x\.cn|facebook|instagram|reddit|weibo|douyin|tiktok|discord|telegram|whatsapp|zhihu|xiaohongshu|bilibili|b23\.tv|pinterest|snapchat|threads)\b/.test(
      text,
    )
  ) {
    return "社交";
  }

  // Work / Productivity
  if (
    /\b(github|gitlab|bitbucket|notion|confluence|jira|slack|teams\b|asana|trello|linear|gmail|outlook|google\s*(docs|drive|sheets|slides|calendar)|dropbox|figma|canva|miro|lark|飞书|钉钉|dingtalk)\b/.test(
      text,
    )
  ) {
    return "工作";
  }

  // Entertainment
  if (
    /\b(youtube|youtu\.be|twitch|netflix|bilibili|spotify|crunchyroll|hulu|disney\+|prime\s*video|hbomax|funimation|soundcloud|music\b|vimeo)\b/.test(
      text,
    )
  ) {
    return "娱乐";
  }

  // News
  if (
    /\b(cnn|bbc|nytimes|reuters|bloomberg|apnews|theguardian|news\b|36kr|huxiu|ithome|solidot|wsj|washingtonpost|economist|科技|财经|体育|时政)\b/.test(
      text,
    )
  ) {
    return "新闻";
  }

  // Development
  if (
    /\b(stackoverflow|npmjs|npm\b|pypi|crates\.io|docs\b|developer|codepen|codesandbox|vercel|netlify|mdn|w3schools|rustlang|typescript|react\b|vue\b|angular|node\b|deno\b|bun\b|v8\b|webpack|vite|eslint|prettier)\b/.test(
      text,
    )
  ) {
    return "开发";
  }

  // Search engines
  if (
    /\b(google|baidu|bing|duckduckgo|sogou|yahoo|yandex|search)\b/.test(text)
  ) {
    return "搜索";
  }

  return "其他";
}

export const useTabGroupStore = create<TabGroupState>((set, get) => ({
  groups: [],

  createGroup: (name, tabIds, color) => {
    const existing = get().groups;
    const nextIndex = existing.length;
    const newGroup: TabGroup = {
      id: `group_${Date.now()}_${nextIndex}`,
      name,
      color: color || GROUP_PALETTE[nextIndex % GROUP_PALETTE.length],
      tabIds,
    };
    set({ groups: [...existing, newGroup] });
  },

  removeGroup: (id) => {
    set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }));
  },

  addTabToGroup: (groupId, tabId) => {
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              tabIds: g.tabIds.includes(tabId)
                ? g.tabIds
                : [...g.tabIds, tabId],
            }
          : g,
      ),
    }));
  },

  removeTabFromGroup: (groupId, tabId) => {
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === groupId
          ? { ...g, tabIds: g.tabIds.filter((id) => id !== tabId) }
          : g,
      ),
    }));
  },

  getGroupForTab: (tabId) => {
    return get().groups.find((g) => g.tabIds.includes(tabId));
  },

  autoClassify: (tabsByUrl) => {
    const groups: Record<string, TabGroup> = {};

    tabsByUrl.forEach((tab, _i) => {
      const category = classifyTab(tab.url, tab.title);
      if (!groups[category]) {
        const color =
          CATEGORY_COLORS[category] ||
          GROUP_PALETTE[Object.keys(groups).length % GROUP_PALETTE.length];
        groups[category] = {
          id: `group_${Date.now()}_${Object.keys(groups).length}`,
          name: category,
          color,
          tabIds: [],
        };
      }
      groups[category].tabIds.push(tab.id);
    });

    set({ groups: Object.values(groups) });
  },

  renameGroup: (id, name) => {
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, name } : g)),
    }));
  },

  setGroupColor: (id, color) => {
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, color } : g)),
    }));
  },
}));
