'use client';

import type { ApexOptions } from 'apexcharts';
import Chart from '@/components/ui/charts/Chart';

interface BarChartProps {
  categories: string[];
  series: { name: string; data: number[] }[];
  colors?: string[];
  height?: number;
  stacked?: boolean;
  valuePrefix?: string;
}

// The template's RevenueUpdate column chart.
export default function BarChart({
  categories,
  series,
  colors = ['var(--color-primary)', 'var(--color-secondary)'],
  height = 300,
  stacked = false,
  valuePrefix = '',
}: BarChartProps) {
  const options: ApexOptions = {
    chart: { type: 'bar', fontFamily: 'inherit', foreColor: '#7C8FAC', toolbar: { show: false }, stacked },
    colors,
    plotOptions: {
      bar: { horizontal: false, columnWidth: '35%', borderRadius: 6, borderRadiusApplication: 'end', borderRadiusWhenStacked: 'all' },
    },
    dataLabels: { enabled: false },
    legend: { show: series.length > 1, position: 'top', horizontalAlign: 'right' },
    grid: { borderColor: 'rgba(0,0,0,0.1)', strokeDashArray: 3 },
    xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: {
      labels: {
        formatter: (val: number) => (Math.abs(val) >= 1000 ? `${valuePrefix}${(val / 1000).toFixed(1)}k` : `${valuePrefix}${Math.round(val)}`),
      },
    },
    tooltip: { theme: 'dark', y: { formatter: (val: number) => `${valuePrefix}${val.toLocaleString()}` } },
  };
  return <Chart options={options} series={series} type="bar" height={height} width="100%" />;
}
