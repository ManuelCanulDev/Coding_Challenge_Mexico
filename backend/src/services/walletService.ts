import { randomUUID } from 'crypto';
import type {
  ExchangeId,
  NormalizedOrderBook,
  SimulatedTrade,
  WalletBalance,
} from '../types/index.js';
import {
  EXCHANGE_FEES,
  EXCHANGE_FIAT,
  INITIAL_WALLETS,
} from '../config.js';
import {
  calculateLatencyPenalty,
  calculateWeightedAveragePrice,
} from './slippageService.js';

interface InternalWallet {
  fiat: number;
  btc: number;
}

export class WalletService {
  private wallets: Record<ExchangeId, InternalWallet>;

  constructor() {
    this.wallets = {
      binance: { ...INITIAL_WALLETS.binance },
      kraken: { ...INITIAL_WALLETS.kraken },
      coinbase: { ...INITIAL_WALLETS.coinbase },
      okx: { ...INITIAL_WALLETS.okx },
    };
  }

  getBalances(referencePrice: number): WalletBalance[] {
    return (Object.keys(this.wallets) as ExchangeId[]).map((exchange) => {
      const wallet = this.wallets[exchange];
      return {
        exchange,
        fiat: Math.round(wallet.fiat * 100) / 100,
        fiatCurrency: EXCHANGE_FIAT[exchange],
        btc: Math.round(wallet.btc * 100000000) / 100000000,
        estimatedTotalUsd: Math.round((wallet.fiat + wallet.btc * referencePrice) * 100) / 100,
      };
    });
  }

  canAffordBuy(exchange: ExchangeId, volumeBtc: number, price: number): boolean {
    const cost = volumeBtc * price * (1 + EXCHANGE_FEES[exchange]);
    return this.wallets[exchange].fiat >= cost;
  }

  canAffordSell(exchange: ExchangeId, volumeBtc: number): boolean {
    return this.wallets[exchange].btc >= volumeBtc;
  }

  getMaxBuyVolume(exchange: ExchangeId, price: number, askLiquidity: number): number {
    const wallet = this.wallets[exchange];
    const fee = EXCHANGE_FEES[exchange];
    const maxByBalance = wallet.fiat / (price * (1 + fee));
    return Math.min(maxByBalance, askLiquidity);
  }

  getMaxSellVolume(exchange: ExchangeId, bidLiquidity: number): number {
    return Math.min(this.wallets[exchange].btc, bidLiquidity);
  }

  executeTrade(params: {
    buyExchange: ExchangeId;
    sellExchange: ExchangeId;
    buyBook: NormalizedOrderBook;
    sellBook: NormalizedOrderBook;
    targetVolumeBtc: number;
    combinedLatencyMs: number;
  }): SimulatedTrade {
    const { buyExchange, sellExchange, buyBook, sellBook, targetVolumeBtc, combinedLatencyMs } =
      params;

    const buySlippage = calculateWeightedAveragePrice(buyBook.asks, targetVolumeBtc, 'buy');
    const sellSlippage = calculateWeightedAveragePrice(sellBook.bids, targetVolumeBtc, 'sell');

    const maxVolume = Math.min(
      buySlippage.filledBtc,
      sellSlippage.filledBtc,
      this.getMaxBuyVolume(buyExchange, buySlippage.avgPrice, sumLiquidity(buyBook.asks)),
      this.getMaxSellVolume(sellExchange, sumLiquidity(sellBook.bids)),
    );

    if (maxVolume < 0.001) {
      return this.rejectedTrade({
        buyExchange,
        sellExchange,
        buyPrice: buyBook.ask,
        sellPrice: sellBook.bid,
        reason: 'Insufficient liquidity or balance',
      });
    }

    const volumeBtc = Math.round(maxVolume * 100000000) / 100000000;
    const buyPrice = buySlippage.avgPrice;
    const sellPrice = sellSlippage.avgPrice;

    const buyCost = volumeBtc * buyPrice;
    const sellProceeds = volumeBtc * sellPrice;
    const buyFee = buyCost * EXCHANGE_FEES[buyExchange];
    const sellFee = sellProceeds * EXCHANGE_FEES[sellExchange];
    const feesUsd = buyFee + sellFee;
    const grossProfitUsd = sellProceeds - buyCost;
    const slippageUsd = buySlippage.slippageUsd + sellSlippage.slippageUsd;
    const notional = buyCost;
    const latencyPenaltyUsd = calculateLatencyPenalty(notional, combinedLatencyMs);
    const netProfitUsd = grossProfitUsd - feesUsd - slippageUsd - latencyPenaltyUsd;
    const netProfitPct = (netProfitUsd / notional) * 100;

    if (!this.canAffordBuy(buyExchange, volumeBtc, buyPrice)) {
      return this.rejectedTrade({
        buyExchange,
        sellExchange,
        buyPrice,
        sellPrice,
        reason: 'Insufficient fiat balance on buy exchange',
      });
    }

    if (!this.canAffordSell(sellExchange, volumeBtc)) {
      return this.rejectedTrade({
        buyExchange,
        sellExchange,
        buyPrice,
        sellPrice,
        reason: 'Insufficient BTC balance on sell exchange',
      });
    }

    this.wallets[buyExchange].fiat -= buyCost + buyFee;
    this.wallets[buyExchange].btc += volumeBtc;
    this.wallets[sellExchange].btc -= volumeBtc;
    this.wallets[sellExchange].fiat += sellProceeds - sellFee;

    const isPartial =
      volumeBtc < targetVolumeBtc * 0.99 ||
      !buySlippage.sufficientLiquidity ||
      !sellSlippage.sufficientLiquidity;

    return {
      id: randomUUID(),
      timestamp: Date.now(),
      buyExchange,
      sellExchange,
      buyPrice: Math.round(buyPrice * 100) / 100,
      sellPrice: Math.round(sellPrice * 100) / 100,
      volumeBtc,
      grossProfitUsd: Math.round(grossProfitUsd * 100) / 100,
      feesUsd: Math.round(feesUsd * 100) / 100,
      slippageUsd: Math.round(slippageUsd * 100) / 100,
      latencyPenaltyUsd: Math.round(latencyPenaltyUsd * 100) / 100,
      netProfitUsd: Math.round(netProfitUsd * 100) / 100,
      netProfitPct: Math.round(netProfitPct * 10000) / 10000,
      status: isPartial ? 'partial' : 'executed',
      reason: isPartial ? 'Partial fill due to liquidity or balance limits' : 'Trade executed successfully',
    };
  }

  private rejectedTrade(params: {
    buyExchange: ExchangeId;
    sellExchange: ExchangeId;
    buyPrice: number;
    sellPrice: number;
    reason: string;
  }): SimulatedTrade {
    return {
      id: randomUUID(),
      timestamp: Date.now(),
      buyExchange: params.buyExchange,
      sellExchange: params.sellExchange,
      buyPrice: params.buyPrice,
      sellPrice: params.sellPrice,
      volumeBtc: 0,
      grossProfitUsd: 0,
      feesUsd: 0,
      slippageUsd: 0,
      latencyPenaltyUsd: 0,
      netProfitUsd: 0,
      netProfitPct: 0,
      status: 'rejected',
      reason: params.reason,
    };
  }
}

function sumLiquidity(levels: [number, number][]): number {
  return levels.reduce((sum, [, amount]) => sum + amount, 0);
}
