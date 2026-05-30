import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatTime, formatUsd, profitClass } from '../utils/format';
import { SectionHeader } from './ui/SectionHeader';

interface PnlChartProps {
  data: { timestamp: number; cumulativePnl: number }[];
  subtitle?: string;
}

export function PnlChart({ data, subtitle }: PnlChartProps) {
  const chartData = data.map((point) => ({
    ...point,
    time: formatTime(point.timestamp),
  }));

  const latestPnl = data[data.length - 1]?.cumulativePnl ?? 0;
  const isPositive = latestPnl >= 0;
  const strokeColor = isPositive ? '#22c55e' : '#f87171';
  const gradientId = isPositive ? 'pnlGradientUp' : 'pnlGradientDown';

  return (
    <section className="panel mb-8 overflow-hidden">
      <SectionHeader
        title="P&L acumulado"
        subtitle={subtitle}
        action={
          <span className={`mono block max-w-full truncate text-sm font-bold sm:text-lg ${profitClass(latestPnl)}`}>
            {formatUsd(latestPnl)}
          </span>
        }
      />
      <div className="h-[220px] min-w-0 px-2 pb-4 pt-2 sm:h-[320px] sm:px-6 sm:pb-6">
        {chartData.length <= 1 ? (
          <div className="empty-state h-full">
            <p className="text-sm text-gray-500">Sin trades aún</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGradientUp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pnlGradientDown" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#4b5563"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                minTickGap={32}
              />
              <YAxis
                stroke="#4b5563"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => `$${value.toFixed(0)}`}
                width={44}
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(13, 18, 32, 0.95)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}
                labelStyle={{ color: '#6b7280', fontSize: 11 }}
                itemStyle={{ color: strokeColor, fontFamily: 'JetBrains Mono, monospace' }}
                formatter={(value: number) => [formatUsd(value), 'P&L acumulado']}
              />
              <Area
                type="monotone"
                dataKey="cumulativePnl"
                stroke={strokeColor}
                fill={`url(#${gradientId})`}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: strokeColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
