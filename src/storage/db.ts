import Database from 'better-sqlite3';
import path from 'path';
import { runMigrations } from './schema.js';

let db: Database.Database | null = null;
const projectRoot = process.cwd();

export function getDb(): Database.Database {
  if (!db) {
    const configuredPath = process.env['DB_PATH'] ?? './flow.db';
    const dbPath = path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(projectRoot, configuredPath);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
