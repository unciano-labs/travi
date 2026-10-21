'use client';

import type { ApexOptions } from 'apexcharts';
import Chart from '@/components/ui/charts/Chart';

interface DonutChartProps {
  labels: string[];
  series: number[];
  colors?: string[];
  height?: number;
  width?: number | string;
  valuePrefix?: string;
}

const DEFAULT_COLORS = ['var(--color-primary)', 'var(--color-secondary)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-error)', 'var(--color-info)'];

// The template's YearlyBreakup donut.
export default function DonutChart({ labels, series, colors = DEFAULT_COLORS, height = 160, width = 180, valuePrefix = '' }: DonutChartProps) {
  const options: ApexOptions = {
    labels,
    chart: { type: 'donut', fontFamily: 'inherit', foreColor: '#adb0bb', toolbar: { show: false } },
    plotOptions: { pie: { startAngle: 0, endAngle: 360, donut: { size: '75%' } } },
    stroke: { show: false },
    dataLabels: { enabled: false },
    legend: { show: false },
    colors,
    tooltip: {
      theme: 'dark',
      fillSeriesColor: false,
      y: { formatter: (val: number) => `${valuePrefix}${val.toLocaleString()}` },
    },
  };
  return <Chart options={options} series={series} type="donut" height={height} width={width} />;
}
