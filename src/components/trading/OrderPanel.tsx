import React, { useState } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Send } from 'lucide-react';
import { TradeSignal } from '../../services/ib-api.service';

interface OrderPanelProps {
  onPlaceOrder: (order: TradeSignal) => Promise<void>;
  accountBalance: number;
  currentPrice?: number;
  symbol: string;
}

export const OrderPanel: React.FC<OrderPanelProps> = ({
  onPlaceOrder,
  accountBalance,
  currentPrice = 0,
  symbol,
}) => {
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState(1);
  const [orderPrice, setOrderPrice] = useState(currentPrice);
  const [useMarketOrder, setUseMarketOrder] = useState(false);
  const [stopLoss, setStopLoss] = useState<number | undefined>();
  const [takeProfit, setTakeProfit] = useState<number | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculateOrderValue = () => {
    const price = useMarketOrder ? currentPrice : orderPrice;
    return (price * quantity).toFixed(2);
  };

  const calculateRisk = () => {
    const orderValue = parseFloat(calculateOrderValue());
    return ((orderValue / accountBalance) * 100).toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const order: TradeSignal = {
        action: orderType,
        symbol,
        quantity,
        price: useMarketOrder ? undefined : orderPrice,
        stopLoss,
        takeProfit,
        confidence: 0,
      };

      await onPlaceOrder(order);
    } catch (error) {
      console.error('Order failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
        Place Order - {symbol}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOrderType('BUY')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${
              orderType === 'BUY'
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            <TrendingUp size={18} />
            Buy
          </button>
          <button
            type="button"
            onClick={() => setOrderType('SELL')}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${
              orderType === 'SELL'
                ? 'bg-red-500 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            <TrendingDown size={18} />
            Sell
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Quantity
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            min="1"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <div className="flex items-center mb-2">
            <input
              type="checkbox"
              id="marketOrder"
              checked={useMarketOrder}
              onChange={(e) => setUseMarketOrder(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="marketOrder" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Market Order
            </label>
          </div>
          
          {!useMarketOrder && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Limit Price
              </label>
              <input
                type="number"
                value={orderPrice}
                onChange={(e) => setOrderPrice(parseFloat(e.target.value) || 0)}
                step="0.01"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stop Loss (Optional)
            </label>
            <input
              type="number"
              value={stopLoss || ''}
              onChange={(e) => setStopLoss(e.target.value ? parseFloat(e.target.value) : undefined)}
              step="0.01"
              min="0"
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Take Profit (Optional)
            </label>
            <input
              type="number"
              value={takeProfit || ''}
              onChange={(e) => setTakeProfit(e.target.value ? parseFloat(e.target.value) : undefined)}
              step="0.01"
              min="0"
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Order Value:</span>
            <span className="font-medium text-gray-900 dark:text-white">${calculateOrderValue()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Account Balance:</span>
            <span className="font-medium text-gray-900 dark:text-white">${accountBalance.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Position Size:</span>
            <span className="font-medium text-gray-900 dark:text-white">{calculateRisk()}%</span>
          </div>
        </div>

        {parseFloat(calculateRisk()) > 5 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <AlertCircle className="text-yellow-600 dark:text-yellow-400" size={20} />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Warning: Position size exceeds 5% of account balance
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || quantity <= 0}
          className={`w-full py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${
            isSubmitting || quantity <= 0
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : orderType === 'BUY'
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
        >
          <Send size={18} />
          {isSubmitting ? 'Placing Order...' : `Place ${orderType} Order`}
        </button>
      </form>
    </div>
  );
};