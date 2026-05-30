import type { ArbitrageOpportunity, MarketInsight, NormalizedOrderBook } from '../types/index.js';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildMarketInsight(params: {
  opportunities: ArbitrageOpportunity[];
  orderBooks: NormalizedOrderBook[];
  demoMode: boolean;
}): MarketInsight {
  const { opportunities, orderBooks, demoMode } = params;
  const online = orderBooks.filter((book) => book.status === 'online');
  const avgLatency =
    online.length > 0
      ? online.reduce((sum, book) => sum + book.latencyMs, 0) / online.length
      : 0;

  const actionable = opportunities.filter((o) => o.reality?.verdict === 'actionable_prefunded');
  const blocked = opportunities.filter((o) => o.reality?.verdict === 'blocked_by_costs');
  const deadTransfer = opportunities.filter((o) => o.reality?.verdict === 'dead_on_transfer');

  const bestGross = opportunities.reduce(
    (max, opp) => Math.max(max, opp.grossSpreadUsd * opp.maxExecutableBtc),
    0,
  );
  const avgFeeDrag =
    opportunities.length > 0
      ? opportunities.reduce((sum, opp) => sum + opp.buyFee + opp.sellFee, 0) / opportunities.length
      : 0;

  let regime: MarketInsight['regime'] = 'efficient';
  let regimeLabel = 'Mercado eficiente';
  let headline = 'Los spreads no cubren el costo real de operar';
  let narrative =
    'Bitcoin está muy alineado entre venues. Las divergencias que ves suelen ser ruido: comisiones round-trip (~0.2–1.2%) superan el spread bruto de centavos o pocos dólares.';
  let recommendation =
    'Para la demo del reto, activa modo demo y explica que en vivo el valor está en detectar por qué NO operar — no en forzar trades.';

  if (demoMode && actionable.length > 0) {
    regime = 'fragmented_demo';
    regimeLabel = 'Fragmentación demo';
    headline = `${actionable.length} rutas viables con capital prefondeado (offsets demo)`;
    narrative =
      'Los offsets artificiales simulan un mercado fragmentado. Úsalo para mostrar el flujo completo de ejecución; contrasta con modo live donde casi todo queda bloqueado por costos.';
    recommendation = 'Presenta side-by-side: live = honestidad, demo = flujo del motor.';
  } else if (actionable.length > 0) {
    regime = 'fragmented';
    regimeLabel = 'Ventana abierta';
    headline = `${actionable.length} oportunidad(es) accionable(s) con wallets listas`;
    narrative =
      'Hay divergencia real que sobrevive fees y slippage. Aun así, solo funciona si ya tienes fiat en el exchange de compra y BTC en el de venta.';
    recommendation = 'Verifica balances prefondeados antes de simular ejecución.';
  } else if (deadTransfer.length > 0 && opportunities.some((o) => o.netProfitUsd > 0)) {
    regime = 'efficient';
    regimeLabel = 'Ilusión de arbitraje';
    headline = 'Hay edge en papel que muere al transferir BTC';
    narrative = `${deadTransfer.length} ruta(s) con neto positivo teórico, pero el retiro on-chain (~20–40 min) destruye la ventana de ${Math.round(avgLatency * 2)}ms de latencia de datos.`;
    recommendation =
      'Este es el insight que diferencia un bot naive de uno que entiende settlement.';
  }

  const efficiencyScore = Math.min(
    100,
    Math.max(
      10,
      Math.round(
        85 -
          actionable.length * 15 +
          blocked.length * 3 +
          (demoMode ? -25 : 0) +
          (bestGross > 0 && bestGross < avgFeeDrag ? 10 : 0),
      ),
    ),
  );

  return {
    regime,
    regimeLabel,
    headline,
    narrative,
    recommendation,
    efficiencyScore,
    bestGrossSpreadUsd: round2(bestGross),
    avgFeeDragUsd: round2(avgFeeDrag),
    actionableCount: actionable.length,
    blockedByCostsCount: blocked.length,
    deadOnTransferCount: deadTransfer.length,
    avgDataLatencyMs: Math.round(avgLatency),
    exchangesOnline: online.length,
  };
}
