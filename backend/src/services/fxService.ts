import { config } from '../config.js';

const REFRESH_MS = 60_000;
const KRAKEN_USDT_USD_URL = 'https://api.kraken.com/0/public/Ticker?pair=USDTUSD';

let cachedRate = config.fxUsdtUsdRate;
let lastFetchedAt = 0;
let warnedFallback = false;

function parseKrakenUsdtUsd(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const result = (payload as { result?: Record<string, { c?: string[] }> }).result;
  if (!result) return null;

  const ticker = result.USDTUSD ?? result.ZUSDTZUSD ?? Object.values(result)[0];
  const price = ticker?.c?.[0];
  if (!price) return null;

  const rate = parseFloat(price);
  return Number.isFinite(rate) && rate > 0.9 && rate < 1.1 ? rate : null;
}

function warnFallbackOnce(message: string): void {
  if (warnedFallback) return;
  warnedFallback = true;
  console.warn(`[FX] ${message}`);
}

export function getUsdtUsdRate(): number {
  return cachedRate;
}

export async function refreshFxRate(): Promise<number> {
  const now = Date.now();
  if (now - lastFetchedAt < REFRESH_MS) {
    return cachedRate;
  }

  try {
    const response = await fetch(KRAKEN_USDT_USD_URL, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const rate = parseKrakenUsdtUsd(await response.json());
    if (rate === null) {
      throw new Error('Unexpected Kraken ticker shape');
    }

    cachedRate = Math.round(rate * 1_000_000) / 1_000_000;
    lastFetchedAt = now;
    return cachedRate;
  } catch (error) {
    warnFallbackOnce(
      `live USDT/USD unavailable (${(error as Error).message}) — using ${config.fxUsdtUsdRate}`,
    );
    cachedRate = config.fxUsdtUsdRate;
    lastFetchedAt = now;
    return cachedRate;
  }
}
