/**
 * Clippings — 智能片段收藏
 * 这些函数使用 db.ts 中已建立的数据库连接。
 * 通过 db.ts 统一导出的方式引入。
 */

export interface Clipping {
  id: string;
  source_url: string;
  source_title: string;
  type: "text" | "image" | "note" | "code";
  content: string;
  note: string;
  tags: string;
  created_at: string;
}

export function makeClippingsApi(db: any) {
  function generateId(): string {
    return `clip_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
  return {
    all(type?: string): Clipping[] {
      if (type && type !== "all") {
        return db.prepare("SELECT * FROM clippings WHERE type = ? ORDER BY created_at DESC").all(type) as Clipping[];
      }
      return db.prepare("SELECT * FROM clippings ORDER BY created_at DESC").all() as Clipping[];
    },
    get(id: string): Clipping | undefined {
      return db.prepare("SELECT * FROM clippings WHERE id = ?").get(id) as Clipping | undefined;
    },
    add(clip: Omit<Clipping, "id" | "created_at">): Clipping {
      const id = generateId();
      db.prepare("INSERT INTO clippings (id, source_url, source_title, type, content, note, tags) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(id, clip.source_url, clip.source_title, clip.type, clip.content, clip.note, clip.tags);
      return this.get(id)!;
    },
    update(id: string, updates: Partial<Pick<Clipping, "note" | "tags">>): boolean {
      const fields: string[] = []; const values: any[] = [];
      if (updates.note !== undefined) { fields.push("note = ?"); values.push(updates.note); }
      if (updates.tags !== undefined) { fields.push("tags = ?"); values.push(updates.tags); }
      if (fields.length === 0) return true;
      values.push(id);
      return db.prepare(`UPDATE clippings SET ${fields.join(", ")} WHERE id = ?`).run(...values).changes > 0;
    },
    remove(id: string): boolean {
      return db.prepare("DELETE FROM clippings WHERE id = ?").run(id).changes > 0;
    },
    search(query: string): Clipping[] {
      const term = `%${query}%`;
      return db.prepare("SELECT * FROM clippings WHERE content LIKE ? OR note LIKE ? OR tags LIKE ? OR source_title LIKE ? ORDER BY created_at DESC LIMIT 50")
        .all(term, term, term, term) as Clipping[];
    },
  };
}

// ── Timeline (浏览时间线) ──

export interface TimelineSnapshot {
  id: string;
  label: string;
  snapshot_data: string; // JSON: { tabs: Array<{url, title}>, activeUrl: string }
  created_at: string;
}

export function makeTimelineApi(db: any) {
  function generateId(): string {
    return `tl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return {
    all(limit = 50): TimelineSnapshot[] {
      return db.prepare("SELECT * FROM timeline_snapshots ORDER BY created_at DESC LIMIT ?").all(limit) as TimelineSnapshot[];
    },
    add(label: string, snapshotData: string): TimelineSnapshot {
      const id = generateId();
      db.prepare("INSERT INTO timeline_snapshots (id, label, snapshot_data) VALUES (?, ?, ?)")
        .run(id, label, snapshotData);
      return db.prepare("SELECT * FROM timeline_snapshots WHERE id = ?").get(id) as TimelineSnapshot;
    },
    remove(id: string): boolean {
      return db.prepare("DELETE FROM timeline_snapshots WHERE id = ?").run(id).changes > 0;
    },
    clear(): void {
      db.prepare("DELETE FROM timeline_snapshots").run();
    },
  };
}

// ── Macros (浏览器操作宏) ──

export interface MacroStep {
  type: "navigate" | "click" | "type" | "scroll" | "wait" | "extract" | "screenshot";
  params: Record<string, any>;
}

export interface Macro {
  id: string;
  name: string;
  description: string;
  steps: string; // JSON MacroStep[]
  created_at: string;
}

export function makeMacrosApi(db: any) {
  function generateId(): string {
    return `macro_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
  return {
    all(): Macro[] {
      return db.prepare("SELECT * FROM macros ORDER BY created_at DESC").all() as Macro[];
    },
    get(id: string): Macro | undefined {
      return db.prepare("SELECT * FROM macros WHERE id = ?").get(id) as Macro | undefined;
    },
    add(name: string, description: string, steps: MacroStep[]): Macro {
      const id = generateId();
      db.prepare("INSERT INTO macros (id, name, description, steps) VALUES (?, ?, ?, ?)")
        .run(id, name, description, JSON.stringify(steps));
      return this.get(id)!;
    },
    remove(id: string): boolean {
      return db.prepare("DELETE FROM macros WHERE id = ?").run(id).changes > 0;
    },
  };
}

// ── Knowledge Cache (知识库缓存) ──

export function makeKnowledgeCacheApi(db: any) {
  return {
    all(): any[] {
      return db.prepare("SELECT * FROM knowledge_cache ORDER BY last_queried_at DESC").all() as any[];
    },
    add(title: string, content: string, source = "kb", tags = ""): any {
      db.prepare("INSERT INTO knowledge_cache (title, content, source, tags) VALUES (?, ?, ?, ?)")
        .run(title, content, source, tags);
    },
    search(query: string): any[] {
      const term = `%${query}%`;
      return db.prepare("SELECT * FROM knowledge_cache WHERE title LIKE ? OR content LIKE ? OR tags LIKE ? ORDER BY last_queried_at DESC LIMIT 20")
        .all(term, term, term) as any[];
    },
    touch(id: number): void {
      db.prepare("UPDATE knowledge_cache SET last_queried_at = datetime('now') WHERE id = ?").run(id);
    },
  };
}
