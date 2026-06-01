import { app } from "electron";
import path from "path";
import fs from "fs";
import { bookmarks as dbBookmarks } from "../storage/db";

export interface ImportResult {
  browser: string;
  count: number;
  success: boolean;
  error?: string;
}

// Chrome bookmark JSON structure
interface ChromeBookmarkNode {
  name: string;
  type: "folder" | "url";
  url?: string;
  children?: ChromeBookmarkNode[];
  date_added?: string;
}

export async function importFromChrome(): Promise<ImportResult> {
  const chromePath = path.join(
    app.getPath("home"),
    "Library/Application Support/Google/Chrome/Default/Bookmarks"
  );

  if (!fs.existsSync(chromePath)) {
    return {
      browser: "Chrome",
      count: 0,
      success: false,
      error: "未找到 Chrome 书签文件",
    };
  }

  try {
    const raw = fs.readFileSync(chromePath, "utf-8");
    const data = JSON.parse(raw);
    const roots = data.roots;
    let count = 0;

    function walk(node: ChromeBookmarkNode) {
      if (node.type === "url" && node.url) {
        try {
          const url = node.url.startsWith("chrome://") || node.url.startsWith("about:")
            ? "" : node.url;
          if (url) {
            dbBookmarks.add(url, node.name || "Chrome Bookmark");
            count++;
          }
        } catch {
          // skip failed insertions
        }
      }
      if (node.children) {
        for (const child of node.children) {
          walk(child);
        }
      }
    }

    for (const key of Object.keys(roots)) {
      walk(roots[key]);
    }

    return { browser: "Chrome", count, success: true };
  } catch (err: any) {
    return {
      browser: "Chrome",
      count: 0,
      success: false,
      error: err.message,
    };
  }
}

export async function importFromSafari(): Promise<ImportResult> {
  const safariPath = path.join(
    app.getPath("home"),
    "Library/Safari/Bookmarks.plist"
  );

  if (!fs.existsSync(safariPath)) {
    return {
      browser: "Safari",
      count: 0,
      success: false,
      error: "未找到 Safari 书签文件",
    };
  }

  try {
    const content = fs.readFileSync(safariPath, "utf-8");
    let count = 0;

    // Extract URLs from Safari plist format
    // Bookmark.plist contains <key>URLString</key><string>https://...</string>
    // and <key>URIDictionary</key><dict><key>title</key><string>...</string>
    const urlRegex = /<key>URLString<\/key>\s*<string>([^<]+)<\/string>/g;
    const titleRegex =
      /<key>URIDictionary<\/key>\s*<dict>\s*<key>title<\/key>\s*<string>([^<]*)<\/string>/g;

    const urls: string[] = [];
    const titles: string[] = [];

    let m: RegExpExecArray | null;
    while ((m = urlRegex.exec(content)) !== null) urls.push(m[1]);
    while ((m = titleRegex.exec(content)) !== null) titles.push(m[1]);

    for (let i = 0; i < urls.length; i++) {
      try {
        dbBookmarks.add(urls[i], titles[i] || "Safari Bookmark");
        count++;
      } catch {
        // skip failed insertions
      }
    }

    return { browser: "Safari", count, success: true };
  } catch (err: any) {
    return {
      browser: "Safari",
      count: 0,
      success: false,
      error: err.message,
    };
  }
}

export async function importFromFirefox(): Promise<ImportResult> {
  const firefoxDir = path.join(
    app.getPath("home"),
    "Library/Application Support/Firefox/Profiles"
  );

  if (!fs.existsSync(firefoxDir)) {
    return {
      browser: "Firefox",
      count: 0,
      success: false,
      error: "未找到 Firefox 配置文件",
    };
  }

  try {
    const profiles = fs.readdirSync(firefoxDir);
    const defaultProfile = profiles.find(
      (p) => p.endsWith(".default-release") || p.endsWith(".default")
    );
    if (!defaultProfile) {
      return {
        browser: "Firefox",
        count: 0,
        success: false,
        error: "未找到 Firefox 默认配置",
      };
    }

    const placesDb = path.join(firefoxDir, defaultProfile, "places.sqlite");
    if (!fs.existsSync(placesDb)) {
      return {
        browser: "Firefox",
        count: 0,
        success: false,
        error: "未找到 Firefox 书签数据库",
      };
    }

    // better-sqlite3 is already in dependencies
    const Database = require("better-sqlite3");
    const db = new Database(placesDb, { readonly: true });

    interface FirefoxBookmarkRow {
      title: string | null;
      url: string;
    }

    const rows = db
      .prepare(
        `
        SELECT moz_bookmarks.title, moz_places.url
        FROM moz_bookmarks
        JOIN moz_places ON moz_bookmarks.fk = moz_places.id
        WHERE moz_bookmarks.type = 1 AND moz_places.url IS NOT NULL
      `
      )
      .all() as FirefoxBookmarkRow[];

    db.close();

    let count = 0;
    for (const row of rows) {
      try {
        dbBookmarks.add(row.url, row.title || "Firefox Bookmark");
        count++;
      } catch {
        // skip failed insertions
      }
    }

    return { browser: "Firefox", count, success: true };
  } catch (err: any) {
    return {
      browser: "Firefox",
      count: 0,
      success: false,
      error: err.message,
    };
  }
}

export async function importFromAll(): Promise<ImportResult[]> {
  const results = await Promise.allSettled([
    importFromChrome(),
    importFromSafari(),
    importFromFirefox(),
  ]);
  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : {
          browser: "Unknown",
          count: 0,
          success: false,
          error: r.reason?.message || "导入失败",
        }
  );
}
