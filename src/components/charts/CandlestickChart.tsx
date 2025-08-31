import React from 'react';
import Plot from 'react-plotly.js';
import { StockData } from '../../services/excel.service';

interface CandlestickChartProps {
  data: StockData[];
  height?: number;
  showRangeSlider?: boolean;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  data,
  height = 500,
  showRangeSlider = true,
}) => {
  const trace = {
    x: data.map(d => d.date),
    close: data.map(d => d.close),
    decreasing: { line: { color: '#ef4444' } },
    high: data.map(d => d.high),
    increasing: { line: { color: '#10b981' } },
    line: { color: 'rgba(31,119,180,1)' },
    low: data.map(d => d.low),
    open: data.map(d => d.open),
    type: 'candlestick' as const,
    xaxis: 'x',
    yaxis: 'y',
  };

  const layout: any = {
    autosize: true,
    height: height,
    title: {
      text: 'Stock Price Candlestick Chart'
    },
    xaxis: {
      autorange: true,
      rangeslider: { visible: showRangeSlider },
      title: 'Date',
      type: 'date',
    },
    yaxis: {
      autorange: true,
      title: 'Price ($)',
      type: 'linear',
    },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: {
      color: '#6b7280'
    },
    margin: {
      l: 60,
      r: 40,
      t: 60,
      b: 40
    },
  };

  const config: any = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d'],
  };

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
      <Plot
        data={[trace]}
        layout={layout}
        config={config}
        className="w-full"
        useResizeHandler={true}
      />
    </div>
  );
};