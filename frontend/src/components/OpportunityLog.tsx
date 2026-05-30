import type { OpportunityLogEntry } from '../types';
import {
  capitalizeExchange,
  formatTime,
  formatUsd,
  profitClass,
  statusBadgeClass,
} from '../utils/format';
import { SectionHeader } from './ui/SectionHeader';

interface OpportunityLogProps {
  entries: OpportunityLogEntry[];
}

export function OpportunityLog({ entries }: OpportunityLogProps) {
  const visible = entries.slice(0, 80);

  return (
    <section className="panel mb-6">
      <SectionHeader
        title="Log de detecciones"
        action={
          <span className="badge border-white/10 bg-white/5 text-gray-400">
            {entries.length} eventos
          </span>
        }
      />

      {visible.length === 0 ? (
        <div className="empty-state py-10">
          <p className="text-sm text-gray-500">Sin detecciones registradas</p>
        </div>
      ) : (
        <>
          <div className="space-y-2 p-4 lg:hidden">
            {visible.slice(0, 20).map((entry) => (
              <LogCard key={entry.id} entry={entry} />
            ))}
          </div>

          <div className="table-wrap hidden max-h-[360px] overflow-y-auto lg:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Ruta</th>
                  <th>Neto paper</th>
                  <th>Neto transfer</th>
                  <th>Veredicto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => (
                  <tr key={entry.id}>
                    <td className="mono text-xs text-gray-500">{formatTime(entry.scanAt)}</td>
                    <td className="text-sm text-white">
                      {capitalizeExchange(entry.buyExchange)} → {capitalizeExchange(entry.sellExchange)}
                    </td>
                    <td className={`mono text-xs font-semibold ${profitClass(entry.netProfitUsd)}`}>
                      {formatUsd(entry.netProfitUsd)}
                    </td>
                    <td className={`mono text-xs ${profitClass(entry.netTransferUsd)}`}>
                      {formatUsd(entry.netTransferUsd)}
                    </td>
                    <td className="text-xs text-gray-400">{entry.verdictLabel}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(entry.status)}`}>{entry.status}</span>
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

function LogCard({ entry }: { entry: OpportunityLogEntry }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-surface-800/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">
          {capitalizeExchange(entry.buyExchange)} → {capitalizeExchange(entry.sellExchange)}
        </p>
        <span className="mono text-[10px] text-gray-500">{formatTime(entry.scanAt)}</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-gray-500">Paper</p>
          <p className={`mono text-xs ${profitClass(entry.netProfitUsd)}`}>
            {formatUsd(entry.netProfitUsd)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500">Transfer</p>
          <p className={`mono text-xs ${profitClass(entry.netTransferUsd)}`}>
            {formatUsd(entry.netTransferUsd)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500">Estado</p>
          <p className="text-[10px] text-gray-300">{entry.status}</p>
        </div>
      </div>
    </div>
  );
}
