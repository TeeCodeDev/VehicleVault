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
    this.db = new DatabaseSync(DATA_PATHS.db);
    // Enable Write-Ahead Logging (WAL) and foreign keys enforcement
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA synchronous = NORMAL;');
  }

  public static getInstance(): DatabaseAccess {
    if (!DatabaseAccess.instance) {
      DatabaseAccess.instance = new DatabaseAccess();
    }
    return DatabaseAccess.instance;
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public get<T = any>(sql: string, params: any[] = []): T | undefined {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params) as T | undefined;
  }

  public run(sql: string, params: any[] = []): RunResult {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return {
      changes: Number(result.changes),
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  public close(): void {
    this.db.close();
  }
}

export const db = DatabaseAccess.getInstance();
