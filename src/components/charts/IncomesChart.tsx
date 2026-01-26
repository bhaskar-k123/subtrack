import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';

interface IncomesChartProps {
    data: { month: string; salary?: number; rental?: number; dividends?: number; total?: number }[];
    height?: number;
}

export function IncomesChart({ data, height = 250 }: IncomesChartProps) {
    // If data has salary/rental/dividends, use stacked bars
    const hasBreakdown = data.some(d => d.salary !== undefined || d.rental !== undefined);

    return (
        <ResponsiveContainer width="100%" height={height}>
            <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                barCategoryGap="20%"
            >
                <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                />
                <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(value) => `₹${value / 1000}K`}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => [`₹${value.toLocaleString()}`, '']}
                />
                {hasBreakdown ? (
                    <>
                        <Bar
                            dataKey="salary"
                            stackId="a"
                            fill="hsl(48 96% 53%)"
                            radius={[0, 0, 0, 0]}
                            name="Salary"
                        />
                        <Bar
                            dataKey="rental"
                            stackId="a"
                            fill="hsl(0 72% 51%)"
                            radius={[0, 0, 0, 0]}
                            name="Rental"
                        />
                        <Bar
                            dataKey="dividends"
                            stackId="a"
                            fill="hsl(38 92% 50%)"
                            radius={[4, 4, 0, 0]}
                            name="Dividends"
                        />
                    </>
                ) : (
                    <Bar
                        dataKey="total"
                        fill="hsl(48 96% 53%)"
                        radius={[4, 4, 0, 0]}
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={index === data.length - 1 ? 'hsl(48 96% 53%)' : 'hsl(48 96% 53% / 0.7)'}
                            />
                        ))}
                    </Bar>
                )}
            </BarChart>
        </ResponsiveContainer>
    );
}

// Legend component for the chart
export function IncomesChartLegend() {
    const items = [
        { label: 'Salary', color: 'hsl(48 96% 53%)' },
        { label: 'Rental', color: 'hsl(0 72% 51%)' },
        { label: 'Dividends', color: 'hsl(38 92% 50%)' },
    ];

    return (
        <div className="flex items-center justify-center gap-6 mt-4">
            {items.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                    <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
            ))}
        </div>
    );
}
