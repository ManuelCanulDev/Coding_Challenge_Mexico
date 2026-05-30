import type { PerformanceMetrics } from '../types';
import { formatUsd, profitClass } from '../utils/format';

interface PerformanceCardsProps {
  performance: PerformanceMetrics;
}

export function PerformanceCards({ performance }: PerformanceCardsProps) {
  const cards = [
    {
      label: 'P&L',
      value: formatUsd(performance.totalPnlUsd),
      className: profitClass(performance.totalPnlUsd),
    },
    {
      label: 'Trades',
      value: String(performance.tradesExecuted),
      className: 'text-white',
    },
    {
      label: 'Activas',
      value: String(performance.opportunitiesDetected),
      className: 'text-accent-blue',
    },
    {
      label: 'Win rate',
      value: `${performance.winRate.toFixed(0)}%`,
      className: performance.winRate >= 50 ? 'metric-up' : 'metric-neutral',
    },
  ];

  return (
    <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
      {cards.map((card) => (
        <div key={card.label} className="stat-card py-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">{card.label}</p>
          <p className={`mono mt-1 text-lg font-bold sm:text-xl ${card.className}`}>{card.value}</p>
        </div>
      ))}
    </section>
  );
}
