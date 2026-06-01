/**
 * User Memory Store — persists user preferences and knowledge about the user.
 *
 * Stores data in localStorage for persistence across sessions.
 * Common topics and facts are extracted from conversation messages.
 */

const STORAGE_KEY = "pivot-user-memory";

export interface UserMemory {
  preferences: Record<string, string>; // e.g., {theme: "dark", language: "zh"}
  commonTopics: string[]; // topics user frequently asks about
  factsLearned: string[]; // things learned about the user
  lastUpdated: string;
}

function defaultMemory(): UserMemory {
  return {
    preferences: {},
    commonTopics: [],
    factsLearned: [],
    lastUpdated: new Date().toISOString(),
  };
}

function load(): UserMemory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultMemory();
    const parsed = JSON.parse(raw);
    // Ensure all fields exist
    return {
      preferences: parsed.preferences || {},
      commonTopics: parsed.commonTopics || [],
      factsLearned: parsed.factsLearned || [],
      lastUpdated: parsed.lastUpdated || new Date().toISOString(),
    };
  } catch {
    return defaultMemory();
  }
}

function save(memory: UserMemory): void {
  memory.lastUpdated = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch (err) {
    console.error("[userMemory] Failed to save:", err);
  }
}

/**
 * Simple keyword-based topic extraction from message text.
 * Returns an array of identified topic keywords.
 */
function extractTopics(text: string): string[] {
  const topics: string[] = [];
  const lower = text.toLowerCase();

  // Tech / Programming topics
  const techKeywords: Record<string, RegExp[]> = {
    "编程/开发": [/react|vue|angular|svelte|next\.?js|nuxt/i, /python|javascript|typescript|rust|go\b|java\b|c\+\+|ruby/i, /code|api|sdk|framework|library|dependenc/i, /git|github|deploy|ci\/cd|docker|kubernetes/i],
    "AI/机器学习": [/ai |artificial intelligence|machine learning|deep learning|llm|gpt|claude|openai|neural network/i, /chatbot|rag|embedding|vector database|langchain/i, /stable diffusion|midjourney|dall-e|image generation/i],
    "浏览器/Web": [/browser|tabby|pivot|tab\b|extension|plugin|bookmark/i, /html|css|web|frontend|backend|fullstack/i, /search engine|seo|web scraping/i],
    "设计/UI": [/design|ui|ux|figma|sketch|tailwind|bootstrap|responsive/i, /color|theme|dark mode|light mode|accessibility/i, /animation|motion|transition/i],
    "数据/分析": [/data|database|sql|nosql|mongodb|postgresql|redis/i, /analytics|dashboard|visualization|chart|graph/i, /big data|etl|data pipeline|data warehouse/i],
    "安全": [/security|auth|oauth|jwt|encryption|vulnerability|penetration/i, /privacy|gdpr|cookie|consent|data protection/i],
    "系统/DevOps": [/linux|macos|windows|unix|shell|bash|zsh|terminal/i, /cloud|aws|gcp|azure|serverless|lambda|ec2|s3|cloudflare/i, /devops|infrastructure|terraform|ansible|nginx|apache/i],
    "网络": [/network|http|https|dns|ssl|tls|tcp|ip\b|websocket/i, /proxy|vpn|cdn|load balancer|firewall/i],
  };

  for (const [topic, patterns] of Object.entries(techKeywords)) {
    for (const pattern of patterns) {
      if (pattern.test(lower)) {
        topics.push(topic);
        break;
      }
    }
  }

  // General interest topics
  const generalKeywords: Record<string, RegExp> = {
    "科技新闻": /科技|tech|新闻|news|报道/i,
    "游戏": /游戏|gaming|playstation|xbox|nintendo|steam|minecraft/i,
    "音乐": /音乐|music|song|album|spotify|apple music/i,
    "电影/剧集": /电影|movie|film|netflix|disney\+|hbo|amazon prime/i,
    "体育": /体育|sports|basketball|football|soccer|nba|premier league/i,
    "财经": /财经|finance|stock|market|invest|crypto|bitcoin|ethereum/i,
    "教育": /教育|education|learn|course|tutorial|university|college|school/i,
    "健康": /健康|health|fitness|exercise|workout|meditation|yoga/i,
    "旅行": /旅行|travel|trip|vacation|destination|hotel|flight|airbnb/i,
    "美食": /美食|food|recipe|cooking|restaurant|cuisine|cafe/i,
  };

  for (const [topic, pattern] of Object.entries(generalKeywords)) {
    if (pattern.test(lower)) {
      topics.push(topic);
    }
  }

  return [...new Set(topics)]; // deduplicate
}

