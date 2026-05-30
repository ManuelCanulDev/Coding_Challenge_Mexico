import type { NormalizedOrderBook } from '../types';
import {
  capitalizeExchange,
  exchangeAccent,
  formatUsd,
  statusBadgeClass,
} from '../utils/format';
import { SectionHeader } from './ui/SectionHeader';

interface MarketOverviewProps {
  orderBooks: NormalizedOrderBook[];
}

export function MarketOverview({ orderBooks }: MarketOverviewProps) {
  return (
    <section className="panel mb-6 h-full">
      <SectionHeader title="Mercado" />
      <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-2 lg:gap-4 lg:p-5">
        {orderBooks.length === 0 ? (
          <div className="empty-state col-span-full py-8">
            <p className="text-sm text-gray-500">Conectando…</p>
          </div>
        ) : (
          orderBooks.map((book) => (
            <div
              key={book.exchange}
              className={`exchange-card border-l-[3px] p-3 lg:p-4 ${exchangeAccent(book.exchange)}`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{capitalizeExchange(book.exchange)}</h3>
                <span className={`badge ${statusBadgeClass(book.status)}`}>{book.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-accent-green/20 bg-accent-green/5 px-2 py-1.5">
                  <p className="text-[9px] uppercase text-gray-500">Bid</p>
                  <p className="mono text-xs font-semibold metric-up">{formatUsd(book.bid)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5">
                  <p className="text-[9px] uppercase text-gray-500">Ask</p>
                  <p className="mono text-xs font-semibold text-gray-200">{formatUsd(book.ask)}</p>
                </div>
              </div>
              <p className="mono mt-2 text-[10px] text-gray-500">{book.latencyMs} ms</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
