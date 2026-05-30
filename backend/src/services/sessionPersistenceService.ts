import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ExchangeId, SimulatedTrade } from '../types/index.js';
import { INITIAL_WALLETS } from '../config.js';

export interface WalletSnapshot {
  fiat: number;
  btc: number;
}

export interface SessionSnapshot {
  trades: SimulatedTrade[];
  pnlHistory: { timestamp: number; cumulativePnl: number }[];
  opportunitiesRejected: number;
  wallets: Record<ExchangeId, WalletSnapshot>;
}

const EMPTY_WALLETS: Record<ExchangeId, WalletSnapshot> = {
  binance: { ...INITIAL_WALLETS.binance },
  kraken: { ...INITIAL_WALLETS.kraken },
  coinbase: { ...INITIAL_WALLETS.coinbase },
  okx: { ...INITIAL_WALLETS.okx },
};

function modeKey(demoMode: boolean): string {
  return demoMode ? 'demo' : 'live';
}

export class SessionPersistenceService {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_state (
        mode TEXT PRIMARY KEY NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  load(demoMode: boolean): SessionSnapshot | null {
    const row = this.db
      .prepare('SELECT payload_json FROM session_state WHERE mode = ?')
      .get(modeKey(demoMode)) as { payload_json: string } | undefined;

    if (!row) return null;

    try {
      return JSON.parse(row.payload_json) as SessionSnapshot;
    } catch {
      return null;
    }
  }

  save(demoMode: boolean, snapshot: SessionSnapshot): void {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO session_state (mode, payload_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(mode) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`,
      )
      .run(modeKey(demoMode), JSON.stringify(snapshot), now);
  }

  clear(demoMode: boolean): void {
    const empty: SessionSnapshot = {
      trades: [],
      pnlHistory: [{ timestamp: Date.now(), cumulativePnl: 0 }],
      opportunitiesRejected: 0,
      wallets: { ...EMPTY_WALLETS },
    };
    this.save(demoMode, empty);
  }
}

const defaultDbPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/settings.sqlite',
);
const dbPath = process.env.SETTINGS_DB_PATH ?? defaultDbPath;

export const sessionPersistence = new SessionPersistenceService(dbPath);
