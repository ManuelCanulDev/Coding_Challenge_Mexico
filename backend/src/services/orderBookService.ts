import ccxt, { type Exchange, type OrderBook } from 'ccxt';
import type { ExchangeId, NormalizedOrderBook } from '../types/index.js';
import { config, EXCHANGE_SYMBOLS, DEMO_SPREAD_BPS } from '../config.js';
import { getRuntimeSettings } from './settingsService.js';
import { generateMockOrderBook } from './mockDataService.js';

const exchangeInstances: Partial<Record<ExchangeId, Exchange>> = {};
const warnedExchanges = new Set<string>();

function createOfflineBook(exchangeId: ExchangeId, latencyMs: number): NormalizedOrderBook {
  return {
    exchange: exchangeId,
    symbol: EXCHANGE_SYMBOLS[exchangeId],
    bid: 0,
    ask: 0,
    bidSize: 0,
    askSize: 0,
    bids: [],
    asks: [],
    timestamp: Date.now(),
    latencyMs,
    status: 'offline',
  };
}

const BINANCE_DEPTH_URLS = [
  process.env.BINANCE_DEPTH_URL,
  'https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=10',
  'https://api.binance.us/api/v3/depth?symbol=BTCUSDT&limit=10',
].filter(Boolean) as string[];

interface BinanceDepthResponse {
  bids: [string, string][];
  asks: [string, string][];
}

function warnOnce(exchangeId: ExchangeId, message: string): void {
  if (warnedExchanges.has(exchangeId)) return;
  warnedExchanges.add(exchangeId);
  console.warn(`[OrderBook] ${exchangeId}: ${message}`);
}

function getExchangeInstance(exchangeId: ExchangeId): Exchange {
  if (!exchangeInstances[exchangeId]) {
    const ExchangeClass = ccxt[exchangeId] as new (config?: Record<string, unknown>) => Exchange;
    exchangeInstances[exchangeId] = new ExchangeClass({
      enableRateLimit: true,
      timeout: 8000,
    });
  }
  return exchangeInstances[exchangeId]!;
}

async function fetchBinanceDepthDirect(): Promise<OrderBook> {
  let lastError: Error | null = null;

  for (const url of BINANCE_DEPTH_URLS) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        if (response.status === 451 || response.status === 403) {
          lastError = new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
          continue;
        }
        throw new Error(`HTTP ${response.status} from ${new URL(url).hostname}`);
      }

      const data = (await response.json()) as BinanceDepthResponse;
      if (url.includes('binance.us')) {
        warnOnce('binance', 'using Binance.US depth feed (global API geo-blocked on this host)');
      }

      return {
        bids: data.bids.map(([price, amount]) => [Number(price), Number(amount)]),
        asks: data.asks.map(([price, amount]) => [Number(price), Number(amount)]),
        timestamp: Date.now(),
      } as OrderBook;
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError ?? new Error('Binance depth unavailable');
}

function toLevel(level: [unknown, unknown]): [number, number] {
  return [Number(level[0]), Number(level[1])];
}

function normalizeOrderBook(
  exchangeId: ExchangeId,
  orderBook: OrderBook,
  latencyMs: number,
): NormalizedOrderBook {
  const bids = orderBook.bids.slice(0, config.orderBookDepth).map(toLevel);
  const asks = orderBook.asks.slice(0, config.orderBookDepth).map(toLevel);

  return {
    exchange: exchangeId,
    symbol: EXCHANGE_SYMBOLS[exchangeId],
    bid: bids[0]?.[0] ?? 0,
    ask: asks[0]?.[0] ?? 0,
    bidSize: bids[0]?.[1] ?? 0,
    askSize: asks[0]?.[1] ?? 0,
    bids,
    asks,
    timestamp: orderBook.timestamp ?? Date.now(),
    latencyMs,
    status: 'online',
  };
}

function applyDemoSpread(book: NormalizedOrderBook): NormalizedOrderBook {
  if (!getRuntimeSettings().demoMode) return book;

  const factor = 1 + DEMO_SPREAD_BPS[book.exchange] / 10_000;
  const scale = (price: number) => Math.round(price * factor * 100) / 100;

  return {
    ...book,
    bid: scale(book.bid),
    ask: scale(book.ask),
    bids: book.bids.map(([price, amount]) => [scale(price), amount]),
    asks: book.asks.map(([price, amount]) => [scale(price), amount]),
  };
}

export async function fetchOrderBook(exchangeId: ExchangeId): Promise<NormalizedOrderBook> {
  const start = Date.now();
  try {
    const symbol = EXCHANGE_SYMBOLS[exchangeId];
    const orderBook =
      exchangeId === 'binance'
        ? await fetchBinanceDepthDirect()
        : await getExchangeInstance(exchangeId).fetchOrderBook(symbol, config.orderBookDepth);
    const latencyMs = Date.now() - start;
    return applyDemoSpread(normalizeOrderBook(exchangeId, orderBook, latencyMs));
  } catch (error) {
    const message = (error as Error).message;
    if (config.strictLive) {
      warnOnce(exchangeId, `live feed failed, exchange marked offline (STRICT_LIVE) — ${message}`);
      return createOfflineBook(exchangeId, Date.now() - start);
    }

    warnOnce(exchangeId, `live feed failed, using mock fallback — ${message}`);
    const mock = generateMockOrderBook(exchangeId);
    mock.latencyMs = Date.now() - start;
    mock.status = 'offline';
    return applyDemoSpread(mock);
  }
}

export async function fetchAllOrderBooks(): Promise<NormalizedOrderBook[]> {
  const results = await Promise.all(
    (['binance', 'kraken', 'coinbase', 'okx'] as ExchangeId[]).map(fetchOrderBook),
  );
  return results;
}
