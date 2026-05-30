import { randomUUID } from 'crypto';
import type { ArbitrageOpportunity, ExchangeId, OpportunityLogEntry } from '../types/index.js';

const MAX_ENTRIES = 150;

export class OpportunityLogService {
  private entries: OpportunityLogEntry[] = [];

  appendFromScan(opportunities: ArbitrageOpportunity[], demoMode: boolean): void {
    const scanAt = Date.now();

    for (const opp of opportunities) {
      this.entries.unshift({
        id: randomUUID(),
        scanAt,
        buyExchange: opp.buyExchange,
        sellExchange: opp.sellExchange,
        netProfitUsd: opp.netProfitUsd,
        netTransferUsd: opp.reality.serialArbNetUsd,
        status: opp.status,
        verdictLabel: opp.reality.verdictLabel,
        score: opp.score,
        demoMode,
      });
    }

    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES);
    }
  }

  getEntries(): OpportunityLogEntry[] {
    return this.entries;
  }

  reset(): void {
    this.entries = [];
  }
}

export function routeKey(buy: ExchangeId, sell: ExchangeId): string {
  return `${buy}:${sell}`;
}