/**
 * Extract concrete facts about the user from messages.
 * Looks for patterns like "I am a ...", "I work as ...", "My name is ..."
 */
function extractFacts(text: string): string[] {
  const facts: string[] = [];
  const patterns = [
    /(?:我(?:是|叫|的[^。]*是)|我叫|我是)\s*([^。，!！?？\n]{2,40})/g,
    /(?:我[在在]\s*)([^。，!！?？\n]{2,40}(?:工作|学习|做|开发|研究|喜欢))/g,
    /(?:我[的]*\s*(?:专业|职业|工作|职位|身份|角色)是)\s*([^。，!！?？\n]{2,30})/g,
    /(?:我[的]*\s*(?:爱好|兴趣|喜欢|爱|想|希望|需要))\s*([^。，!！?？\n]{2,40})/g,
    /(?:我用|我使用|我习惯)\s*([^。，!！?？\n]{2,30})/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fact = match[1].trim();
      if (fact.length >= 2 && fact.length <= 40) {
        facts.push(fact);
      }
    }
  }

  // Also look for English patterns
  const englishPatterns = [
    /I(?:'m| am)\s+a\s+([^.!,?\n]{2,40})/gi,
    /I\s+work\s+(?:as|for|at|on)\s+([^.!,?\n]{2,40})/gi,
    /my\s+(?:name|job|role|profession|major)\s+is\s+([^.!,?\n]{2,30})/gi,
    /I\s+(?:like|love|enjoy|use|prefer)\s+([^.!,?\n]{2,40})/gi,
  ];

  for (const pattern of englishPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fact = match[1].trim();
      if (fact.length >= 2 && fact.length <= 40) {
        facts.push(fact);
      }
    }
  }

  return [...new Set(facts)];
}

export const userMemory = {
  /** Get the full memory object */
  get(): UserMemory {
    return load();
  },

  /** Update a preference key */
  setPreference(key: string, value: string): void {
    const memory = load();
    memory.preferences[key] = value;
    save(memory);
  },

  /** Get a specific preference */
  getPreference(key: string): string | undefined {
    const memory = load();
    return memory.preferences[key];
  },

  /** Add facts about the user */
  addFacts(newFacts: string[]): void {
    if (newFacts.length === 0) return;
    const memory = load();
    for (const fact of newFacts) {
      if (!memory.factsLearned.includes(fact)) {
        memory.factsLearned.push(fact);
      }
    }
    // Keep max 50 facts to prevent bloat
    if (memory.factsLearned.length > 50) {
      memory.factsLearned = memory.factsLearned.slice(-50);
    }
    save(memory);
  },

  /** Add topics */
  addTopics(newTopics: string[]): void {
    if (newTopics.length === 0) return;
    const memory = load();
    for (const topic of newTopics) {
      if (!memory.commonTopics.includes(topic)) {
        memory.commonTopics.push(topic);
      }
    }
    // Keep max 20 topics
    if (memory.commonTopics.length > 20) {
      memory.commonTopics = memory.commonTopics.slice(-20);
    }
    save(memory);
  },

  /** Update memory from a pair of messages (user + assistant) */
  updateFromMessages(msgs: { role: string; content: string }[]): void {
    const text = msgs.map((m) => m.content).join(" ");
    const topics = extractTopics(text);
    const facts = extractFacts(text);
    if (topics.length > 0 || facts.length > 0) {
      this.addTopics(topics);
      this.addFacts(facts);
    }
  },

  /** Reset/clear all memory */
  reset(): void {
    save(defaultMemory());
  },

  /** Update preference map in bulk */
  updatePreferences(prefs: Record<string, string>): void {
    const memory = load();
    memory.preferences = { ...memory.preferences, ...prefs };
    save(memory);
  },
};
