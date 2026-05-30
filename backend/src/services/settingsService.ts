import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RuntimeSettings } from '../types/index.js';

const DEFAULTS: RuntimeSettings = {
  demoMode: (process.env.DEMO_MODE ?? 'false') === 'true',
  autoExecute: (process.env.AUTO_EXECUTE ?? 'true') === 'true',
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '1500', 10),
  minNetProfitPct: parseFloat(process.env.MIN_NET_PROFIT_PCT ?? '0.02'),
  minVolumeBtc: parseFloat(process.env.MIN_VOLUME_BTC ?? '0.001'),
  maxCombinedLatencyMs: parseInt(process.env.MAX_COMBINED_LATENCY_MS ?? '2000', 10),
  circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD ?? '3', 10),
  circuitBreakerCooldownMs: parseInt(process.env.CIRCUIT_BREAKER_COOLDOWN_MS ?? '60000', 10),
};

const SETTING_KEYS = Object.keys(DEFAULTS) as (keyof RuntimeSettings)[];

function toDbValue(value: boolean | number): string {
  return typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
}

function fromDbValue(key: keyof RuntimeSettings, raw: string): boolean | number {
  const defaultValue = DEFAULTS[key];
  if (typeof defaultValue === 'boolean') return raw === '1' || raw === 'true';
  if (Number.isInteger(defaultValue)) return parseInt(raw, 10);
  return parseFloat(raw);
}

export class SettingsService {
  private db: Database.Database;
  private cache: RuntimeSettings;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.initSchema();
    this.seedMissing();
    this.cache = this.loadAll();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  private seedMissing(): void {
    const existing = new Set(
      this.db.prepare('SELECT key FROM settings').all().map((row) => (row as { key: string }).key),
    );
    const insert = this.db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
    );
    const now = Date.now();

    for (const key of SETTING_KEYS) {
      if (!existing.has(key)) {
        insert.run(key, toDbValue(DEFAULTS[key]), now);
      }
    }
  }

  private loadAll(): RuntimeSettings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as {
      key: keyof RuntimeSettings;
      value: string;
    }[];

    const loaded = { ...DEFAULTS };
    for (const row of rows) {
      if (SETTING_KEYS.includes(row.key)) {
        loaded[row.key] = fromDbValue(row.key, row.value) as never;
      }
    }
    return loaded;
  }

  get(): RuntimeSettings {
    return { ...this.cache };
  }

  update(partial: Partial<RuntimeSettings>): RuntimeSettings {
    const next: RuntimeSettings = { ...this.cache, ...partial };

    if (next.pollIntervalMs < 500 || next.pollIntervalMs > 30_000) {
      throw new Error('pollIntervalMs must be between 500 and 30000');
    }
    if (next.minNetProfitPct < 0 || next.minNetProfitPct > 10) {
      throw new Error('minNetProfitPct must be between 0 and 10');
    }
    if (next.minVolumeBtc < 0.0001 || next.minVolumeBtc > 10) {
      throw new Error('minVolumeBtc must be between 0.0001 and 10');
    }

    const updateStmt = this.db.prepare(
      'UPDATE settings SET value = ?, updated_at = ? WHERE key = ?',
    );
    const now = Date.now();

    const transaction = this.db.transaction(() => {
      for (const key of SETTING_KEYS) {
        if (partial[key] !== undefined) {
          updateStmt.run(toDbValue(next[key]), now, key);
        }
      }
    });

    transaction();
    this.cache = next;
    return this.get();
  }
}

const defaultDbPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../data/settings.sqlite',
);
const dbPath = process.env.SETTINGS_DB_PATH ?? defaultDbPath;

export const settingsService = new SettingsService(dbPath);

export function getRuntimeSettings(): RuntimeSettings {
  return settingsService.get();
}
