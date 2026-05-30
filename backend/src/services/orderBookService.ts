import ccxt, { type Exchange, type OrderBook } from 'ccxt';
import type { ExchangeId, NormalizedOrderBook } from '../types/index.js';
import { config, EXCHANGE_SYMBOLS, DEMO_SPREAD_BPS } from '../config.js';
import { generateMockOrderBook } from './mockDataService.js';

const exchangeInstances: Partial<Record<ExchangeId, Exchange>> = {};

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
  if (!config.demoMode) return book;

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
    const exchange = getExchangeInstance(exchangeId);
    const symbol = EXCHANGE_SYMBOLS[exchangeId];
    const orderBook = await exchange.fetchOrderBook(symbol, config.orderBookDepth);
    const latencyMs = Date.now() - start;
    return applyDemoSpread(normalizeOrderBook(exchangeId, orderBook, latencyMs));
  } catch (error) {
    console.warn(`[OrderBook] ${exchangeId} failed, using mock fallback:`, (error as Error).message);
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
