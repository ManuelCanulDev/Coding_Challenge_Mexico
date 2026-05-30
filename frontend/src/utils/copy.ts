export interface UiCopy {
  pnlLabel: string;
  performanceSubtitle: string;
  pnlChartSubtitle: string;
  tradesTitle: string;
  tradesSubtitle: string;
  tradesEmpty: string;
  walletsTitle: string;
  walletsSubtitle: string;
  executionMode: string;
  dataMode: string;
  statusBar: string;
  footer: string;
}

export function getUiCopy(demoMode: boolean): UiCopy {
  if (!demoMode) {
    return {
      pnlLabel: 'P&L acumulado',
      performanceSubtitle: 'Métricas en tiempo real',
      pnlChartSubtitle: 'Curva de ganancias y pérdidas en vivo',
      tradesTitle: 'Historial de trades',
      tradesSubtitle: 'Ejecuciones del motor de arbitraje',
      tradesEmpty: 'Sin trades registrados',
      walletsTitle: 'Wallets',
      walletsSubtitle: 'Balances por exchange',
      executionMode: 'Paper trading interno',
      dataMode: 'Order books públicos (CCXT)',
      statusBar: 'Datos de mercado en vivo · Sin API keys privadas',
      footer: 'Balam Xchange · Motor de arbitraje BTC en tiempo real',
    };
  }

  return {
    pnlLabel: 'P&L acumulado',
    performanceSubtitle: 'Métricas del motor en tiempo real',
    pnlChartSubtitle: 'Curva de P&L acumulado',
    tradesTitle: 'Historial de trades',
    tradesSubtitle: 'Ejecuciones del motor',
    tradesEmpty: 'Sin trades registrados',
    walletsTitle: 'Wallets',
    walletsSubtitle: 'Balances por exchange',
    executionMode: 'Paper trading · Modo demo',
    dataMode: 'Mercado público + offsets demo',
    statusBar: 'Modo demo activo · Offsets de spread habilitados',
    footer: 'Balam Xchange · Modo demo · Datos CCXT con offsets',
  };
}
