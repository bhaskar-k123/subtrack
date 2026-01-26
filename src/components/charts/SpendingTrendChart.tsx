import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { formatCurrency } from '@/lib/utils/formatting';

interface SpendingTrendChartProps {
  data: { month: string; amount: number }[];
}

export function SpendingTrendChart({ data }: SpendingTrendChartProps) {
  // Find the max value for highlighting
  const maxAmount = Math.max(...data.map(d => d.amount));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
            horizontal={true}
          />
          <XAxis
            dataKey="month"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dy={8}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
            dx={-5}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
              padding: '12px 16px',
            }}
            labelStyle={{
              color: 'hsl(var(--foreground))',
              fontWeight: 600,
              marginBottom: '4px',
            }}
            itemStyle={{
              color: 'hsl(var(--muted-foreground))',
            }}
            formatter={(value: number) => [formatCurrency(value), 'Spent']}
            cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
          />
          <Bar
            dataKey="amount"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.amount === maxAmount
                  ? 'hsl(51 100% 50%)'
                  : 'hsl(51 100% 50% / 0.4)'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
