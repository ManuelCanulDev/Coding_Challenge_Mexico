import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState, PersistedHistory, PerformanceMetrics, RuntimeSettings, WsMessage } from '../types';
import {
  clearAllSessionHistory,
  clearHistory,
  getLastKnownDemoMode,
  loadHistory,
  mergeTrades,
  saveHistory,
  setLastKnownDemoMode,
} from '../utils/format';
import { resolveApiBase, resolveWsUrl } from '../utils/transport';

const RECONNECT_MS = 2000;
const CONNECT_TIMEOUT_MS = 8000;
const POLL_MS = 2000;

const defaultState: AppState = {
  botStatus: 'Paused',
  circuitBreaker: {
    active: false,
    consecutiveNegativeTrades: 0,
    pausedUntil: null,
    remainingSeconds: 0,
  },
  settings: {
    demoMode: false,
    autoExecute: true,
    pollIntervalMs: 1500,
    minNetProfitPct: 0.02,
    minVolumeBtc: 0.001,
    maxCombinedLatencyMs: 2000,
    circuitBreakerThreshold: 3,
    circuitBreakerCooldownMs: 60000,
  },
  orderBooks: [],
  opportunities: [],
  opportunityLog: [],
  trades: [],
  wallets: [],
  performance: {
    totalPnlUsd: 0,
    tradesExecuted: 0,
    opportunitiesDetected: 0,
    opportunitiesRejected: 0,
    winRate: 0,
    avgProfitPerTrade: 0,
  },
  pnlHistory: [{ timestamp: Date.now(), cumulativePnl: 0 }],
  marketInsight: {
    regime: 'efficient',
    regimeLabel: 'Mercado eficiente',
    headline: 'Conectando con el motor…',
    narrative: 'Esperando datos de mercado.',
    recommendation: '',
    efficiencyScore: 50,
    bestGrossSpreadUsd: 0,
    avgFeeDragUsd: 0,
    actionableCount: 0,
    blockedByCostsCount: 0,
    deadOnTransferCount: 0,
    avgDataLatencyMs: 0,
    exchangesOnline: 0,
    usdtUsdRate: 1,
  },
  lastUpdated: Date.now(),
};

export type WsConnectionStatus = 'connecting' | 'connected' | 'disconnected';

function createEmptySession(): Pick<AppState, 'trades' | 'pnlHistory' | 'performance' | 'opportunityLog'> {
  return {
    trades: [],
    pnlHistory: [{ timestamp: Date.now(), cumulativePnl: 0 }],
    performance: {
      totalPnlUsd: 0,
      tradesExecuted: 0,
      opportunitiesDetected: 0,
      opportunitiesRejected: 0,
      winRate: 0,
      avgProfitPerTrade: 0,
    },
    opportunityLog: [],
  };
}

function isSessionEmpty(payload: Pick<AppState, 'trades' | 'pnlHistory'>): boolean {
  return payload.trades.length === 0 && (payload.pnlHistory.at(-1)?.cumulativePnl ?? 0) === 0;
}

function buildStateWithSession(payload: AppState, session: ReturnType<typeof createEmptySession>): AppState {
  return {
    ...payload,
    settings: payload.settings,
    ...session,
    performance: syncPerformanceWithSession(payload.performance, session.trades, session.pnlHistory),
    opportunityLog: payload.opportunityLog ?? [],
  };
}
function syncPerformanceWithSession(
  performance: PerformanceMetrics,
  trades: AppState['trades'],
  pnlHistory: AppState['pnlHistory'],
): PerformanceMetrics {
  const executed = trades.filter((trade) => trade.status === 'executed' || trade.status === 'partial');
  const totalPnlUsd = pnlHistory.at(-1)?.cumulativePnl ?? 0;
  const winningTrades = executed.filter((trade) => trade.netProfitUsd > 0);

  return {
    ...performance,
    totalPnlUsd: Math.round(totalPnlUsd * 100) / 100,
    tradesExecuted: executed.length,
    winRate:
      executed.length > 0
        ? Math.round((winningTrades.length / executed.length) * 10000) / 100
        : 0,
    avgProfitPerTrade:
      executed.length > 0
        ? Math.round((totalPnlUsd / executed.length) * 100) / 100
        : 0,
  };
}

