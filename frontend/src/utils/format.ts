const STORAGE_KEY_PREFIX = 'balam-xchange-history';
const MODE_KEY = 'balam-xchange-active-mode';

function historyKey(demoMode: boolean): string {
  return `${STORAGE_KEY_PREFIX}-${demoMode ? 'demo' : 'live'}`;
}

export function getLastKnownDemoMode(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) === 'demo';
  } catch {
    return false;
  }
}

export function setLastKnownDemoMode(demoMode: boolean): void {
  try {
    localStorage.setItem(MODE_KEY, demoMode ? 'demo' : 'live');
  } catch {
    // Ignore quota errors
  }
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(4)}%`;
}

export function formatBtc(value: number): string {
  return `${value.toFixed(6)} BTC`;
}

export function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(timestamp));
}

export function capitalizeExchange(exchange: string): string {
  return exchange.charAt(0).toUpperCase() + exchange.slice(1);
}

export function profitClass(value: number): string {
  if (value > 0) return 'metric-up';
  if (value < 0) return 'metric-down';
  return 'metric-neutral';
}

export function profitSign(value: number): string {
  if (value > 0) return '+';
  return '';
}

export function exchangeAccent(exchange: string): string {
  switch (exchange.toLowerCase()) {
    case 'binance':
      return 'border-l-yellow-500/60';
    case 'kraken':
      return 'border-l-purple-500/60';
    case 'coinbase':
      return 'border-l-blue-500/60';
    case 'okx':
      return 'border-l-gray-400/60';
    default:
      return 'border-l-brand-500/60';
  }
}

export function exchangeDotClass(exchange: string): string {
  switch (exchange.toLowerCase()) {
    case 'binance':
      return 'bg-yellow-400';
    case 'kraken':
      return 'bg-purple-400';
    case 'coinbase':
      return 'bg-blue-400';
    case 'okx':
      return 'bg-gray-400';
    default:
      return 'bg-brand-400';
  }
}

export function formatStatusLabel(status: string): string {
  switch (status) {
    case 'executed':
      return 'Ejecutado';
    case 'executable':
      return 'Ejecutable';
    case 'detected':
      return 'Detectado';
    case 'rejected':
      return 'Rechazado';
    case 'partial':
      return 'Parcial';
    case 'online':
      return 'En línea';
    case 'offline':
      return 'Desconectado';
    case 'Active':
      return 'Activo';
    case 'Paused':
      return 'Pausado';
    default:
      return status;
  }
}

export function formatExchangeStatusLabel(status: string): string {
  return formatStatusLabel(status);
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case 'executed':
    case 'executable':
    case 'online':
    case 'Active':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'partial':
    case 'detected':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'rejected':
    case 'offline':
    case 'Paused':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  }
}

export function ratingClass(rating: string): string {
  switch (rating) {
    case 'Excellent':
      return 'text-emerald-400';
    case 'Good':
      return 'text-blue-400';
    case 'Moderate':
      return 'text-amber-400';
    default:
      return 'text-gray-400';
  }
}

export function saveHistory(
  data: {
    trades: unknown[];
    pnlHistory: unknown[];
    performance: unknown;
  },
  demoMode: boolean,
): void {
  try {
    localStorage.setItem(historyKey(demoMode), JSON.stringify(data));
    setLastKnownDemoMode(demoMode);
  } catch {
    // Ignore quota errors
  }
}

export function loadHistory<T>(demoMode: boolean): T | null {
  try {
    const raw = localStorage.getItem(historyKey(demoMode));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearHistory(demoMode: boolean): void {
  try {
    localStorage.removeItem(historyKey(demoMode));
  } catch {
    // Ignore quota errors
  }
}

export function mergeTrades<T extends { id: string; timestamp: number }>(
  incoming: T[],
  persisted: T[],
): T[] {
  const map = new Map<string, T>();
  for (const trade of [...persisted, ...incoming]) {
    map.set(trade.id, trade);
  }
  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
}
