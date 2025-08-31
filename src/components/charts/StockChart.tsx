import React from 'react';
import {
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
} from 'recharts';
import { StockData } from '../../services/excel.service';
import { format } from 'date-fns';

interface StockChartProps {
  data: StockData[];
  indicators?: {
    sma20?: number[];
    sma50?: number[];
    buySignals?: { date: string; price: number }[];
    sellSignals?: { date: string; price: number }[];
  };
  height?: number;
  showVolume?: boolean;
}

export const StockChart: React.FC<StockChartProps> = ({
  data,
  indicators,
  height = 400,
  showVolume = true,
}) => {
  const chartData = data.map((d, index) => ({
    ...d,
    date: format(new Date(d.date), 'MMM dd'),
    sma20: indicators?.sma20?.[index],
    sma50: indicators?.sma50?.[index],
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="font-semibold text-sm mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: ${entry.value?.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full space-y-4">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
          />
          <YAxis 
            domain={['dataMin - 5', 'dataMax + 5']}
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-400"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          <Area
            type="monotone"
            dataKey="close"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorClose)"
            name="Close Price"
            strokeWidth={2}
          />
          
          {indicators?.sma20 && (
            <Line
              type="monotone"
              dataKey="sma20"
              stroke="#10b981"
              name="SMA 20"
              dot={false}
              strokeWidth={1.5}
            />
          )}
          
          {indicators?.sma50 && (
            <Line
              type="monotone"
              dataKey="sma50"
              stroke="#f59e0b"
              name="SMA 50"
              dot={false}
              strokeWidth={1.5}
            />
          )}
          
          {indicators?.buySignals?.map((signal, index) => (
            <ReferenceLine
              key={`buy-${index}`}
              x={format(new Date(signal.date), 'MMM dd')}
              stroke="#10b981"
              strokeWidth={2}
              label={{ value: "BUY", position: "top" }}
            />
          ))}
          
          {indicators?.sellSignals?.map((signal, index) => (
            <ReferenceLine
              key={`sell-${index}`}
              x={format(new Date(signal.date), 'MMM dd')}
              stroke="#ef4444"
              strokeWidth={2}
              label={{ value: "SELL", position: "bottom" }}
            />
          ))}
          
          <Brush dataKey="date" height={30} stroke="#3b82f6" />
        </AreaChart>
      </ResponsiveContainer>

      {showVolume && (
        <ResponsiveContainer width="100%" height={100}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" hide />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="volume"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.3}
              name="Volume"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};