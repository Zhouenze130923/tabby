import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";
import { SCHEMA } from "./schema";
import { runMigrations } from "./migration";

const dbPath = path.join(app.getPath("userData"), "pivot.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Initialize schema first, then run migrations
db.exec(SCHEMA);
runMigrations(db);

export const bookmarks = {
  list(): Array<{id: number; url: string; title: string; favicon: string; created_at: string}> {
    const stmt = db.prepare("SELECT id, url, title, favicon, created_at FROM bookmarks ORDER BY created_at DESC");
    return stmt.all() as Array<{id: number; url: string; title: string; favicon: string; created_at: string}>;
  },
  add(url: string, title: string, favicon?: string): {id: number} {
    const stmt = db.prepare("INSERT INTO bookmarks (url, title, favicon) VALUES (?, ?, ?)");
    const info = stmt.run(url, title, favicon ?? "");
    return { id: Number(info.lastInsertRowid) };
  },
  remove(id: number): boolean {
    const stmt = db.prepare("DELETE FROM bookmarks WHERE id = ?");
    const info = stmt.run(id);
    return info.changes > 0;
  },
};

interface HistoryListOptions {
  limit?: number;
  offset?: number;
  query?: string;
}

interface HistoryEntry {
  id: number;
  url: string;
  title: string;
  visited_at: string;
}

interface HistoryListResult {
  entries: HistoryEntry[];
  total: number;
}

export const history = {
  add(url: string, title: string): void {
    const stmt = db.prepare("INSERT INTO history (url, title) VALUES (?, ?)");
    stmt.run(url, title);
  },
  search(query: string): Array<{id: number; url: string; title: string; visited_at: string}> {
    const stmt = db.prepare("SELECT id, url, title, visited_at FROM history WHERE url LIKE ? OR title LIKE ? ORDER BY visited_at DESC LIMIT 50");
    const searchTerm = `%${query}%`;
    return stmt.all(searchTerm, searchTerm) as Array<{id: number; url: string; title: string; visited_at: string}>;
  },
  list(opts?: HistoryListOptions): HistoryListResult {
    const { limit = 50, offset = 0, query } = opts || {};

    if (query && query.trim()) {
      const searchTerm = `%${query.trim()}%`;

      const countStmt = db.prepare("SELECT COUNT(*) as total FROM history WHERE url LIKE ? OR title LIKE ?");
      const countRow = countStmt.get(searchTerm, searchTerm) as { total: number };

      const dataStmt = db.prepare(
        "SELECT id, url, title, visited_at FROM history WHERE url LIKE ? OR title LIKE ? ORDER BY visited_at DESC LIMIT ? OFFSET ?"
      );
      const entries = dataStmt.all(searchTerm, searchTerm, limit, offset) as HistoryEntry[];

      return { entries, total: countRow.total };
    }

    const countStmt = db.prepare("SELECT COUNT(*) as total FROM history");
    const countRow = countStmt.get() as { total: number };

    const dataStmt = db.prepare(
      "SELECT id, url, title, visited_at FROM history ORDER BY visited_at DESC LIMIT ? OFFSET ?"
    );
    const entries = dataStmt.all(limit, offset) as HistoryEntry[];

    return { entries, total: countRow.total };
  },
  clear(): void {
    const stmt = db.prepare("DELETE FROM history");
    stmt.run();
  },
};

export const settings = {
  get(key: string): string | undefined {
    const stmt = db.prepare("SELECT value FROM settings WHERE key = ?");
    const row = stmt.get(key) as {value: string} | undefined;
    return row?.value;
  },
  set(key: string, value: string): void {
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    stmt.run(key, value);
  },
  getAll(): Record<string, string> {
    const stmt = db.prepare("SELECT key, value FROM settings");
    const rows = stmt.all() as Array<{key: string; value: string}>;
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  },
};

// ── Prompt Templates ──

export interface Prompt {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
  created_at: string;
}

export const DEFAULT_PROMPTS: Omit<Prompt, 'created_at'>[] = [
  { id: 'summary', name: '总结页面', description: 'AI 总结当前页面的核心内容', prompt: '请用简洁的语言总结当前页面的核心内容，列出关键要点。', category: '信息提取' },
  { id: 'translate-en', name: '翻译为英文', description: '将当前页面内容翻译为英文', prompt: '请将当前页面的内容翻译为英文，保持原文格式。', category: '写作' },
  { id: 'translate-cn', name: '翻译为中文', description: '将当前页面内容翻译为中文', prompt: '请将当前页面的内容翻译为中文，保持原文格式。', category: '写作' },
  { id: 'explain', name: '解释这段内容', description: 'AI 用通俗语言解释复杂内容', prompt: '请用通俗易懂的语言解释当前页面的核心概念。', category: '通用' },
  { id: 'code-review', name: '代码审查', description: '审查页面中的代码质量', prompt: '请审查当前页面中的代码，指出潜在问题和改进建议。', category: '编程' },
  { id: 'fix-grammar', name: '修正语法', description: '修正选中文本的语法错误', prompt: '请修正以下文本中的语法错误和拼写错误，保持原意不变。', category: '写作' },
  { id: 'table-extract', name: '提取表格数据', description: '将页面中的表格提取为结构化格式', prompt: '请将当前页面中的表格数据提取为 Markdown 表格格式。', category: '信息提取' },
  { id: 'dark-mode', name: '页面深色模式', description: '给当前页面注入深色模式样式', prompt: '给当前页面应用深色模式CSS。', category: '自定义' },
];

export const prompts = {
  all(): Prompt[] {
    const stmt = db.prepare('SELECT id, name, description, prompt, category, created_at FROM prompts ORDER BY category, created_at ASC');
    return stmt.all() as Prompt[];
  },
  get(id: string): Prompt | undefined {
    const stmt = db.prepare('SELECT id, name, description, prompt, category, created_at FROM prompts WHERE id = ?');
    return stmt.get(id) as Prompt | undefined;
  },
  add(p: { id: string; name: string; description?: string; prompt: string; category?: string }): Prompt {
    const stmt = db.prepare('INSERT OR REPLACE INTO prompts (id, name, description, prompt, category) VALUES (?, ?, ?, ?, ?)');
    stmt.run(p.id, p.name, p.description ?? '', p.prompt, p.category ?? '通用');
    return this.get(p.id)!;
  },
  remove(id: string): boolean {
    const stmt = db.prepare('DELETE FROM prompts WHERE id = ?');
    const info = stmt.run(id);
    return info.changes > 0;
  },
  /** Seed default prompts if the prompts table is empty */
  seedDefaults(): void {
    const count = db.prepare('SELECT COUNT(*) as count FROM prompts').get() as { count: number };
    if (count.count === 0) {
      const insert = db.prepare('INSERT INTO prompts (id, name, description, prompt, category) VALUES (?, ?, ?, ?, ?)');
      const tx = db.transaction(() => {
        for (const p of DEFAULT_PROMPTS) {
          insert.run(p.id, p.name, p.description, p.prompt, p.category);
        }
      });
      tx();
    }
  },
};

// ── Scheduled Tasks ──

export interface ScheduledTask {
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

export const tasks = {
  all(): ScheduledTask[] {
    const stmt = db.prepare(
      "SELECT id, name, type, interval_ms, cron_expr, prompt, tab_url, active, last_run, created_at FROM scheduled_tasks ORDER BY created_at DESC"
    );
    const rows = stmt.all() as Array<{
      id: string;
      name: string;
      type: string;
      interval_ms: number | null;
      cron_expr: string | null;
      prompt: string;
      tab_url: string | null;
      active: number;
      last_run: string | null;
      created_at: string;
    }>;
    return rows.map((r) => ({
      ...r,
      type: r.type as "interval" | "cron" | "once",
      interval_ms: r.interval_ms ?? undefined,
      cron_expr: r.cron_expr ?? undefined,
      tab_url: r.tab_url ?? undefined,
      active: r.active === 1,
      last_run: r.last_run ?? undefined,
    }));
  },
  get(id: string): ScheduledTask | undefined {
    const stmt = db.prepare(
      "SELECT id, name, type, interval_ms, cron_expr, prompt, tab_url, active, last_run, created_at FROM scheduled_tasks WHERE id = ?"
    );
    const r = stmt.get(id) as ReturnType<typeof stmt.get> & {
      id: string; name: string; type: string; interval_ms: number | null;
      cron_expr: string | null; prompt: string; tab_url: string | null;
      active: number; last_run: string | null; created_at: string;
    } | undefined;
    if (!r) return undefined;
    return {
      ...r,
      type: r.type as "interval" | "cron" | "once",
      interval_ms: r.interval_ms ?? undefined,
      cron_expr: r.cron_expr ?? undefined,
      tab_url: r.tab_url ?? undefined,
      active: r.active === 1,
      last_run: r.last_run ?? undefined,
    };
  },
  add(task: Omit<ScheduledTask, "created_at">): ScheduledTask {
    const stmt = db.prepare(
      "INSERT INTO scheduled_tasks (id, name, type, interval_ms, cron_expr, prompt, tab_url, active, last_run) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    stmt.run(
      task.id,
      task.name,
      task.type,
      task.interval_ms ?? null,
      task.cron_expr ?? null,
      task.prompt,
      task.tab_url ?? null,
      task.active ? 1 : 0,
      task.last_run ?? null
    );
    return this.get(task.id)!;
  },
  update(id: string, updates: Partial<ScheduledTask>): boolean {
    const existing = this.get(id);
    if (!existing) return false;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push("name = ?"); values.push(updates.name); }
    if (updates.type !== undefined) { fields.push("type = ?"); values.push(updates.type); }
    if (updates.interval_ms !== undefined) { fields.push("interval_ms = ?"); values.push(updates.interval_ms); }
    if (updates.cron_expr !== undefined) { fields.push("cron_expr = ?"); values.push(updates.cron_expr); }
    if (updates.prompt !== undefined) { fields.push("prompt = ?"); values.push(updates.prompt); }
    if (updates.tab_url !== undefined) { fields.push("tab_url = ?"); values.push(updates.tab_url); }
    if (updates.active !== undefined) { fields.push("active = ?"); values.push(updates.active ? 1 : 0); }
    if (updates.last_run !== undefined) { fields.push("last_run = ?"); values.push(updates.last_run); }

    if (fields.length === 0) return true;

    values.push(id);
    const stmt = db.prepare(`UPDATE scheduled_tasks SET ${fields.join(", ")} WHERE id = ?`);
    const info = stmt.run(...values);
    return info.changes > 0;
  },
  remove(id: string): boolean {
    const stmt = db.prepare("DELETE FROM scheduled_tasks WHERE id = ?");
    const info = stmt.run(id);
    return info.changes > 0;
  },
};

export function close(): void {
  db.close();
}