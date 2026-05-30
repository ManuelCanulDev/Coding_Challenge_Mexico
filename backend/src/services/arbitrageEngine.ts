import { randomUUID } from 'crypto';
import type {
  ArbitrageOpportunity,
  ExchangeId,
  NormalizedOrderBook,
} from '../types/index.js';
import { EXCHANGE_FEES } from '../config.js';
import { WalletService } from './walletService.js';
import {
  calculateLatencyPenalty,
  calculateOpportunityScore,
  calculateWeightedAveragePrice,
  getRating,
} from './slippageService.js';

export class ArbitrageEngine {
  constructor(private walletService: WalletService) {}

  detectOpportunities(orderBooks: NormalizedOrderBook[]): ArbitrageOpportunity[] {
    const onlineBooks = orderBooks.filter((book) => book.bid > 0 && book.ask > 0);
    const opportunities: ArbitrageOpportunity[] = [];

    for (const buyBook of onlineBooks) {
      for (const sellBook of onlineBooks) {
        if (buyBook.exchange === sellBook.exchange) continue;
        if (buyBook.ask >= sellBook.bid) continue;

        const opportunity = this.buildOpportunity(buyBook, sellBook);
        opportunities.push(opportunity);
      }
    }

    return opportunities.sort((a, b) => b.score - a.score);
  }

  private buildOpportunity(
    buyBook: NormalizedOrderBook,
    sellBook: NormalizedOrderBook,
  ): ArbitrageOpportunity {
    const buyExchange = buyBook.exchange;
    const sellExchange = sellBook.exchange;
    const buyAsk = buyBook.ask;
    const sellBid = sellBook.bid;
    const combinedLatencyMs = buyBook.latencyMs + sellBook.latencyMs;

    const grossSpreadUsd = sellBid - buyAsk;
    const grossSpreadPct = (grossSpreadUsd / buyAsk) * 100;

    const askLiquidity = sumLiquidity(buyBook.asks);
    const bidLiquidity = sumLiquidity(sellBook.bids);
    const maxByBalance = Math.min(
      this.walletService.getMaxBuyVolume(buyExchange, buyAsk, askLiquidity),
      this.walletService.getMaxSellVolume(sellExchange, bidLiquidity),
      askLiquidity,
      bidLiquidity,
    );

    const probeVolume = Math.max(0.001, Math.min(maxByBalance, 0.5));
    const buySlippage = calculateWeightedAveragePrice(buyBook.asks, probeVolume, 'buy');
    const sellSlippage = calculateWeightedAveragePrice(sellBook.bids, probeVolume, 'sell');

    const maxExecutableBtc = Math.min(
      buySlippage.filledBtc,
      sellSlippage.filledBtc,
      maxByBalance,
    );

    const volume = Math.max(maxExecutableBtc, 0);
    const buyCost = volume * buySlippage.avgPrice;
    const sellProceeds = volume * sellSlippage.avgPrice;
    const buyFee = buyCost * EXCHANGE_FEES[buyExchange];
    const sellFee = sellProceeds * EXCHANGE_FEES[sellExchange];
    const slippageEstimate = buySlippage.slippageUsd + sellSlippage.slippageUsd;
    const notional = buyCost || buyAsk;
    const latencyPenalty = calculateLatencyPenalty(notional, combinedLatencyMs);
    const netProfitUsd = (sellProceeds - buyCost) - buyFee - sellFee - slippageEstimate - latencyPenalty;
    const netProfitPct = notional > 0 ? (netProfitUsd / notional) * 100 : 0;

    const riskPenalty = this.estimateRiskPenalty(netProfitPct, maxExecutableBtc, combinedLatencyMs);
    const score = calculateOpportunityScore(netProfitPct, maxExecutableBtc, combinedLatencyMs, riskPenalty);
    const rating = getRating(score);

    const confidenceScore = Math.min(
      100,
      Math.round(
        score * 0.4 +
          Math.min(grossSpreadPct * 500, 30) +
          Math.min(maxExecutableBtc * 20, 20) +
          (combinedLatencyMs < 1000 ? 10 : 0),
      ),
    );

    let status: ArbitrageOpportunity['status'] = 'detected';
    let reason = 'Opportunity detected';

    if (netProfitUsd > 0 && netProfitPct > 0.02) {
      status = 'executable';
      reason = 'Meets profit thresholds';
    } else if (netProfitUsd <= 0) {
      reason = 'Fees, slippage and latency exceed gross spread';
    } else {
      reason = 'Net profit below 0.02% threshold';
    }

    return {
      id: randomUUID(),
      buyExchange,
      sellExchange,
      buyAsk: Math.round(buyAsk * 100) / 100,
      sellBid: Math.round(sellBid * 100) / 100,
      grossSpreadUsd: Math.round(grossSpreadUsd * 100) / 100,
      grossSpreadPct: Math.round(grossSpreadPct * 10000) / 10000,
      buyFee: Math.round(buyFee * 100) / 100,
      sellFee: Math.round(sellFee * 100) / 100,
      slippageEstimate: Math.round(slippageEstimate * 100) / 100,
      latencyPenalty: Math.round(latencyPenalty * 100) / 100,
      netProfitUsd: Math.round(netProfitUsd * 100) / 100,
      netProfitPct: Math.round(netProfitPct * 10000) / 10000,
      maxExecutableBtc: Math.round(maxExecutableBtc * 100000000) / 100000000,
      confidenceScore,
      score,
      rating,
      status,
      reason,
      combinedLatencyMs,
      timestamp: Date.now(),
    };
  }

  private estimateRiskPenalty(netProfitPct: number, maxExecutableBtc: number, combinedLatencyMs: number): number {
    let penalty = 0;
    if (netProfitPct < 0.05) penalty += 10;
    if (maxExecutableBtc < 0.01) penalty += 15;
    if (combinedLatencyMs > 1500) penalty += 10;
    return penalty;
  }
}

function sumLiquidity(levels: [number, number][]): number {
  return levels.reduce((sum, [, amount]) => sum + amount, 0);
}