export function useWebSocketState() {
  const [state, setState] = useState<AppState>(() => {
    const demoMode = getLastKnownDemoMode();
    const persisted = loadHistory<PersistedHistory>(demoMode);
    if (persisted) {
      return {
        ...defaultState,
        settings: { ...defaultState.settings, demoMode },
        trades: persisted.trades ?? [],
        pnlHistory: persisted.pnlHistory ?? defaultState.pnlHistory,
        performance: persisted.performance ?? defaultState.performance,
      };
    }
    return { ...defaultState, settings: { ...defaultState.settings, demoMode } };
  });
  const [wsStatus, setWsStatus] = useState<WsConnectionStatus>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const transportRef = useRef<'ws' | 'poll'>('ws');
  const pendingDemoModeRef = useRef<boolean | null>(null);
  const ignorePersistedSessionRef = useRef(false);
  const [sessionEpoch, setSessionEpoch] = useState(0);

  const bumpSessionEpoch = useCallback(() => {
    setSessionEpoch((value) => value + 1);
  }, []);

  const mergeIncomingState = useCallback((prev: AppState, payload: AppState): AppState => {
    const pendingMode = pendingDemoModeRef.current;

    if (pendingMode !== null && payload.settings.demoMode !== pendingMode) {
      if (prev.settings.demoMode === pendingMode) {
        return prev;
      }
      return {
        ...prev,
        settings: { ...prev.settings, demoMode: pendingMode },
        ...createEmptySession(),
      };
    }

    const demoMode = payload.settings.demoMode;
    const modeChanged = prev.settings.demoMode !== demoMode;

    if (modeChanged) {
      ignorePersistedSessionRef.current = true;
      pendingDemoModeRef.current = null;
      setLastKnownDemoMode(demoMode);
      clearHistory(demoMode);
      bumpSessionEpoch();
      const session = createEmptySession();
      const nextState = buildStateWithSession(payload, session);
      saveHistory(
        {
          trades: [],
          pnlHistory: nextState.pnlHistory,
          performance: nextState.performance,
        },
        demoMode,
      );
      return nextState;
    }

    const awaitingFreshSession =
      ignorePersistedSessionRef.current || pendingDemoModeRef.current !== null;

    if (awaitingFreshSession && !isSessionEmpty(payload)) {
      return buildStateWithSession(payload, createEmptySession());
    }

    if (awaitingFreshSession && isSessionEmpty(payload)) {
      ignorePersistedSessionRef.current = false;
      pendingDemoModeRef.current = null;
    }

    const usePersisted = !ignorePersistedSessionRef.current;
    const persisted = usePersisted ? loadHistory<PersistedHistory>(demoMode) : null;
    const mergedTrades = usePersisted
      ? mergeTrades(payload.trades, persisted?.trades ?? prev.trades)
      : payload.trades;

    const serverSessionEmpty = isSessionEmpty(payload);

    let mergedPnl: AppState['pnlHistory'];
    if (serverSessionEmpty || !usePersisted) {
      mergedPnl = payload.pnlHistory;
    } else if (payload.pnlHistory.length > 1) {
      mergedPnl = payload.pnlHistory;
    } else {
      mergedPnl = persisted?.pnlHistory ?? prev.pnlHistory;
    }

    const nextState: AppState = {
      ...payload,
      trades: mergedTrades,
      pnlHistory: mergedPnl,
      opportunityLog: payload.opportunityLog ?? [],
      performance: syncPerformanceWithSession(payload.performance, mergedTrades, mergedPnl),
    };

    saveHistory(
      {
        trades: mergedTrades.slice(0, 100),
        pnlHistory: mergedPnl,
        performance: nextState.performance,
      },
      demoMode,
    );

    return nextState;
  }, [bumpSessionEpoch]);

  const applySettingsSave = useCallback((updated: RuntimeSettings) => {
    pendingDemoModeRef.current = updated.demoMode;
    ignorePersistedSessionRef.current = true;
    setLastKnownDemoMode(updated.demoMode);

    setState((prev) => {
      const modeChanged = prev.settings.demoMode !== updated.demoMode;
      if (!modeChanged) {
        return { ...prev, settings: updated };
      }

      clearAllSessionHistory();
      bumpSessionEpoch();
      const session = createEmptySession();
      saveHistory(
        {
          trades: [],
          pnlHistory: session.pnlHistory,
          performance: session.performance,
        },
        updated.demoMode,
      );

      return {
        ...prev,
        settings: updated,
        ...session,
      };
    });
  }, [bumpSessionEpoch]);

  useEffect(() => {
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    function clearReconnectTimer(): void {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    function clearPollTimer(): void {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function disposeSocket(ws: WebSocket): void {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }

    function scheduleReconnect(connect: () => void): void {
      clearReconnectTimer();
      reconnectTimer = setTimeout(connect, RECONNECT_MS);
    }

    async function pollState(): Promise<void> {
      if (!active || transportRef.current !== 'poll') return;
      try {
        const response = await fetch(`${resolveApiBase()}/api/state`);
        if (!response.ok) return;
        const payload = (await response.json()) as AppState;
        if (!active || transportRef.current !== 'poll') return;
        setState((prev) => mergeIncomingState(prev, payload));
        setWsStatus('connected');
      } catch {
        if (active && transportRef.current === 'poll') {
          setWsStatus('disconnected');
        }
      }
    }

    function startPollingFallback(): void {
      if (transportRef.current === 'poll') return;
      transportRef.current = 'poll';
      if (wsRef.current) {
        disposeSocket(wsRef.current);
        wsRef.current = null;
      }
      clearReconnectTimer();
      void pollState();
      pollTimer = setInterval(pollState, POLL_MS);
    }

    function connect(): void {
      if (!active || transportRef.current === 'poll') return;
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

      if (wsRef.current) {
        disposeSocket(wsRef.current);
        wsRef.current = null;
      }

      setWsStatus('connecting');
      const wsUrl = resolveWsUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const connectTimeout = setTimeout(() => {
        if (!active || wsRef.current !== ws || transportRef.current === 'poll') return;
        if (ws.readyState === WebSocket.CONNECTING) {
          disposeSocket(ws);
          if (wsRef.current === ws) wsRef.current = null;
          startPollingFallback();
        }
      }, CONNECT_TIMEOUT_MS);

      ws.onopen = () => {
        clearTimeout(connectTimeout);
        if (!active || wsRef.current !== ws) return;
        transportRef.current = 'ws';
        clearPollTimer();
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        if (!active || wsRef.current !== ws) return;
        try {
          const message = JSON.parse(event.data as string) as WsMessage;
          if (message.type === 'state' && message.payload) {
            setState((prev) => mergeIncomingState(prev, message.payload!));
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onerror = () => {
        clearTimeout(connectTimeout);
        if (!active || wsRef.current !== ws || transportRef.current === 'poll') return;
        disposeSocket(ws);
        if (wsRef.current === ws) wsRef.current = null;
        startPollingFallback();
      };

      ws.onclose = () => {
        clearTimeout(connectTimeout);
        if (wsRef.current === ws) wsRef.current = null;
        if (!active || transportRef.current === 'poll') return;
        setWsStatus('disconnected');
        scheduleReconnect(connect);
      };
    }

    connect();

    return () => {
      active = false;
      clearReconnectTimer();
      clearPollTimer();
      if (wsRef.current) {
        disposeSocket(wsRef.current);
        wsRef.current = null;
      }
    };
  }, [mergeIncomingState]);

  return { state, wsStatus, applySettingsSave, sessionEpoch };
}
