import type { WalletBalance } from '../types';
import { capitalizeExchange, exchangeDotClass, formatBtc, formatUsd } from '../utils/format';
import { SectionHeader } from './ui/SectionHeader';

interface WalletsTableProps {
  wallets: WalletBalance[];
  title: string;
  subtitle: string;
}

export function WalletsTable({ wallets, title, subtitle }: WalletsTableProps) {
  return (
    <section className="panel h-full">
      <SectionHeader title={title} subtitle={subtitle} />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Exchange</th>
              <th>Fiat</th>
              <th>BTC</th>
              <th>Total USD</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((wallet) => (
              <tr key={wallet.exchange}>
                <td>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${exchangeDotClass(wallet.exchange)}`} />
                    <span className="font-medium text-white">{capitalizeExchange(wallet.exchange)}</span>
                  </div>
                </td>
                <td className="mono text-sm text-gray-300">
                  {formatUsd(wallet.fiat).replace('$', '')}{' '}
                  <span className="text-gray-600">{wallet.fiatCurrency}</span>
                </td>
                <td className="mono text-sm text-gray-300">{formatBtc(wallet.btc)}</td>
                <td className="mono text-sm font-semibold metric-up">
                  {formatUsd(wallet.estimatedTotalUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
