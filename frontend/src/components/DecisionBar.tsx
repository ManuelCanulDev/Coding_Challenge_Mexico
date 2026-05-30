import type { AppState } from '../types';
import { formatUsd } from '../utils/format';

interface DecisionBarProps {
  state: AppState;
}

type DecisionTone = 'go' | 'wait' | 'stop' | 'setup';

interface Decision {
  action: string;
  tone: DecisionTone;
  hint: string;
}

function resolveDecision(state: AppState): Decision {
  const { marketInsight, settings, circuitBreaker, botStatus } = state;

  if (circuitBreaker.active) {
    return {
      action: 'Esperar',
      tone: 'wait',
      hint: `Circuit breaker · ${circuitBreaker.remainingSeconds}s`,
    };
  }

  if (botStatus === 'Paused') {
    return { action: 'Pausado', tone: 'wait', hint: 'Bot detenido' };
  }

  if (marketInsight.actionableCount > 0 && settings.autoExecute) {
    return {
      action: 'Operar',
      tone: 'go',
      hint: `${marketInsight.actionableCount} ruta(s) viable(s)`,
    };
  }

  if (marketInsight.actionableCount > 0 && !settings.autoExecute) {
    return {
      action: 'Activar auto',
      tone: 'setup',
      hint: `${marketInsight.actionableCount} viable(s) · auto off`,
    };
  }

  if (!settings.demoMode && marketInsight.blockedByCostsCount > 0) {
    return {
      action: 'No operar',
      tone: 'stop',
      hint: 'Costos > spread',
    };
  }

  if (settings.demoMode) {
    return {
      action: 'Sin edge',
      tone: 'setup',
      hint: 'Revisa offsets demo',
    };
  }

  return { action: 'No operar', tone: 'stop', hint: 'Mercado eficiente' };
}

const toneStyles: Record<DecisionTone, string> = {
  go: 'border-jade-500/40 bg-jade-500/15 text-jade-300',
  wait: 'border-accent-yellow/40 bg-accent-yellow/10 text-accent-yellow',
  stop: 'border-white/15 bg-white/5 text-gray-300',
  setup: 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue',
};

export function DecisionBar({ state }: DecisionBarProps) {
  const decision = resolveDecision(state);
  const { marketInsight, settings } = state;

  const stats = [
    { label: 'Viables', value: String(marketInsight.actionableCount) },
    { label: 'Ejecutables', value: String(state.opportunities.filter((o) => o.status === 'executable').length) },
    { label: 'Bloqueadas', value: String(marketInsight.blockedByCostsCount) },
    { label: 'Spread máx', value: formatUsd(marketInsight.bestGrossSpreadUsd) },
    { label: 'Eficiencia', value: `${marketInsight.efficiencyScore}` },
    { label: 'Exchanges', value: `${marketInsight.exchangesOnline}/4` },
  ];

  return (
    <section className="panel mb-6 overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border sm:h-14 sm:w-28 sm:flex-row sm:gap-2 ${toneStyles[decision.tone]}`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">Acción</span>
            <span className="text-sm font-bold sm:text-base">{decision.action}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{marketInsight.regimeLabel}</p>
            <p className="truncate text-xs text-gray-500">{decision.hint}</p>
            {settings.demoMode && (
              <span className="mt-1 inline-block text-[10px] font-semibold uppercase text-accent-gold">
                Demo
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-white/[0.06] bg-surface-800/50 px-2 py-2 text-center sm:px-3"
            >
              <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-500 sm:text-[10px]">
                {stat.label}
              </p>
              <p className="mono mt-0.5 text-xs font-semibold text-gray-200 sm:text-sm">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
