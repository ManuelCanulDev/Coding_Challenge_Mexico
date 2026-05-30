import type { ArbitrageOpportunity } from '../types';
import { capitalizeExchange, formatUsd, profitClass } from '../utils/format';

interface TopOpportunityProps {
  opportunity: ArbitrageOpportunity | null;
}

const verdictStyles = {
  actionable_prefunded: 'border-jade-500/40 bg-jade-500/10 text-jade-300',
  theoretical_edge: 'border-accent-gold/40 bg-accent-gold/10 text-accent-gold',
  blocked_by_costs: 'border-white/15 bg-white/5 text-gray-400',
  dead_on_transfer: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
};

const shortLabels: Record<string, string> = {
  'Spread bruto (top of book)': 'Spread',
  'Comisión compra': 'Fee compra',
  'Comisión venta': 'Fee venta',
  'Slippage (profundidad del book)': 'Slippage',
  'Penalización por latencia': 'Latencia',
  'Neto paper (wallets prefondeadas)': 'Neto paper',
  'Retiro + red BTC (arbitraje serial)': 'Transfer',
  'Neto si debes transferir entre venues': 'Neto transfer',
  'Neto operativo': 'Neto',
};

export function TopOpportunity({ opportunity }: TopOpportunityProps) {
  if (!opportunity?.reality) {
    return (
      <section className="panel flex min-h-[280px] items-center justify-center p-6 sm:min-h-[320px]">
        <p className="text-sm text-gray-500">Sin ruta líder</p>
      </section>
    );
  }

  const { reality } = opportunity;
  const route = `${capitalizeExchange(opportunity.buyExchange)} → ${capitalizeExchange(opportunity.sellExchange)}`;
  const drag = opportunity.buyFee + opportunity.sellFee + opportunity.slippageEstimate + opportunity.latencyPenalty;

  return (
    <section className="panel flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Mejor ruta</p>
          <p className="truncate text-base font-semibold text-white">{route}</p>
        </div>
        <span className={`badge shrink-0 ${verdictStyles[reality.verdict]}`}>
          {reality.verdictLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 sm:gap-3 sm:p-5">
        <Metric label="Neto paper" value={reality.prefundedNetUsd} />
        <Metric label="Neto transfer" value={reality.serialArbNetUsd} />
        <Metric label="Costos" value={-drag} />
        <Metric label="Score" value={opportunity.score} plain />
      </div>

      <div className="flex-1 space-y-1.5 border-t border-white/[0.06] px-4 py-3 sm:px-5">
        {reality.costBreakdown.slice(0, 6).map((line) => (
          <div key={line.label} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-gray-500">{shortLabels[line.label] ?? line.label}</span>
            <span className={`mono shrink-0 font-medium ${profitClass(line.amountUsd)}`}>
              {line.amountUsd >= 0 ? '+' : ''}
              {formatUsd(line.amountUsd)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  plain = false,
}: {
  label: string;
  value: number;
  plain?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-surface-800/40 px-3 py-2">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className={`mono mt-0.5 text-sm font-bold ${plain ? 'text-white' : profitClass(value)}`}>
        {plain ? value : formatUsd(value)}
      </p>
    </div>
  );
}
