import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState, PersistedHistory, RuntimeSettings, WsMessage } from '../types';
import { getLastKnownDemoMode, loadHistory, mergeTrades, saveHistory, setLastKnownDemoMode } from '../utils/format';
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

  const mergeIncomingState = useCallback((prev: AppState, payload: AppState): AppState => {
    if (
      pendingDemoModeRef.current !== null &&
      payload.settings.demoMode !== pendingDemoModeRef.current
    ) {
      return prev;
    }

    if (
      pendingDemoModeRef.current !== null &&
      payload.settings.demoMode === pendingDemoModeRef.current
    ) {
      pendingDemoModeRef.current = null;
    }

    const demoMode = payload.settings.demoMode;
    const modeChanged = prev.settings.demoMode !== demoMode;

    if (modeChanged) {
      setLastKnownDemoMode(demoMode);
      const nextState: AppState = {
        ...payload,
        ...createEmptySession(),
        settings: payload.settings,
      };
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

    const persisted = loadHistory<PersistedHistory>(demoMode);
    const mergedTrades = mergeTrades(payload.trades, persisted?.trades ?? prev.trades);

    const serverSessionEmpty =
      payload.trades.length === 0 && (payload.pnlHistory.at(-1)?.cumulativePnl ?? 0) === 0;

    const mergedPnl =
      payload.pnlHistory.length > 1
        ? payload.pnlHistory
        : serverSessionEmpty
          ? payload.pnlHistory
          : persisted?.pnlHistory ?? prev.pnlHistory;

    const nextState: AppState = {
      ...payload,
      trades: mergedTrades,
      pnlHistory: mergedPnl,
      opportunityLog: payload.opportunityLog ?? [],
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
  }, []);

  const applySettingsSave = useCallback((updated: RuntimeSettings) => {
    pendingDemoModeRef.current = updated.demoMode;
    setLastKnownDemoMode(updated.demoMode);

    setState((prev) => {
      const modeChanged = prev.settings.demoMode !== updated.demoMode;
      if (!modeChanged) {
        return { ...prev, settings: updated };
      }

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
  }, []);

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

  return { state, wsStatus, applySettingsSave };
}
