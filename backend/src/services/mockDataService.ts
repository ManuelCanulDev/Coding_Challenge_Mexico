import type { ExchangeId, NormalizedOrderBook } from '../types/index.js';
import { EXCHANGE_SYMBOLS } from '../config.js';

const BASE_BTC_PRICE = 96_500;

function randomOffset(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generateLevels(midPrice: number, side: 'bid' | 'ask', count: number): [number, number][] {
  const levels: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const offset = (i + 1) * randomOffset(0.5, 2.5);
    const price = side === 'bid' ? midPrice - offset : midPrice + offset;
    const amount = randomOffset(0.05, 1.5);
    levels.push([Math.round(price * 100) / 100, Math.round(amount * 10000) / 10000]);
  }
  return levels;
}

const EXCHANGE_OFFSETS: Record<ExchangeId, number> = {
  binance: 0,
  kraken: -12,
  coinbase: 18,
  okx: -5,
};

export function generateMockOrderBook(exchange: ExchangeId): NormalizedOrderBook {
  const offset = EXCHANGE_OFFSETS[exchange] + randomOffset(-8, 8);
  const mid = BASE_BTC_PRICE + offset;
  const spread = randomOffset(5, 25);
  const bid = Math.round((mid - spread / 2) * 100) / 100;
  const ask = Math.round((mid + spread / 2) * 100) / 100;
  const bids = generateLevels(bid, 'bid', 10);
  const asks = generateLevels(ask, 'ask', 10);

  return {
    exchange,
    symbol: EXCHANGE_SYMBOLS[exchange],
    bid,
    ask,
    bidSize: bids[0]?.[1] ?? 0,
    askSize: asks[0]?.[1] ?? 0,
    bids,
    asks,
    timestamp: Date.now(),
    latencyMs: Math.round(randomOffset(80, 350)),
    status: 'online',
  };
}

export function generateAllMockOrderBooks(): NormalizedOrderBook[] {
  return (Object.keys(EXCHANGE_OFFSETS) as ExchangeId[]).map(generateMockOrderBook);
}
