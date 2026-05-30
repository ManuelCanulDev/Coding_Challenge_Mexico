import { useMemo, useState } from 'react';
import { DecisionBar } from './components/DecisionBar';
import { Header } from './components/Header';
import { MarketOverview } from './components/MarketOverview';
import { OpportunityLog } from './components/OpportunityLog';
import { OpportunitiesTable } from './components/OpportunitiesTable';
import { PerformanceCards } from './components/PerformanceCards';
import { PnlChart } from './components/PnlChart';
import { SettingsDrawer } from './components/SettingsDrawer';
import { TopOpportunity } from './components/TopOpportunity';
import { TradesTable } from './components/TradesTable';
import { WalletsTable } from './components/WalletsTable';
import { useWebSocketState } from './hooks/useWebSocket';
import { getUiCopy } from './utils/copy';

export default function App() {
  const { state, wsStatus, applySettingsSave } = useWebSocketState();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const copy = useMemo(() => getUiCopy(state.settings.demoMode), [state.settings.demoMode]);
  const topOpportunity = state.opportunities[0] ?? null;

  return (
    <div className="app-shell">
      <div className="app-bg" />
      <div className="app-grid pointer-events-none fixed inset-0 -z-10 opacity-60" />

      <SettingsDrawer
        open={settingsOpen}
        settings={state.settings}
        onClose={() => setSettingsOpen(false)}
        onSaved={applySettingsSave}
      />

      <div className="relative mx-auto max-w-[1680px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <Header state={state} wsStatus={wsStatus} onOpenSettings={() => setSettingsOpen(true)} />

        <DecisionBar state={state} />

        <PerformanceCards performance={state.performance} />

        <div className="mb-6 grid gap-4 lg:grid-cols-2 lg:gap-6">
          <TopOpportunity opportunity={topOpportunity} />
          <MarketOverview orderBooks={state.orderBooks} />
        </div>

        <OpportunitiesTable opportunities={state.opportunities} />

        <OpportunityLog entries={state.opportunityLog ?? []} />

        <div className="mb-6 grid gap-4 lg:grid-cols-5 lg:gap-6">
          <div className="lg:col-span-3">
            <PnlChart data={state.pnlHistory} subtitle="" />
          </div>
          <div className="lg:col-span-2">
            <TradesTable
              trades={state.trades}
              title="Trades"
              subtitle=""
              emptyLabel={copy.tradesEmpty}
            />
          </div>
        </div>

        <WalletsTable wallets={state.wallets} title="Wallets" subtitle="" />
      </div>
    </div>
  );
}
