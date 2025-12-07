'use client';

import {
  Bar,
  BarChart as RechartsBarChart,
  XAxis,
  YAxis,
} from 'recharts';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

type RevenueChartProps = {
  data: {
    name: string;
    revenue: number;
  }[];
};

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ChartContainer
      className="h-[350px]"
      config={{
        revenue: { label: 'Revenue', color: 'hsl(var(--accent))' },
      }}
    >
      <RechartsBarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <XAxis
          dataKey="name"
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => value.slice(0,15) + (value.length > 15 ? '...' : '')}
        />
        <YAxis
          stroke="#888888"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
      </RechartsBarChart>
    </ChartContainer>
  );
}
