import type { ArbitrageOpportunity, CircuitBreakerState, SimulatedTrade } from '../types/index.js';
import { config } from '../config.js';

export class RiskEngine {
  private consecutiveNegativeTrades = 0;
  private pausedUntil: number | null = null;

  getState(): CircuitBreakerState {
    const now = Date.now();
    const active = this.pausedUntil !== null && now < this.pausedUntil;
    const remainingSeconds =
      active && this.pausedUntil ? Math.ceil((this.pausedUntil - now) / 1000) : 0;

    if (this.pausedUntil !== null && now >= this.pausedUntil) {
      this.pausedUntil = null;
      this.consecutiveNegativeTrades = 0;
    }

    return {
      active,
      consecutiveNegativeTrades: this.consecutiveNegativeTrades,
      pausedUntil: this.pausedUntil,
      remainingSeconds,
    };
  }

  isExecutionPaused(): boolean {
    const state = this.getState();
    return state.active;
  }

  validateOpportunity(opportunity: ArbitrageOpportunity): { allowed: boolean; reason: string; riskPenalty: number } {
    let riskPenalty = 0;

    if (this.isExecutionPaused()) {
      return {
        allowed: false,
        reason: `Circuit breaker active (${this.getState().remainingSeconds}s remaining)`,
        riskPenalty: 50,
      };
    }

    if (opportunity.netProfitPct <= config.minNetProfitPct) {
      return {
        allowed: false,
        reason: `Net profit ${opportunity.netProfitPct.toFixed(4)}% below minimum ${config.minNetProfitPct}%`,
        riskPenalty: 20,
      };
    }

    if (opportunity.maxExecutableBtc < config.minVolumeBtc) {
      return {
        allowed: false,
        reason: `Volume ${opportunity.maxExecutableBtc.toFixed(6)} BTC below minimum ${config.minVolumeBtc} BTC`,
        riskPenalty: 15,
      };
    }

    if (opportunity.combinedLatencyMs > config.maxCombinedLatencyMs) {
      return {
        allowed: false,
        reason: `Combined latency ${opportunity.combinedLatencyMs}ms exceeds ${config.maxCombinedLatencyMs}ms`,
        riskPenalty: 25,
      };
    }

    if (opportunity.netProfitUsd <= 0) {
      return {
        allowed: false,
        reason: 'Net profit USD is not positive',
        riskPenalty: 30,
      };
    }

    if (opportunity.maxExecutableBtc <= 0) {
      return {
        allowed: false,
        reason: 'Insufficient liquidity',
        riskPenalty: 25,
      };
    }

    if (opportunity.combinedLatencyMs > 1500) riskPenalty += 5;
    if (opportunity.maxExecutableBtc < 0.01) riskPenalty += 10;

    return { allowed: true, reason: 'Passed risk checks', riskPenalty };
  }

  recordTrade(trade: SimulatedTrade): void {
    if (trade.status === 'rejected') return;

    if (trade.netProfitUsd < 0) {
      this.consecutiveNegativeTrades += 1;
      if (this.consecutiveNegativeTrades >= config.circuitBreakerThreshold) {
        this.pausedUntil = Date.now() + config.circuitBreakerCooldownMs;
        console.warn('[RiskEngine] Circuit breaker triggered — pausing execution for 60s');
      }
    } else {
      this.consecutiveNegativeTrades = 0;
    }
  }
}
