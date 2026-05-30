import type { SimulatedTrade } from '../types';
import { usePreserveScroll } from '../hooks/usePreserveScroll';
import {
  capitalizeExchange,
  formatBtc,
  formatStatusLabel,
  formatTime,
  formatUsd,
  profitClass,
  statusBadgeClass,
} from '../utils/format';
import { SectionHeader } from './ui/SectionHeader';

interface TradesTableProps {
  trades: SimulatedTrade[];
  title: string;
  subtitle: string;
  emptyLabel: string;
}

export function TradesTable({ trades, title, subtitle, emptyLabel }: TradesTableProps) {
  const visible = trades.slice(0, 50);
  const mobileScroll = usePreserveScroll(visible);
  const desktopScroll = usePreserveScroll(visible);

  return (
    <section className="panel h-full overflow-hidden">
      <SectionHeader
        title={title}
        subtitle={subtitle}
        action={
          trades.length > 0 ? (
            <span className="text-xs text-gray-500">{trades.length} registros</span>
          ) : undefined
        }
      />

      {trades.length === 0 ? (
        <div className="empty-state py-10">
          <p className="text-sm">{emptyLabel}</p>
        </div>
      ) : (
        <>
          <div
            ref={mobileScroll.ref}
            onScroll={mobileScroll.onScroll}
            className="max-h-[360px] space-y-2 overflow-y-auto overscroll-contain p-4 lg:hidden"
          >
            {visible.map((trade) => (
              <TradeCard key={trade.id} trade={trade} />
            ))}
          </div>

          <div
            ref={desktopScroll.ref}
            onScroll={desktopScroll.onScroll}
            className="table-wrap hidden max-h-[360px] overflow-y-auto overscroll-contain lg:block"
          >
            <table className="data-table data-table-compact">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Ruta</th>
                  <th>Volumen</th>
                  <th>P&L neto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((trade) => (
                  <tr key={trade.id}>
                    <td className="mono whitespace-nowrap text-xs text-gray-500">
                      {formatTime(trade.timestamp)}
                    </td>
                    <td className="max-w-[120px] truncate text-sm">
                      <span className="text-white">{capitalizeExchange(trade.buyExchange)}</span>
                      <span className="mx-1 text-gray-600">→</span>
                      <span className="text-white">{capitalizeExchange(trade.sellExchange)}</span>
                    </td>
                    <td className="mono whitespace-nowrap text-xs text-gray-400">
                      {formatBtc(trade.volumeBtc)}
                    </td>
                    <td className={`mono whitespace-nowrap text-sm font-semibold ${profitClass(trade.netProfitUsd)}`}>
                      {formatUsd(trade.netProfitUsd)}
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(trade.status)}`} title={trade.reason}>
                        {formatStatusLabel(trade.status)}
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

function TradeCard({ trade }: { trade: SimulatedTrade }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-surface-800/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-sm text-white">
          {capitalizeExchange(trade.buyExchange)} → {capitalizeExchange(trade.sellExchange)}
        </p>
        <span className={`badge shrink-0 ${statusBadgeClass(trade.status)}`} title={trade.reason}>
          {formatStatusLabel(trade.status)}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="mono text-gray-500">{formatTime(trade.timestamp)}</span>
        <span className="mono text-gray-400">{formatBtc(trade.volumeBtc)}</span>
        <span className={`mono font-semibold ${profitClass(trade.netProfitUsd)}`}>
          {formatUsd(trade.netProfitUsd)}
        </span>
      </div>
    </div>
  );
}
