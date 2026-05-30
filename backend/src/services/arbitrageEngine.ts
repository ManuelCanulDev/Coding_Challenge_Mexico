import { randomUUID } from 'crypto';
import type {
  ArbitrageOpportunity,
  ExchangeId,
  NormalizedOrderBook,
} from '../types/index.js';
import { EXCHANGE_FEES, EXCHANGE_FIAT } from '../config.js';
import { WalletService } from './walletService.js';
import { getRuntimeSettings } from './settingsService.js';
import { getUsdtUsdRate } from './fxService.js';
import {
  calculateNetProfitability,
  calculateOpportunityScore,
  calculateWeightedAveragePrice,
  getRating,
} from './slippageService.js';
import { assessOpportunityReality } from './realityCheckService.js';

export class ArbitrageEngine {
  constructor(private walletService: WalletService) {}

  detectOpportunities(orderBooks: NormalizedOrderBook[]): ArbitrageOpportunity[] {
    const onlineBooks = orderBooks.filter((book) => book.bid > 0 && book.ask > 0);
    const opportunities: ArbitrageOpportunity[] = [];

    for (const buyBook of onlineBooks) {
      for (const sellBook of onlineBooks) {
        if (buyBook.exchange === sellBook.exchange) continue;

        const buyAskUsd = priceToUsd(buyBook.ask, buyBook.exchange);
        const sellBidUsd = priceToUsd(sellBook.bid, sellBook.exchange);
        if (buyAskUsd >= sellBidUsd) continue;

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
    const settings = getRuntimeSettings();
    const buyExchange = buyBook.exchange;
    const sellExchange = sellBook.exchange;
    const buyAsk = priceToUsd(buyBook.ask, buyExchange);
    const sellBid = priceToUsd(sellBook.bid, sellExchange);
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

    const probeVolume =
      maxByBalance >= settings.minVolumeBtc
        ? Math.max(settings.minVolumeBtc, Math.min(maxByBalance, 0.5))
        : 0;
    const probeBuy = calculateWeightedAveragePrice(buyBook.asks, probeVolume, 'buy');
    const probeSell = calculateWeightedAveragePrice(sellBook.bids, probeVolume, 'sell');

    const maxExecutableBtc = Math.min(
      probeBuy.filledBtc,
      probeSell.filledBtc,
      maxByBalance,
    );

    const volume = Math.max(maxExecutableBtc, 0);
    const buySlippage = calculateWeightedAveragePrice(
      buyBook.asks,
      volume >= settings.minVolumeBtc ? volume : settings.minVolumeBtc,
      'buy',
    );
    const sellSlippage = calculateWeightedAveragePrice(
      sellBook.bids,
      volume >= settings.minVolumeBtc ? volume : settings.minVolumeBtc,
      'sell',
    );
    const slippageEstimate =
      volume > 0
        ? slippageToUsd(buySlippage.slippageUsd, buyExchange) +
          slippageToUsd(sellSlippage.slippageUsd, sellExchange)
        : 0;

    const profitability = calculateNetProfitability({
      volumeBtc: volume,
      buyPrice: buyAsk,
      sellPrice: sellBid,
      buyFeeRate: EXCHANGE_FEES[buyExchange],
      sellFeeRate: EXCHANGE_FEES[sellExchange],
      slippageUsd: slippageEstimate,
      combinedLatencyMs,
    });
    const { buyFeeUsd: buyFee, sellFeeUsd: sellFee, latencyPenaltyUsd: latencyPenalty, netProfitUsd, netProfitPct } =
      profitability;

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

    if (maxExecutableBtc < settings.minVolumeBtc) {
      reason = `Volume ${maxExecutableBtc.toFixed(6)} BTC below minimum`;
    } else if (combinedLatencyMs > effectiveLatencyLimit(settings)) {
      reason = `Latency ${combinedLatencyMs}ms exceeds ${effectiveLatencyLimit(settings)}ms limit`;
    } else if (netProfitUsd > 0 && netProfitPct > settings.minNetProfitPct) {
      status = 'executable';
      reason = 'Meets profit thresholds';
    } else if (netProfitUsd <= 0) {
      reason = 'Fees, slippage and latency exceed gross spread';
    } else {
      reason = `Net profit below ${settings.minNetProfitPct}% threshold`;
    }

    const core = {
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
      status,
      reason,
      combinedLatencyMs,
    };

    return {
      id: randomUUID(),
      ...core,
      confidenceScore,
      score,
      rating,
      timestamp: Date.now(),
      reality: assessOpportunityReality(core),
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

function priceToUsd(price: number, exchange: ExchangeId): number {
  if (EXCHANGE_FIAT[exchange] === 'USD') return price;
  return price * getUsdtUsdRate();
}

function slippageToUsd(slippageNative: number, exchange: ExchangeId): number {
  return EXCHANGE_FIAT[exchange] === 'USDT' ? slippageNative * getUsdtUsdRate() : slippageNative;
}

function effectiveLatencyLimit(settings: ReturnType<typeof getRuntimeSettings>): number {
  return settings.demoMode
    ? Math.max(settings.maxCombinedLatencyMs, 5000)
    : settings.maxCombinedLatencyMs;
}
