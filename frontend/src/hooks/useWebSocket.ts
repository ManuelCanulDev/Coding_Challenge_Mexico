import { useEffect, useRef, useState } from 'react';
import type { AppState, PersistedHistory, WsMessage } from '../types';
import { getLastKnownDemoMode, loadHistory, mergeTrades, saveHistory } from '../utils/format';

function resolveWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (typeof window === 'undefined') {
    return 'ws://localhost:3001/ws';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (import.meta.env.PROD) {
    return `${protocol}//${window.location.host}/ws`;
  }
  const backendPort = import.meta.env.VITE_BACKEND_PORT ?? '3001';
  return `${protocol}//${window.location.hostname}:${backendPort}/ws`;
}

const WS_URL = resolveWsUrl();
const RECONNECT_MS = 2000;

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

  useEffect(() => {
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function clearReconnectTimer(): void {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
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

    function connect(): void {
      if (!active) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

      if (wsRef.current) {
        disposeSocket(wsRef.current);
        wsRef.current = null;
      }

      setWsStatus('connecting');
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!active || wsRef.current !== ws) return;
        setWsStatus('connected');
      };

      ws.onmessage = (event) => {
        if (!active || wsRef.current !== ws) return;
        try {
          const message = JSON.parse(event.data as string) as WsMessage;
          if (message.type === 'state' && message.payload) {
            setState((prev) => {
              const demoMode = message.payload!.settings.demoMode;
              const modeChanged = prev.settings.demoMode !== demoMode;
              const persisted = modeChanged ? null : loadHistory<PersistedHistory>(demoMode);

              const mergedTrades = modeChanged
                ? message.payload!.trades
                : mergeTrades(message.payload!.trades, persisted?.trades ?? prev.trades);

              const mergedPnl = modeChanged
                ? message.payload!.pnlHistory
                : message.payload!.pnlHistory.length > 1
                  ? message.payload!.pnlHistory
                  : persisted?.pnlHistory ?? prev.pnlHistory;

            const nextState: AppState = {
              ...message.payload!,
              trades: mergedTrades,
              pnlHistory: mergedPnl,
              opportunityLog: message.payload!.opportunityLog ?? [],
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
            });
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onerror = () => {
        if (!active || wsRef.current !== ws) return;
        disposeSocket(ws);
        if (wsRef.current === ws) wsRef.current = null;
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (!active) return;
        setWsStatus('disconnected');
        scheduleReconnect(connect);
      };
    }

    connect();

    return () => {
      active = false;
      clearReconnectTimer();
      if (wsRef.current) {
        disposeSocket(wsRef.current);
        wsRef.current = null;
      }
    };
  }, []);

  return { state, wsStatus };
}
