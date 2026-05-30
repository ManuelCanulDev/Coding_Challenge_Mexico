import type { ArbitrageOpportunity, ExchangeId } from '../types/index.js';

export type RealityVerdict =
  | 'actionable_prefunded'
  | 'theoretical_edge'
  | 'blocked_by_costs'
  | 'dead_on_transfer';

export interface CostBreakdownLine {
  label: string;
  amountUsd: number;
  kind: 'gain' | 'cost' | 'subtotal' | 'total';
}

export interface RealityCheck {
  verdict: RealityVerdict;
  verdictLabel: string;
  headline: string;
  explanation: string;
  transferFeeUsd: number;
  transferMinutes: number;
  prefundedNetUsd: number;
  serialArbNetUsd: number;
  costBreakdown: CostBreakdownLine[];
}

/** Retiro BTC estimado (red + comisión exchange) en BTC */
const WITHDRAWAL_FEE_BTC: Record<ExchangeId, number> = {
  binance: 0.0002,
  kraken: 0.00015,
  coinbase: 0.00012,
  okx: 0.0002,
};

/** Minutos típicos: procesamiento exchange + confirmaciones on-chain */
const WITHDRAWAL_PROCESS_MIN: Record<ExchangeId, number> = {
  binance: 15,
  kraken: 25,
  coinbase: 35,
  okx: 18,
};

const NETWORK_CONFIRM_MIN = 22;
const OPPORTUNITY_WINDOW_SEC = 8;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildCostBreakdown(
  opp: Omit<ArbitrageOpportunity, 'reality' | 'id' | 'timestamp' | 'confidenceScore' | 'score' | 'rating'>,
  transferFeeUsd: number,
): CostBreakdownLine[] {
  const grossUsd = opp.grossSpreadUsd * opp.maxExecutableBtc;
  const lines: CostBreakdownLine[] = [
    { label: 'Spread bruto (top of book)', amountUsd: round2(grossUsd), kind: 'gain' },
    { label: 'Comisión compra', amountUsd: round2(-opp.buyFee), kind: 'cost' },
    { label: 'Comisión venta', amountUsd: round2(-opp.sellFee), kind: 'cost' },
    { label: 'Slippage (profundidad del book)', amountUsd: round2(-opp.slippageEstimate), kind: 'cost' },
    { label: 'Penalización por latencia', amountUsd: round2(-opp.latencyPenalty), kind: 'cost' },
    { label: 'Neto paper (wallets prefondeadas)', amountUsd: round2(opp.netProfitUsd), kind: 'subtotal' },
  ];

  if (transferFeeUsd > 0) {
    lines.push({
      label: 'Retiro + red BTC (arbitraje serial)',
      amountUsd: round2(-transferFeeUsd),
      kind: 'cost',
    });
    lines.push({
      label: 'Neto si debes transferir entre venues',
      amountUsd: round2(opp.netProfitUsd - transferFeeUsd),
      kind: 'total',
    });
  } else {
    lines.push({ label: 'Neto operativo', amountUsd: round2(opp.netProfitUsd), kind: 'total' });
  }

  return lines;
}

export function assessOpportunityReality(
  opp: Omit<ArbitrageOpportunity, 'reality' | 'id' | 'timestamp' | 'confidenceScore' | 'score' | 'rating'>,
): RealityCheck {
  const referencePrice = opp.buyAsk || 1;
  const transferFeeUsd = round2(WITHDRAWAL_FEE_BTC[opp.buyExchange] * referencePrice);
  const transferMinutes =
    WITHDRAWAL_PROCESS_MIN[opp.buyExchange] + NETWORK_CONFIRM_MIN + 5;
  const prefundedNetUsd = round2(opp.netProfitUsd);
  const serialArbNetUsd = round2(opp.netProfitUsd - transferFeeUsd);
  const costBreakdown = buildCostBreakdown(opp, transferFeeUsd);

  if (opp.netProfitUsd <= 0) {
    return {
      verdict: 'blocked_by_costs',
      verdictLabel: 'Absorbida por costos',
      headline: 'El spread existe, pero los costos se lo comen',
      explanation: `Spread bruto de ${formatUsdShort(opp.grossSpreadUsd * opp.maxExecutableBtc)} en ${opp.maxExecutableBtc.toFixed(4)} BTC, pero fees (${formatUsdShort(opp.buyFee + opp.sellFee)}), slippage (${formatUsdShort(opp.slippageEstimate)}) y latencia (${formatUsdShort(opp.latencyPenalty)}) dejan el neto en ${formatUsdShort(opp.netProfitUsd)}. En mercados reales esto es lo más habitual.`,
      transferFeeUsd,
      transferMinutes,
      prefundedNetUsd,
      serialArbNetUsd,
      costBreakdown,
    };
  }

  if (opp.status === 'executable' && prefundedNetUsd > 0) {
    return {
      verdict: 'actionable_prefunded',
      verdictLabel: 'Viable prefondeado',
      headline: 'Rentable si ya tienes capital en ambos exchanges',
      explanation: `Con USDT en ${capitalize(opp.buyExchange)} y BTC en ${capitalize(opp.sellExchange)}, el neto estimado es ${formatUsdShort(prefundedNetUsd)}. La ventana de oportunidad dura segundos (~${OPPORTUNITY_WINDOW_SEC}s); mover BTC entre venues tarda ~${transferMinutes} min y costaría ~${formatUsdShort(transferFeeUsd)} extra — por eso el arbitraje serial casi nunca funciona.`,
      transferFeeUsd,
      transferMinutes,
      prefundedNetUsd,
      serialArbNetUsd,
      costBreakdown,
    };
  }

  if (serialArbNetUsd <= 0) {
    return {
      verdict: 'dead_on_transfer',
      verdictLabel: 'Muerta al transferir',
      headline: 'Edge teórico que muere al mover BTC',
      explanation: `Neto paper ${formatUsdShort(prefundedNetUsd)}, pero retirar BTC desde ${capitalize(opp.buyExchange)} (~${formatUsdShort(transferFeeUsd)} + ~${transferMinutes} min) dejaría ${formatUsdShort(serialArbNetUsd)}. El precio se mueve antes de que llegue el BTC al exchange de venta.`,
      transferFeeUsd,
      transferMinutes,
      prefundedNetUsd,
      serialArbNetUsd,
      costBreakdown,
    };
  }

  return {
    verdict: 'theoretical_edge',
    verdictLabel: 'Edge fino',
    headline: 'Margen positivo pero frágil',
    explanation: `Neto ${formatUsdShort(prefundedNetUsd)} (${opp.netProfitPct.toFixed(4)}%) — por encima de cero pero por debajo del umbral operativo o con poco volumen. Un tick adverso o más slippage lo elimina.`,
    transferFeeUsd,
    transferMinutes,
    prefundedNetUsd,
    serialArbNetUsd,
    costBreakdown,
  };
}

function formatUsdShort(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
