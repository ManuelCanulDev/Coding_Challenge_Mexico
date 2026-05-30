import type { ArbitrageOpportunity } from '../types';
import {
  capitalizeExchange,
  formatBtc,
  formatPct,
  formatStatusLabel,
  formatUsd,
  profitClass,
  statusBadgeClass,
} from '../utils/format';
import { SectionHeader } from './ui/SectionHeader';

interface OpportunitiesTableProps {
  opportunities: ArbitrageOpportunity[];
}

export function OpportunitiesTable({ opportunities }: OpportunitiesTableProps) {
  const executableCount = opportunities.filter((o) => o.status === 'executable').length;
  const visible = opportunities.slice(0, 15);

  return (
    <section className="panel mb-6 overflow-hidden">
      <SectionHeader
        title="Oportunidades"
        action={
          executableCount > 0 ? (
            <span className="badge border-jade-500/30 bg-jade-500/10 text-jade-300">
              {executableCount} OK
            </span>
          ) : (
            <span className="badge border-white/10 bg-white/5 text-gray-500">0 OK</span>
          )
        }
      />

      {opportunities.length === 0 ? (
        <div className="empty-state py-10">
          <p className="text-sm text-gray-500">Sin oportunidades</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 p-4 lg:hidden">
            {visible.map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} />
            ))}
          </div>

          <div className="table-wrap hidden max-h-[480px] overflow-y-auto lg:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ruta</th>
                  <th>Neto paper</th>
                  <th>Neto transfer</th>
                  <th>%</th>
                  <th>Vol</th>
                  <th>Veredicto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((opp) => (
                  <tr
                    key={opp.id}
                    className={
                      opp.status === 'executable' ? 'border-l-2 border-l-jade-500 bg-jade-500/[0.03]' : ''
                    }
                  >
                    <td className="max-w-[140px] truncate text-sm font-medium text-white">
                      {capitalizeExchange(opp.buyExchange)} → {capitalizeExchange(opp.sellExchange)}
                    </td>
                    <td className={`mono whitespace-nowrap font-semibold ${profitClass(opp.netProfitUsd)}`}>
                      {formatUsd(opp.netProfitUsd)}
                    </td>
                    <td className={`mono whitespace-nowrap text-xs ${profitClass(opp.reality?.serialArbNetUsd ?? 0)}`}>
                      {formatUsd(opp.reality?.serialArbNetUsd ?? 0)}
                    </td>
                    <td className={`mono whitespace-nowrap text-xs ${profitClass(opp.netProfitPct)}`}>
                      {formatPct(opp.netProfitPct)}
                    </td>
                    <td className="mono whitespace-nowrap text-xs text-gray-400">
                      {formatBtc(opp.maxExecutableBtc)}
                    </td>
                    <td className="max-w-[120px] truncate text-xs text-jade-300/90">
                      {opp.reality?.verdictLabel ?? '—'}
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(opp.status)}`}>
                        {formatStatusLabel(opp.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function OpportunityCard({ opp }: { opp: ArbitrageOpportunity }) {
  const isOk = opp.status === 'executable';

  return (
    <div
      className={`min-w-0 rounded-xl border p-3 ${
        isOk ? 'border-jade-500/30 bg-jade-500/[0.04]' : 'border-white/[0.06] bg-surface-800/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-white">
          {capitalizeExchange(opp.buyExchange)} → {capitalizeExchange(opp.sellExchange)}
        </p>
        <span className={`badge shrink-0 ${statusBadgeClass(opp.status)}`}>
          {formatStatusLabel(opp.status)}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500">Paper</p>
          <p className={`mono truncate text-xs font-semibold ${profitClass(opp.netProfitUsd)}`}>
            {formatUsd(opp.netProfitUsd)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500">Transfer</p>
          <p className={`mono truncate text-xs ${profitClass(opp.reality?.serialArbNetUsd ?? 0)}`}>
            {formatUsd(opp.reality?.serialArbNetUsd ?? 0)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500">%</p>
          <p className={`mono truncate text-xs ${profitClass(opp.netProfitPct)}`}>
            {formatPct(opp.netProfitPct)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500">Veredicto</p>
          <p className="truncate text-[10px] font-medium text-gray-300">
            {opp.reality?.verdictLabel ?? '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
