import React, { useState, useEffect } from 'react';
// import { open } from '@tauri-apps/plugin-dialog';
import { Toaster, toast } from 'sonner';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { 
  FileSpreadsheet, 
  TrendingUp, 
  Activity, 
  DollarSign,
  BarChart3,
  Upload,
  CheckCircle
} from 'lucide-react';

import { ExcelService, ExcelData, StockData } from './services/excel.service';
import { IBApiService, TradeSignal } from './services/ib-api.service';
import { TradingAlgorithms, TechnicalIndicators } from './services/trading-algorithms';

import { StockChart } from './components/charts/StockChart';
import { CandlestickChart } from './components/charts/CandlestickChart';
import { ExcelGrid } from './components/tables/ExcelGrid';
import { OrderPanel } from './components/trading/OrderPanel';

const queryClient = new QueryClient();

function App() {
  console.log('=== App Component Starting ===');
  console.log('App mounted at:', new Date().toISOString());
  console.log('Window location:', window.location.href);
  console.log('Document ready state:', document.readyState);
  const [excelData, setExcelData] = useState<ExcelData[]>([]);
  const [stockData, setStockData] = useState<StockData[]>([]);
  const [indicators, setIndicators] = useState<TechnicalIndicators>({});
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'charts' | 'data' | 'trading' | 'backtest'>('charts');
  const [ibConnected, setIbConnected] = useState(false);
  const [accountBalance, setAccountBalance] = useState(100000);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [selectedSymbol] = useState('AAPL');
  const [strategy, setStrategy] = useState<'momentum' | 'meanReversion' | 'breakout'>('momentum');

  const ibApi = React.useRef(new IBApiService(true));

  useEffect(() => {
    console.log('App useEffect running');
    console.log('State initialized:', {
      excelData: excelData.length,
      stockData: stockData.length,
      indicators: Object.keys(indicators).length
    });
    // Don't auto-load in development - wait for user to select file
    // loadExcelFile('/Users/chris/Documents/Code/Tiinos magic code/2025 05 - Itteration/StockPriceAnalysis.xlsx');
  }, []);

  const loadExcelFile = async (filePath: string) => {
    try {
      const data = await ExcelService.readExcel(filePath);
      setExcelData(data);
      setSelectedFile(filePath);
      
      if (data.length > 0) {
        const parsedStockData = ExcelService.parseStockData(data[0]);
        setStockData(parsedStockData);
        
        // Calculate indicators
        const calculatedIndicators = TradingAlgorithms.calculateIndicators(parsedStockData);
        setIndicators(calculatedIndicators);
        
        toast.success('Excel file loaded successfully');
      }
    } catch (error) {
      console.error('Failed to load Excel file:', error);
      toast.error('Failed to load Excel file');
    }
  };

  const handleFileUpload = async () => {
    try {
      // Temporarily use file input instead of Tauri dialog
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xls';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          // For now, just show a message
          toast.info(`Selected file: ${file.name} - File dialog integration pending`);
        }
      };
      input.click();
    } catch (error) {
      console.error('File selection error:', error);
      toast.error('Failed to select file');
    }
  };

  const connectToIB = async () => {
    try {
      const connected = await ibApi.current.connect();
      if (connected) {
        setIbConnected(true);
        const accountInfo = await ibApi.current.getAccountInfo();
        setAccountBalance(accountInfo.balance);
        toast.success('Connected to IB TWS');
        
        // Get current price for selected symbol
        const price = await ibApi.current.getMarketData(selectedSymbol);
        setCurrentPrice(price);
      }
    } catch (error) {
      console.error('IB connection error:', error);
      toast.error('Failed to connect to IB TWS. Make sure TWS is running.');
    }
  };

  const handlePlaceOrder = async (order: TradeSignal) => {
    try {
      if (!ibConnected) {
        toast.error('Please connect to IB TWS first');
        return;
      }
      
      const orderId = await ibApi.current.placeOrder(order);
      toast.success(`Order placed successfully. Order ID: ${orderId}`);
      
      // Log trade to Excel
      const tradeLog: ExcelData = {
        headers: ['Date', 'Symbol', 'Action', 'Quantity', 'Price', 'Order ID'],
        rows: [[
          { Text: new Date().toISOString() },
          { Text: order.symbol },
          { Text: order.action },
          { Number: order.quantity },
          { Number: order.price || currentPrice },
          { Number: orderId }
        ]],
        sheet_name: 'Trade Log'
      };
      
      // Append to existing data or create new sheet
      const updatedData = [...excelData];
      const tradeLogIndex = updatedData.findIndex(d => d.sheet_name === 'Trade Log');
      
      if (tradeLogIndex >= 0) {
        updatedData[tradeLogIndex].rows.push(tradeLog.rows[0]);
      } else {
        updatedData.push(tradeLog);
      }
      
      await ExcelService.writeExcel(selectedFile, updatedData);
      setExcelData(updatedData);
      
    } catch (error) {
      console.error('Order placement error:', error);
      toast.error('Failed to place order');
    }
  };

  const runBacktest = () => {
    if (stockData.length === 0) {
      toast.error('Please load stock data first');
      return;
    }
    
    const result = TradingAlgorithms.backtest(stockData, strategy, accountBalance);
    
    toast.success(
      <div>
        <p className="font-semibold">Backtest Complete</p>
        <p>Total Return: {result.totalReturn.toFixed(2)}%</p>
        <p>Win Rate: {(result.winRate * 100).toFixed(2)}%</p>
        <p>Max Drawdown: {result.maxDrawdown.toFixed(2)}%</p>
      </div>
    );
  };

  const generateSignal = () => {
    if (stockData.length === 0) {
      toast.error('Please load stock data first');
      return;
    }
    
    const signal = TradingAlgorithms.generateSignal(stockData, indicators, strategy);
    
    const signalColor = signal.action === 'BUY' ? 'text-green-500' : 
                       signal.action === 'SELL' ? 'text-red-500' : 'text-gray-500';
    
    toast(
      <div>
        <p className="font-semibold">Trading Signal Generated</p>
        <p className={signalColor}>Action: {signal.action}</p>
        <p>Confidence: {signal.confidence.toFixed(2)}%</p>
      </div>
    );
    
    return signal;
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <h1 style={{ color: 'red', fontSize: '24px', padding: '20px' }}>APP IS RENDERING!</h1>
        <Toaster position="top-right" richColors />
        
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-blue-500" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Stock Visualizer & Trading Platform
                </h1>
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  onClick={handleFileUpload}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center gap-2 text-sm"
                >
                  <Upload size={16} />
                  Load Excel
                </button>
                
                {!ibConnected ? (
                  <button
                    onClick={connectToIB}
                    className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center gap-2 text-sm"
                  >
                    <Activity size={16} />
                    Connect to IB
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-md">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm text-green-700 dark:text-green-300">IB Connected</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    ${accountBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex gap-8">
              {[
                { id: 'charts', label: 'Charts', icon: BarChart3 },
                { id: 'data', label: 'Data Grid', icon: FileSpreadsheet },
                { id: 'trading', label: 'Trading', icon: TrendingUp },
                { id: 'backtest', label: 'Backtest', icon: Activity },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <tab.icon size={18} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {stockData.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12 text-center">
              <FileSpreadsheet className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No Data Loaded
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Please load an Excel file to start visualizing and analyzing stock data
              </p>
              <button
                onClick={handleFileUpload}
                className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 inline-flex items-center gap-2"
              >
                <Upload size={20} />
                Load Excel File
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'charts' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                      Price Chart with Indicators
                    </h2>
                    <StockChart 
                      data={stockData} 
                      indicators={{
                        sma20: indicators.sma20,
                        sma50: indicators.sma50,
                      }}
                      height={400}
                    />
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                    <CandlestickChart data={stockData} height={500} />
                  </div>
                </div>
              )}

              {activeTab === 'data' && excelData.length > 0 && (
                <ExcelGrid
                  data={excelData[0]}
                  onCellEdit={async (row, col, value) => {
                    await ExcelService.updateCell(selectedFile, excelData[0].sheet_name, row + 1, col, value);
                    toast.success('Cell updated');
                  }}
                  onSave={async () => {
                    await ExcelService.writeExcel(selectedFile, excelData);
                    toast.success('Data saved to Excel');
                  }}
                />
              )}

              {activeTab === 'trading' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Trading Strategy
                        </h2>
                        <select
                          value={strategy}
                          onChange={(e) => setStrategy(e.target.value as any)}
                          className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="momentum">Momentum</option>
                          <option value="meanReversion">Mean Reversion</option>
                          <option value="breakout">Breakout</option>
                        </select>
                      </div>
                      
                      <button
                        onClick={generateSignal}
                        className="w-full py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center justify-center gap-2"
                      >
                        <Activity size={20} />
                        Generate Trading Signal
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <OrderPanel
                      symbol={selectedSymbol}
                      accountBalance={accountBalance}
                      currentPrice={currentPrice}
                      onPlaceOrder={handlePlaceOrder}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'backtest' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                  <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                    Strategy Backtesting
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Strategy
                      </label>
                      <select
                        value={strategy}
                        onChange={(e) => setStrategy(e.target.value as any)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="momentum">Momentum</option>
                        <option value="meanReversion">Mean Reversion</option>
                        <option value="breakout">Breakout</option>
                      </select>
                    </div>
                    
                    <button
                      onClick={runBacktest}
                      className="w-full py-3 bg-purple-500 text-white rounded-md hover:bg-purple-600 flex items-center justify-center gap-2"
                    >
                      <Activity size={20} />
                      Run Backtest
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;
