/**
 * Knowledge Bridge — 零酱知识库集成
 *
 * 所有知识库查询均为 **异步** 执行，不阻塞主进程。
 * 内置节流和缓存机制。
 */

import { exec } from "child_process";
import { existsSync } from "fs";
import { knowledgeCache } from "../storage/db";

const KB_QUERY_SCRIPT = process.env.HOME + "/.openclaw/workspace/scripts/query_kb.py";
const PERSONAL_KB_CLI = process.env.HOME + "/personal_kb/cli.py";

export interface KnowledgeItem {
  title: string;
  content: string;
  source: string;
  score: number;
}

/** 内存缓存：避免短时间内重复查询 */
const queryCache = new Map<string, { items: KnowledgeItem[]; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

/** 节流：同一关键词 10 秒内不再重复查询 */
const throttleMap = new Map<string, number>();

function isThrottled(key: string): boolean {
  const last = throttleMap.get(key);
  if (last && Date.now() - last < 10000) return true;
  throttleMap.set(key, Date.now());
  return false;
}

/**
 * 异步查询零酱知识库。
 */
function queryZeroKb(query: string): Promise<KnowledgeItem[]> {
  return new Promise((resolve) => {
    if (!existsSync(KB_QUERY_SCRIPT)) return resolve([]);
    exec(
      `python3 "${KB_QUERY_SCRIPT}" "${query.replace(/"/g, '\\"')}" 2>/dev/null | head -10`,
      { timeout: 3000 },
      (error, stdout) => {
        if (error || !stdout) return resolve([]);
        const lines = stdout.trim().split("\n");
        const items = lines
          .filter((l) => l.includes(" -- "))
          .map((l) => {
            const sep = l.indexOf(" -- ");
            return {
              title: l.slice(0, sep).trim(),
              content: l.slice(sep + 4).trim(),
              source: "zero-kb" as const,
              score: 1.0,
            };
          });
        resolve(items);
      }
    );
  });
}

/**
 * 异步查询个人知识库。
 */
function queryPersonalKb(query: string): Promise<KnowledgeItem[]> {
  return new Promise((resolve) => {
    if (!existsSync(PERSONAL_KB_CLI)) return resolve([]);
    exec(
      `python3 "${PERSONAL_KB_CLI}" search "${query.replace(/"/g, '\\"')}" 2>/dev/null | head -10`,
      { timeout: 3000 },
      (error, stdout) => {
        if (error || !stdout) return resolve([]);
        const items: KnowledgeItem[] = [];
        const lines = stdout.trim().split("\n");
        for (const line of lines) {
          if (line.startsWith("{") && line.endsWith("}")) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.title || parsed.content) {
                items.push({
                  title: parsed.title || parsed.name || "知识条目",
                  content: parsed.content || parsed.text || parsed.snippet || "",
                  source: "personal-kb",
                  score: parsed.score || 1.0,
                });
              }
            } catch {}
          } else if (line.includes("\t")) {
            const [title, content] = line.split("\t");
            if (title && content) {
              items.push({ title: title.trim(), content: content.trim(), source: "personal-kb", score: 1.0 });
            }
          }
        }
        resolve(items);
      }
    );
  });
}

/**
 * 异步全源知识搜索。
 */
export async function searchKnowledge(query: string): Promise<KnowledgeItem[]> {
  if (!query || query.length < 1) return [];
  const cacheKey = query.toLowerCase().trim();

  // 缓存命中
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.items;
  }

  // 节流
  if (isThrottled(cacheKey)) return [];

  try {
    const [zeroItems, personalItems] = await Promise.all([
      queryZeroKb(query),
      queryPersonalKb(query),
    ]);
    const items = [...zeroItems, ...personalItems];

    // 缓存结果
    queryCache.set(cacheKey, { items, timestamp: Date.now() });

    return items;
  } catch {
    return [];
  }
}

/**
 * 异步构建知识上下文（用于 AI system prompt）。
 */
export async function buildKnowledgeContext(query: string, maxItems = 5): Promise<string> {
  const items = await searchKnowledge(query);
  if (items.length === 0) return "";
  const top = items.slice(0, maxItems);
  return (
    "\n\n[相关知识点]\n" +
    top
      .map(
        (item, i) =>
          `${i + 1}. ${item.title}\n   来源: ${item.source}\n   内容: ${item.content.slice(0, 200)}${item.content.length > 200 ? "…" : ""}`
      )
      .join("\n\n")
  );
}

/** 上次自动检测的时间 */
let lastAutoDetect = 0;
const AUTO_DETECT_THROTTLE = 5000; // 5 秒内不重复检测

/**
 * 浏览页面时自动检测相关知识点。
 * 异步执行，不阻塞。
 * 内置缓存和节流。
 */
export async function autoDetectKnowledge(pageTitle: string, pageUrl: string, pageContent: string): Promise<KnowledgeItem[]> {
  // 节流：5 秒内不重复跑
  const now = Date.now();
  if (now - lastAutoDetect < AUTO_DETECT_THROTTLE) return [];
  lastAutoDetect = now;

  const keywords: string[] = [];
  const title = (pageTitle + " " + pageUrl).toLowerCase();

  const termPatterns = [
    /(react|vue|angular|svelte)/gi,
    /(python|javascript|typescript|rust|go|java)/gi,
    /(docker|kubernetes|k8s)/gi,
    /(ai|llm|gpt|claude|openai|deepseek)/gi,
    /(sql|database|postgres|redis|mongodb)/gi,
    /(linux|macos|windows|ubuntu)/gi,
    /(browser|electron|chrome|firefox|safari)/gi,
    /(class|school|student|teacher|course|grade)/gi,
  ];

  for (const pattern of termPatterns) {
    const matches = title.match(pattern);
    if (matches) keywords.push(...matches.map((m) => m.toLowerCase()));
  }

  const contentStart = pageContent.slice(0, 1000).toLowerCase();
  const contentPatterns = [
    /(华棠|班级管理|huatang)/gi,
    /(零酱|zerobot)/gi,
    /(openclaw|gateway)/gi,
    /(knowledge|知识库|知识图谱|ontology)/gi,
    /(stock|股票|finance|投资)/gi,
    /(shooter|游戏|tactical|5v5)/gi,
  ];
  for (const pattern of contentPatterns) {
    const matches = contentStart.match(pattern);
    if (matches) keywords.push(...matches.map((m) => m.toLowerCase()));
  }

  if (keywords.length === 0) return [];

  const unique = [...new Set(keywords)].slice(0, 3); // 最多 3 个关键词

  const results: KnowledgeItem[] = [];
  for (const kw of unique) {
    const items = await searchKnowledge(kw);
    results.push(...items);
  }

  const seen = new Set<string>();
  const deduped = results.filter((item) => {
    const key = item.title + item.content.slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);

  // 缓存到数据库
  for (const item of deduped) {
    try {
      knowledgeCache.add(item.title, item.content.slice(0, 500), item.source, "");
    } catch {}
  }

  return deduped;
}
