import path from 'path';

let db: any = null;
const projectRoot = process.cwd();

export function getDb(): any {
  // CRITICAL: On Vercel, never even attempt to load better-sqlite3.
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
     return null; // Repositories must handle null db by checking if they should be using Supabase instead.
  }

  if (!db) {
    try {
      // Defer loading so it's not seen at top-level import
      const DatabaseConstructor = require('better-sqlite3');
      const { runMigrations } = require('./schema.js');

      const configuredPath = process.env['DB_PATH'] ?? './flow.db';
      const dbPath = path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(projectRoot, configuredPath);

      db = new DatabaseConstructor(dbPath);
      db?.pragma('journal_mode = WAL');
      db?.pragma('foreign_keys = ON');

      if (db) runMigrations(db);
    } catch (err) {
      console.warn('SQLite (better-sqlite3) could not be loaded. This is expected on Vercel. Ensure Supabase is configured.', err);
      return null;
    }
  }

  return db;
}

export function closeDb(): void {
  if (db && db.close) {
    db.close();
    db = null;
  }
}
