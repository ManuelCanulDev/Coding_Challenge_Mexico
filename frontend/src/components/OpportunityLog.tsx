import type { OpportunityLogEntry } from '../types';
import { usePreserveScroll } from '../hooks/usePreserveScroll';
import {
  capitalizeExchange,
  formatStatusLabel,
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
  const mobileScroll = usePreserveScroll(visible);
  const desktopScroll = usePreserveScroll(visible);

  return (
    <section className="panel mb-6 overflow-hidden">
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
          <div
            ref={mobileScroll.ref}
            onScroll={mobileScroll.onScroll}
            className="max-h-[320px] space-y-2 overflow-y-auto overscroll-contain p-4 lg:hidden"
            style={{ overflowAnchor: 'none' }}
          >
            {visible.map((entry) => (
              <LogCard key={entry.id} entry={entry} />
            ))}
          </div>

          <div
            ref={desktopScroll.ref}
            onScroll={desktopScroll.onScroll}
            className="table-wrap hidden max-h-[360px] overflow-y-auto overscroll-contain lg:block"
            style={{ overflowAnchor: 'none' }}
          >
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
                    <td className="mono whitespace-nowrap text-xs text-gray-500">
                      {formatTime(entry.scanAt)}
                    </td>
                    <td className="max-w-[140px] truncate text-sm text-white">
                      {capitalizeExchange(entry.buyExchange)} → {capitalizeExchange(entry.sellExchange)}
                    </td>
                    <td className={`mono whitespace-nowrap text-xs font-semibold ${profitClass(entry.netProfitUsd)}`}>
                      {formatUsd(entry.netProfitUsd)}
                    </td>
                    <td className={`mono whitespace-nowrap text-xs ${profitClass(entry.netTransferUsd)}`}>
                      {formatUsd(entry.netTransferUsd)}
                    </td>
                    <td className="max-w-[120px] truncate text-xs text-gray-400">{entry.verdictLabel}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(entry.status)}`}>
                        {formatStatusLabel(entry.status)}
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

function LogCard({ entry }: { entry: OpportunityLogEntry }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-surface-800/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-white">
          {capitalizeExchange(entry.buyExchange)} → {capitalizeExchange(entry.sellExchange)}
        </p>
        <span className="mono shrink-0 text-[10px] text-gray-500">{formatTime(entry.scanAt)}</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500">Paper</p>
          <p className={`mono truncate text-xs ${profitClass(entry.netProfitUsd)}`}>
            {formatUsd(entry.netProfitUsd)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500">Transfer</p>
          <p className={`mono truncate text-xs ${profitClass(entry.netTransferUsd)}`}>
            {formatUsd(entry.netTransferUsd)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-gray-500">Estado</p>
          <p className="truncate text-[10px] font-medium text-gray-300">
            {formatStatusLabel(entry.status)}
          </p>
        </div>
      </div>
    </div>
  );
}
