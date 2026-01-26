import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { formatCurrency } from '@/lib/utils/formatting';

interface CategoryDonutChartProps {
  data: { name: string; value: number; color: string }[];
}

// Updated colors to match the reference - yellow, red, gray scheme
const COLORS = ['#FACC15', '#EF4444', '#6B7280', '#8B5CF6', '#10B981'];

export function CategoryDonutChart({ data }: CategoryDonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="h-52 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            }}
            formatter={(value: number, name: string) => [
              formatCurrency(value),
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-2xl font-bold font-mono">{formatCurrency(total)}</p>
        <p className="text-xs text-muted-foreground">Total</p>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 flex-wrap">
        {data.slice(0, 3).map((item, index) => (
          <div key={item.name} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-xs text-muted-foreground">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
