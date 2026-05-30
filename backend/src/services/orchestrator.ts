import type {
  AppState,
  ArbitrageOpportunity,
  BotStatus,
  PerformanceMetrics,
  SimulatedTrade,
} from '../types/index.js';
import { config } from '../config.js';
import { fetchAllOrderBooks } from './orderBookService.js';
import { ArbitrageEngine } from './arbitrageEngine.js';
import { WalletService } from './walletService.js';
import { RiskEngine } from './riskEngine.js';

type StateListener = (state: AppState) => void;

export class AppOrchestrator {
  private walletService = new WalletService();
  private arbitrageEngine = new ArbitrageEngine(this.walletService);
  private riskEngine = new RiskEngine();
  private listeners: StateListener[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private botStatus: BotStatus = 'Active';

  private orderBooks: AppState['orderBooks'] = [];
  private opportunities: ArbitrageOpportunity[] = [];
  private trades: SimulatedTrade[] = [];
  private pnlHistory: AppState['pnlHistory'] = [{ timestamp: Date.now(), cumulativePnl: 0 }];
  private opportunitiesDetected = 0;
  private opportunitiesRejected = 0;
  private lastExecutedOpportunityId: string | null = null;
  private lastExecutionTime = 0;

  start(): void {
    void this.tick();
    this.pollTimer = setInterval(() => void this.tick(), config.pollIntervalMs);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  onStateChange(listener: StateListener): () => void {
    this.listeners.push(listener);
    listener(this.getState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getState(): AppState {
    const referencePrice =
      this.orderBooks.find((book) => book.status === 'online')?.bid ??
      this.orderBooks[0]?.bid ??
      96_500;

    const circuitBreaker = this.riskEngine.getState();
    const performance = this.calculatePerformance();

    return {
      botStatus: circuitBreaker.active ? 'Paused' : this.botStatus,
      circuitBreaker,
      orderBooks: this.orderBooks,
      opportunities: this.opportunities,
      trades: this.trades.slice(0, 100),
      wallets: this.walletService.getBalances(referencePrice),
      performance,
      pnlHistory: this.pnlHistory,
      lastUpdated: Date.now(),
    };
  }

  private async tick(): Promise<void> {
    try {
      this.orderBooks = await fetchAllOrderBooks();
      this.opportunities = this.arbitrageEngine.detectOpportunities(this.orderBooks);
      this.opportunitiesDetected += this.opportunities.length;

      if (config.autoExecute && !this.riskEngine.isExecutionPaused()) {
        await this.tryExecuteBestOpportunity();
      }

      this.emitState();
    } catch (error) {
      console.error('[Orchestrator] Tick failed:', error);
    }
  }

  private async tryExecuteBestOpportunity(): Promise<void> {
    const now = Date.now();
    if (now - this.lastExecutionTime < 3000) return;

    const executable = this.opportunities.filter((opp) => opp.status === 'executable');
    if (executable.length === 0) return;

    const best = executable[0];
    if (best.id === this.lastExecutedOpportunityId) return;

    const validation = this.riskEngine.validateOpportunity(best);
    if (!validation.allowed) {
      this.opportunitiesRejected += 1;
      best.status = 'rejected';
      best.reason = validation.reason;
      return;
    }

    const buyBook = this.orderBooks.find((book) => book.exchange === best.buyExchange);
    const sellBook = this.orderBooks.find((book) => book.exchange === best.sellExchange);
    if (!buyBook || !sellBook) return;

    const trade = this.walletService.executeTrade({
      buyExchange: best.buyExchange,
      sellExchange: best.sellExchange,
      buyBook,
      sellBook,
      targetVolumeBtc: best.maxExecutableBtc,
      combinedLatencyMs: best.combinedLatencyMs,
    });

    this.riskEngine.recordTrade(trade);
    this.trades.unshift(trade);
    this.lastExecutedOpportunityId = best.id;
    this.lastExecutionTime = now;

    if (trade.status === 'rejected') {
      this.opportunitiesRejected += 1;
      best.status = 'rejected';
      best.reason = trade.reason;
    } else {
      best.status = trade.status;
      best.reason = trade.reason;
      this.updatePnlHistory(trade.netProfitUsd);
    }
  }

  private updatePnlHistory(netProfitUsd: number): void {
    const last = this.pnlHistory[this.pnlHistory.length - 1]?.cumulativePnl ?? 0;
    this.pnlHistory.push({
      timestamp: Date.now(),
      cumulativePnl: Math.round((last + netProfitUsd) * 100) / 100,
    });

    if (this.pnlHistory.length > 200) {
      this.pnlHistory = this.pnlHistory.slice(-200);
    }
  }

  private calculatePerformance(): PerformanceMetrics {
    const executedTrades = this.trades.filter(
      (trade) => trade.status === 'executed' || trade.status === 'partial',
    );
    const winningTrades = executedTrades.filter((trade) => trade.netProfitUsd > 0);
    const totalPnlUsd = executedTrades.reduce((sum, trade) => sum + trade.netProfitUsd, 0);

    return {
      totalPnlUsd: Math.round(totalPnlUsd * 100) / 100,
      tradesExecuted: executedTrades.length,
      opportunitiesDetected: this.opportunitiesDetected,
      opportunitiesRejected: this.opportunitiesRejected,
      winRate:
        executedTrades.length > 0
          ? Math.round((winningTrades.length / executedTrades.length) * 10000) / 100
          : 0,
      avgProfitPerTrade:
        executedTrades.length > 0
          ? Math.round((totalPnlUsd / executedTrades.length) * 100) / 100
          : 0,
    };
  }

  private emitState(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
