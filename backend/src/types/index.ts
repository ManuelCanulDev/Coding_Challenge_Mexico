export type ExchangeId = 'binance' | 'kraken' | 'coinbase' | 'okx';
export type ExchangeStatus = 'online' | 'offline';
export type TradeStatus = 'executed' | 'partial' | 'rejected';
export type OpportunityRating = 'Excellent' | 'Good' | 'Moderate' | 'Weak';
export type BotStatus = 'Active' | 'Paused';

export interface NormalizedOrderBook {
  exchange: ExchangeId;
  symbol: string;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  bids: [number, number][];
  asks: [number, number][];
  timestamp: number;
  latencyMs: number;
  status: ExchangeStatus;
}

export interface ArbitrageOpportunity {
  id: string;
  buyExchange: ExchangeId;
  sellExchange: ExchangeId;
  buyAsk: number;
  sellBid: number;
  grossSpreadUsd: number;
  grossSpreadPct: number;
  buyFee: number;
  sellFee: number;
  slippageEstimate: number;
  latencyPenalty: number;
  netProfitUsd: number;
  netProfitPct: number;
  maxExecutableBtc: number;
  confidenceScore: number;
  score: number;
  rating: OpportunityRating;
  status: TradeStatus | 'detected' | 'executable';
  reason: string;
  combinedLatencyMs: number;
  timestamp: number;
}

export interface SimulatedTrade {
  id: string;
  timestamp: number;
  buyExchange: ExchangeId;
  sellExchange: ExchangeId;
  buyPrice: number;
  sellPrice: number;
  volumeBtc: number;
  grossProfitUsd: number;
  feesUsd: number;
  slippageUsd: number;
  latencyPenaltyUsd: number;
  netProfitUsd: number;
  netProfitPct: number;
  status: TradeStatus;
  reason: string;
}

export interface WalletBalance {
  exchange: ExchangeId;
  fiat: number;
  fiatCurrency: 'USDT' | 'USD';
  btc: number;
  estimatedTotalUsd: number;
}

export interface PerformanceMetrics {
  totalPnlUsd: number;
  tradesExecuted: number;
  opportunitiesDetected: number;
  opportunitiesRejected: number;
  winRate: number;
  avgProfitPerTrade: number;
}

export interface CircuitBreakerState {
  active: boolean;
  consecutiveNegativeTrades: number;
  pausedUntil: number | null;
  remainingSeconds: number;
}

export interface AppState {
  botStatus: BotStatus;
  circuitBreaker: CircuitBreakerState;
  orderBooks: NormalizedOrderBook[];
  opportunities: ArbitrageOpportunity[];
  trades: SimulatedTrade[];
  wallets: WalletBalance[];
  performance: PerformanceMetrics;
  pnlHistory: { timestamp: number; cumulativePnl: number }[];
  lastUpdated: number;
}

export interface WsMessage {
  type: 'state' | 'ping';
  payload?: AppState;
  timestamp: number;
}

export interface SlippageResult {
  avgPrice: number;
  filledBtc: number;
  slippageUsd: number;
  sufficientLiquidity: boolean;
}
