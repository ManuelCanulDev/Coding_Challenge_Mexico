import type { AppState } from '../types';
import type { WsConnectionStatus } from '../hooks/useWebSocket';
import { formatUsd, profitClass } from '../utils/format';
import { LiveIndicator } from './ui/LiveIndicator';

interface HeaderProps {
  state: AppState;
  wsStatus: WsConnectionStatus;
  onOpenSettings: () => void;
}

export function Header({ state, wsStatus, onOpenSettings }: HeaderProps) {
  const pnl = state.performance.totalPnlUsd;
  const botOk = state.botStatus === 'Active' && !state.circuitBreaker.active;

  return (
    <header className="panel sticky top-2 z-20 mb-4 overflow-hidden sm:top-4 sm:mb-6">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-jade-500/30 bg-jade-500/10">
            <span className="text-sm font-bold text-jade-400">BX</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-bold text-white sm:text-xl">Balam Xchange</h1>
              <LiveIndicator status={wsStatus} />
              {state.settings.demoMode && (
                <span className="badge border-accent-gold/30 bg-accent-gold/10 text-accent-gold">Demo</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-[10px] uppercase text-gray-500">P&L</p>
            <p className={`mono text-lg font-bold ${profitClass(pnl)}`}>{formatUsd(pnl)}</p>
          </div>
          <span
            className={`badge ${botOk ? 'border-jade-500/30 bg-jade-500/10 text-jade-300' : 'border-accent-yellow/30 bg-accent-yellow/10 text-accent-yellow'}`}
          >
            {botOk ? 'ON' : 'PAUSA'}
          </span>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Configuración"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-gray-400 transition hover:border-jade-500/40 hover:text-white"
          >
            ⚙
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.05] px-4 py-2 sm:hidden">
        <span className="text-[10px] uppercase text-gray-500">P&L</span>
        <span className={`mono text-sm font-bold ${profitClass(pnl)}`}>{formatUsd(pnl)}</span>
      </div>
    </header>
  );
}
