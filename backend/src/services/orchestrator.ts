import type {
  AppState,
  ArbitrageOpportunity,
  BotStatus,
  PerformanceMetrics,
  RuntimeSettings,
  SimulatedTrade,
} from '../types/index.js';
import { fetchAllOrderBooks } from './orderBookService.js';
import { ArbitrageEngine } from './arbitrageEngine.js';
import { WalletService } from './walletService.js';
import { RiskEngine } from './riskEngine.js';
import { settingsService } from './settingsService.js';
import { buildMarketInsight } from './marketInsightService.js';
import { OpportunityLogService } from './opportunityLogService.js';
import { sessionPersistence } from './sessionPersistenceService.js';
import { refreshFxRate, getUsdtUsdRate } from './fxService.js';

type StateListener = (state: AppState) => void;

export class AppOrchestrator {
  private walletService = new WalletService();
  private arbitrageEngine = new ArbitrageEngine(this.walletService);
  private riskEngine = new RiskEngine();
  private opportunityLog = new OpportunityLogService();
  private listeners: StateListener[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private botStatus: BotStatus = 'Active';

  private orderBooks: AppState['orderBooks'] = [];
  private opportunities: ArbitrageOpportunity[] = [];
  private trades: SimulatedTrade[] = [];
  private pnlHistory: AppState['pnlHistory'] = [{ timestamp: Date.now(), cumulativePnl: 0 }];
  private opportunitiesRejected = 0;
  private lastExecutedRoute: string | null = null;
  private lastExecutionTime = 0;

  start(): void {
    this.loadPersistedSession();
    void refreshFxRate();
    void this.tick();
    this.restartPolling();
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  updateSettings(partial: Partial<RuntimeSettings>): RuntimeSettings {
    const previous = settingsService.get();
    const updated = settingsService.update(partial);

    if (partial.demoMode !== undefined && partial.demoMode !== previous.demoMode) {
      this.resetTradingSession();
      console.info(`[Orchestrator] Mode switched to ${updated.demoMode ? 'demo' : 'live'} — session reset`);
    }

    if (partial.pollIntervalMs !== undefined) {
      this.restartPolling();
    }
    this.emitState();
    return updated;
  }

  private resetTradingSession(): void {
    this.trades = [];
    this.pnlHistory = [{ timestamp: Date.now(), cumulativePnl: 0 }];
    this.opportunitiesRejected = 0;
    this.lastExecutedRoute = null;
    this.lastExecutionTime = 0;
    this.walletService.resetWallets();
    this.riskEngine.reset();
    this.opportunityLog.reset();
    sessionPersistence.clear(settingsService.get().demoMode);
  }

  private loadPersistedSession(): void {
    const snapshot = sessionPersistence.load(settingsService.get().demoMode);
    if (!snapshot) return;

    this.trades = snapshot.trades;
    this.pnlHistory =
      snapshot.pnlHistory.length > 0
        ? snapshot.pnlHistory
        : [{ timestamp: Date.now(), cumulativePnl: 0 }];
    this.opportunitiesRejected = snapshot.opportunitiesRejected;
    this.walletService.importSnapshot(snapshot.wallets);
  }

  private persistSession(): void {
    sessionPersistence.save(settingsService.get().demoMode, {
      trades: this.trades,
      pnlHistory: this.pnlHistory,
      opportunitiesRejected: this.opportunitiesRejected,
      wallets: this.walletService.exportSnapshot(),
    });
  }

  private restartPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    const interval = settingsService.get().pollIntervalMs;
    this.pollTimer = setInterval(() => void this.tick(), interval);
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
      settings: settingsService.get(),
      orderBooks: this.orderBooks,
      opportunities: this.opportunities,
      opportunityLog: this.opportunityLog.getEntries(),
      trades: this.trades.slice(0, 100),
      wallets: this.walletService.getBalances(referencePrice),
      performance,
      pnlHistory: this.pnlHistory,
      marketInsight: buildMarketInsight({
        opportunities: this.opportunities,
        orderBooks: this.orderBooks,
        demoMode: settingsService.get().demoMode,
        usdtUsdRate: getUsdtUsdRate(),
      }),
      lastUpdated: Date.now(),
    };
  }

  private async tick(): Promise<void> {
    try {
      const settings = settingsService.get();
      if (settings.demoMode) {
        this.walletService.replenishDemoWallets();
      }
      await refreshFxRate();
      this.orderBooks = await fetchAllOrderBooks();
      this.opportunities = this.arbitrageEngine.detectOpportunities(this.orderBooks);
      this.opportunityLog.appendFromScan(this.opportunities, settings.demoMode);

      if (settings.autoExecute && !this.riskEngine.isExecutionPaused()) {
        this.tryExecuteOpportunities(settings);
      }

      this.persistSession();
      this.emitState();
    } catch (error) {
      console.error('[Orchestrator] Tick failed:', error);
    }
  }

  private tryExecuteOpportunities(settings: RuntimeSettings): void {
    const cooldownMs = settings.demoMode ? Math.max(800, settings.pollIntervalMs) : 3000;
    const now = Date.now();
    if (now - this.lastExecutionTime < cooldownMs) return;

    const executable = this.opportunities.filter((opp) => opp.status === 'executable');
    if (executable.length === 0) return;

    for (const candidate of executable) {
      const routeKey = `${candidate.buyExchange}:${candidate.sellExchange}`;
      if (routeKey === this.lastExecutedRoute && now - this.lastExecutionTime < cooldownMs * 2) {
        continue;
      }

      const validation = this.riskEngine.validateOpportunity(candidate);
      if (!validation.allowed) {
        this.opportunitiesRejected += 1;
        candidate.status = 'rejected';
        candidate.reason = validation.reason;
        continue;
      }

      const buyBook = this.orderBooks.find((book) => book.exchange === candidate.buyExchange);
      const sellBook = this.orderBooks.find((book) => book.exchange === candidate.sellExchange);
      if (!buyBook || !sellBook) continue;

      const trade = this.walletService.executeTrade({
        buyExchange: candidate.buyExchange,
        sellExchange: candidate.sellExchange,
        buyBook,
        sellBook,
        targetVolumeBtc: candidate.maxExecutableBtc,
        combinedLatencyMs: candidate.combinedLatencyMs,
      });

      this.riskEngine.recordTrade(trade);
      this.trades.unshift(trade);
      this.lastExecutedRoute = routeKey;
      this.lastExecutionTime = now;

      if (trade.status === 'rejected') {
        this.opportunitiesRejected += 1;
        candidate.status = 'rejected';
        candidate.reason = trade.reason;
        continue;
      }

      candidate.status = trade.status;
      candidate.reason = trade.reason;
      this.updatePnlHistory(trade.netProfitUsd);
      return;
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
      opportunitiesDetected: this.opportunities.length,
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
