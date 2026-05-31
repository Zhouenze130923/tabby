import { SCHEMA_VERSION } from "./schema";
import Database from "better-sqlite3";

export function runMigrations(db: Database.Database): void {
  // Get current schema version from settings table
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("schema_version") as
    | { value: string }
    | undefined;
  const currentVersion = row?.value;

  // If no version set, this is a fresh install
  if (currentVersion === undefined) {
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
      "schema_version",
      String(SCHEMA_VERSION)
    );
    return;
  }

  const version = parseInt(currentVersion, 10);

  // If current version is already latest, nothing to do
  if (version >= SCHEMA_VERSION) {
    return;
  }

  // Define migration functions (each migrates from version n to n+1)
  const migrations: ((db: Database.Database) => void)[] = [
    // Example migration from version 1 to 2:
    // (db) => {
    //   db.exec(`ALTER TABLE bookmarks ADD COLUMN notes TEXT DEFAULT ''`);
    // },
    // Add more migrations here as needed
  ];

  // Run migrations sequentially from current version to target version
  for (let v = version; v < SCHEMA_VERSION; v++) {
    const migration = migrations[v];
    if (migration) {
      migration(db);
    }
  }

  // Update schema version after successful migration
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
    "schema_version",
    String(SCHEMA_VERSION)
  );
}
