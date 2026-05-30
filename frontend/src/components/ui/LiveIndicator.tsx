import type { WsConnectionStatus } from '../../hooks/useWebSocket';

interface LiveIndicatorProps {
  status: WsConnectionStatus;
  showLabel?: boolean;
}

const labels: Record<WsConnectionStatus, string> = {
  connected: 'En vivo',
  connecting: 'Conectando…',
  disconnected: 'Sin conexión',
};

const dotClass: Record<WsConnectionStatus, string> = {
  connected: 'live-dot-connected',
  connecting: 'live-dot-connecting',
  disconnected: 'live-dot-disconnected',
};

export function LiveIndicator({ status, showLabel = true }: LiveIndicatorProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
        status === 'connected'
          ? 'border-accent-green/30 bg-accent-green/10 text-accent-green'
          : status === 'connecting'
            ? 'border-accent-yellow/30 bg-accent-yellow/10 text-accent-yellow'
            : 'border-accent-red/30 bg-accent-red/10 text-accent-red'
      }`}
    >
      <span className={`live-dot ${dotClass[status]}`} />
      {showLabel && <span>{labels[status]}</span>}
    </div>
  );
}
