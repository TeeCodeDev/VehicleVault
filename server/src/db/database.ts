import { DatabaseSync } from 'node:sqlite';
import { DATA_PATHS } from '../config/env.js';

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

export class DatabaseAccess {
  private static instance: DatabaseAccess;
  private db: DatabaseSync;

  private constructor() {
    console.log(`Connecting to SQLite database at: ${DATA_PATHS.db}`);
    this.db = new DatabaseSync(DATA_PATHS.db);

    try {
      this.db.exec('PRAGMA busy_timeout = 5000;');
      this.db.exec('PRAGMA foreign_keys = ON;');
      this.db.exec('PRAGMA synchronous = NORMAL;');

      // Attempt to enable WAL mode, but test writeability on Unraid / FUSE mounts
      let journalMode = 'DELETE';
      try {
        const mode = this.db.prepare('PRAGMA journal_mode = WAL;').get() as any;
        journalMode = mode?.journal_mode || 'wal';
        console.log(`Initial SQLite journal_mode requested: WAL, returned: ${journalMode}`);
      } catch (walErr) {
        console.warn('Failed to request WAL journal mode:', walErr);
        this.db.exec('PRAGMA journal_mode = DELETE;');
        journalMode = 'delete';
      }

      // Verify write capability in the mounted storage environment
      try {
        this.db.exec('CREATE TABLE IF NOT EXISTS _healthcheck (id INTEGER PRIMARY KEY);');
        this.db.exec('INSERT OR REPLACE INTO _healthcheck (id) VALUES (1);');
        this.db.exec('DROP TABLE IF EXISTS _healthcheck;');
        console.log(`SQLite database write check succeeded (journal_mode: ${journalMode}).`);
      } catch (writeErr) {
        console.warn(`Write test with journal_mode=${journalMode} failed on this filesystem:`, writeErr);
        console.log('Falling back to PRAGMA journal_mode = DELETE for network/FUSE compatibility...');
        this.db.exec('PRAGMA journal_mode = DELETE;');
        this.db.exec('CREATE TABLE IF NOT EXISTS _healthcheck (id INTEGER PRIMARY KEY);');
        this.db.exec('INSERT OR REPLACE INTO _healthcheck (id) VALUES (1);');
        this.db.exec('DROP TABLE IF EXISTS _healthcheck;');
        console.log('SQLite database write check succeeded with DELETE journal mode.');
      }
    } catch (err) {
      console.error('CRITICAL: SQLite database initialization error:', err);
    }
  }

  public static getInstance(): DatabaseAccess {
    if (!DatabaseAccess.instance) {
      DatabaseAccess.instance = new DatabaseAccess();
    }
    return DatabaseAccess.instance;
  }

  public exec(sql: string): void {
    try {
      this.db.exec(sql);
    } catch (err: any) {
      console.error(`Database error executing SQL: "${sql.slice(0, 100)}..."`, err?.message);
      throw err;
    }
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params) as T[];
    } catch (err: any) {
      console.error(`Database error querying SQL: "${sql.slice(0, 100)}..."`, err?.message);
      throw err;
    }
  }

  public get<T = any>(sql: string, params: any[] = []): T | undefined {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params) as T | undefined;
    } catch (err: any) {
      console.error(`Database error getting SQL: "${sql.slice(0, 100)}..."`, err?.message);
      throw err;
    }
  }

  public run(sql: string, params: any[] = []): RunResult {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return {
        changes: Number(result.changes),
        lastInsertRowid: result.lastInsertRowid,
      };
    } catch (err: any) {
      console.error(`Database error running SQL: "${sql.slice(0, 100)}..."`, err?.message);
      throw err;
    }
  }

  public close(): void {
    this.db.close();
  }
}

export const db = DatabaseAccess.getInstance();
