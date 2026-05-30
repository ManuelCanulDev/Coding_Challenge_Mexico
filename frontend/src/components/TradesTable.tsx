import type { SimulatedTrade } from '../types';
import {
  capitalizeExchange,
  formatBtc,
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
  return (
    <section className="panel h-full">
      <SectionHeader
        title={title}
        subtitle={subtitle}
        action={
          trades.length > 0 ? (
            <span className="text-xs text-gray-500">{trades.length} registros</span>
          ) : undefined
        }
      />
      <div className="table-wrap max-h-[360px] overflow-y-auto">
        <table className="data-table">
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
            {trades.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state py-10">
                    <p className="text-sm">{emptyLabel}</p>
                  </div>
                </td>
              </tr>
            ) : (
              trades.slice(0, 50).map((trade) => (
                <tr key={trade.id}>
                  <td className="mono text-xs text-gray-500">{formatTime(trade.timestamp)}</td>
                  <td className="text-sm">
                    <span className="text-white">{capitalizeExchange(trade.buyExchange)}</span>
                    <span className="mx-1 text-gray-600">→</span>
                    <span className="text-white">{capitalizeExchange(trade.sellExchange)}</span>
                  </td>
                  <td className="mono text-xs text-gray-400">{formatBtc(trade.volumeBtc)}</td>
                  <td className={`mono text-sm font-semibold ${profitClass(trade.netProfitUsd)}`}>
                    {formatUsd(trade.netProfitUsd)}
                  </td>
                  <td>
                    <span className={`badge ${statusBadgeClass(trade.status)}`} title={trade.reason}>
                      {trade.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
