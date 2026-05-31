// Search engine abstraction for real web search
// Supports Tavily API and self-hosted SearXNG

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  answer?: string; // Tavily supports direct AI-generated answer
  query: string;
}

export interface SearchProvider {
  name: string;
  search(query: string, maxResults?: number): Promise<SearchResponse>;
}

// Tavily provider — AI-optimized search API
// Sign up at https://tavily.com
export class TavilyProvider implements SearchProvider {
  name = "tavily";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, maxResults = 8): Promise<SearchResponse> {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        max_results: maxResults,
        include_answer: true,
        search_depth: "advanced",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Tavily search failed (${res.status}): ${err}`);
    }

    const data = await res.json();
    return {
      query: data.query,
      answer: data.answer,
      results: (data.results || []).map((r: any) => ({
        title: r.title || "",
        url: r.url || "",
        content: r.content || "",
        score: r.score,
      })),
    };
  }
}

// SearXNG provider — self-hosted metasearch engine
// Requires a running SearXNG instance (e.g., http://localhost:8888)
export class SearXNGProvider implements SearchProvider {
  name = "searxng";
  private baseUrl: string;

  constructor(baseUrl: string) {
    // Ensure URL ends without trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async search(query: string, maxResults = 8): Promise<SearchResponse> {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      language: "zh-CN",
      categories: "general",
      pageno: "1",
    });

    const res = await fetch(`${this.baseUrl}/search?${params}`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`SearXNG search failed (${res.status})`);
    }

    const data = await res.json();
    return {
      query,
      results: (data.results || []).slice(0, maxResults).map((r: any) => ({
        title: r.title || "",
        url: r.url || "",
        content: r.content || r.snippet || "",
      })),
    };
  }
}

// Get configured search provider from settings
export function getSearchProvider(config: {
  provider: string;
  tavilyApiKey?: string;
  searxngUrl?: string;
}): SearchProvider {
  switch (config.provider) {
    case "tavily":
      if (!config.tavilyApiKey) throw new Error("Tavily API Key 未配置");
      return new TavilyProvider(config.tavilyApiKey);
    case "searxng":
      if (!config.searxngUrl) throw new Error("SearXNG 地址未配置");
      return new SearXNGProvider(config.searxngUrl);
    default:
      throw new Error(`未知搜索后端: ${config.provider}`);
  }
}
