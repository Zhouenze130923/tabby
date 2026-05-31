import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";
import { SCHEMA } from "./schema";
import { runMigrations } from "./migration";

const dbPath = path.join(app.getPath("userData"), "tabby.db");
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
  list(limit?: number): Array<{id: number; url: string; title: string; visited_at: string}> {
    const limitClause = limit ? `LIMIT ${limit}` : "";
    const stmt = db.prepare(`SELECT id, url, title, visited_at FROM history ORDER BY visited_at DESC ${limitClause}`);
    return stmt.all() as Array<{id: number; url: string; title: string; visited_at: string}>;
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

export function close(): void {
  db.close();
}