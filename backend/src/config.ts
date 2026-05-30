import dotenv from 'dotenv';
import type { ExchangeId } from './types/index.js';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  wsPort: parseInt(process.env.WS_PORT ?? '3002', 10),
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '1500', 10),
  symbol: process.env.SYMBOL ?? 'BTC/USDT',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  autoExecute: (process.env.AUTO_EXECUTE ?? 'true') === 'true',
  minNetProfitPct: parseFloat(process.env.MIN_NET_PROFIT_PCT ?? '0.02'),
  minVolumeBtc: parseFloat(process.env.MIN_VOLUME_BTC ?? '0.001'),
  maxCombinedLatencyMs: parseInt(process.env.MAX_COMBINED_LATENCY_MS ?? '2000', 10),
  circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD ?? '3', 10),
  circuitBreakerCooldownMs: parseInt(process.env.CIRCUIT_BREAKER_COOLDOWN_MS ?? '60000', 10),
  orderBookDepth: 10,
  demoMode: (process.env.DEMO_MODE ?? 'true') === 'true',
};

/** Small per-exchange offsets (bps) to surface demo arbitrage on efficient markets */
export const DEMO_SPREAD_BPS: Record<ExchangeId, number> = {
  binance: -45,
  kraken: 55,
  coinbase: 85,
  okx: -38,
};

export const EXCHANGES: ExchangeId[] = ['binance', 'kraken', 'coinbase', 'okx'];

export const EXCHANGE_FEES: Record<ExchangeId, number> = {
  binance: 0.001,
  kraken: 0.0026,
  coinbase: 0.006,
  okx: 0.001,
};

export const EXCHANGE_SYMBOLS: Record<ExchangeId, string> = {
  binance: 'BTC/USDT',
  kraken: 'BTC/USD',
  coinbase: 'BTC/USD',
  okx: 'BTC/USDT',
};

export const EXCHANGE_FIAT: Record<ExchangeId, 'USDT' | 'USD'> = {
  binance: 'USDT',
  kraken: 'USD',
  coinbase: 'USD',
  okx: 'USDT',
};

export const INITIAL_WALLETS: Record<ExchangeId, { fiat: number; btc: number }> = {
  binance: { fiat: 100_000, btc: 1 },
  kraken: { fiat: 100_000, btc: 1 },
  coinbase: { fiat: 100_000, btc: 1 },
  okx: { fiat: 100_000, btc: 1 },
};
