import type { SlippageResult } from '../types/index.js';
import { config } from '../config.js';

export function calculateWeightedAveragePrice(
  levels: [number, number][],
  targetBtc: number,
  side: 'buy' | 'sell',
): SlippageResult {
  let remaining = targetBtc;
  let totalCost = 0;
  let filledBtc = 0;
  const bestPrice = levels[0]?.[0] ?? 0;

  for (const [price, amount] of levels.slice(0, config.orderBookDepth)) {
    if (remaining <= 0) break;
    const fill = Math.min(remaining, amount);
    totalCost += fill * price;
    filledBtc += fill;
    remaining -= fill;
  }

  if (filledBtc === 0) {
    return {
      avgPrice: bestPrice,
      filledBtc: 0,
      slippageUsd: 0,
      sufficientLiquidity: false,
    };
  }

  const avgPrice = totalCost / filledBtc;
  const slippagePerUnit = side === 'buy' ? avgPrice - bestPrice : bestPrice - avgPrice;
  const slippageUsd = Math.max(0, slippagePerUnit * filledBtc);

  return {
    avgPrice,
    filledBtc,
    slippageUsd,
    sufficientLiquidity: remaining <= 0,
  };
}

export function calculateLatencyPenalty(notionalUsd: number, combinedLatencyMs: number): number {
  const penaltyRate = 0.0001 * (combinedLatencyMs / 500);
  return notionalUsd * penaltyRate;
}

export function calculateLiquidityScore(maxExecutableBtc: number): number {
  if (maxExecutableBtc >= 1) return 30;
  if (maxExecutableBtc >= 0.5) return 25;
  if (maxExecutableBtc >= 0.1) return 20;
  if (maxExecutableBtc >= 0.01) return 10;
  return 5;
}

export function calculateLatencyPenaltyScore(combinedLatencyMs: number): number {
  if (combinedLatencyMs <= 500) return 0;
  if (combinedLatencyMs <= 1000) return 5;
  if (combinedLatencyMs <= 1500) return 10;
  if (combinedLatencyMs <= 2000) return 20;
  return 35;
}

export function calculateOpportunityScore(
  netProfitPct: number,
  maxExecutableBtc: number,
  combinedLatencyMs: number,
  riskPenalty: number,
): number {
  const liquidityScore = calculateLiquidityScore(maxExecutableBtc);
  const latencyPenaltyScore = calculateLatencyPenaltyScore(combinedLatencyMs);
  const raw = netProfitPct * 10_000 + liquidityScore - latencyPenaltyScore - riskPenalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function getRating(score: number): 'Excellent' | 'Good' | 'Moderate' | 'Weak' {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Moderate';
  return 'Weak';
}
