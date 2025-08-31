import * as TI from 'technicalindicators';
import { StockData } from './excel.service';
import { TradeSignal } from './ib-api.service';

export interface TechnicalIndicators {
  sma20?: number[];
  sma50?: number[];
  ema12?: number[];
  ema26?: number[];
  rsi?: number[];
  macd?: {
    MACD: number[];
    signal: number[];
    histogram: number[];
  };
  bollinger?: {
    upper: number[];
    middle: number[];
    lower: number[];
  };
  volume?: {
    average: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
}

export interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: {
    date: string;
    action: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    pnl?: number;
  }[];
}

export class TradingAlgorithms {
  static calculateSMA(prices: number[], period: number): number[] {
    return TI.SMA.calculate({ period, values: prices });
  }

  static calculateEMA(prices: number[], period: number): number[] {
    return TI.EMA.calculate({ period, values: prices });
  }

  static calculateRSI(prices: number[], period: number = 14): number[] {
    return TI.RSI.calculate({ period, values: prices });
  }

  static calculateMACD(prices: number[]): any {
    return TI.MACD.calculate({
      values: prices,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
  }

  static calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2): any {
    return TI.BollingerBands.calculate({
      period,
      values: prices,
      stdDev,
    });
  }

  static calculateIndicators(stockData: StockData[]): TechnicalIndicators {
    const closePrices = stockData.map(d => d.close);
    const volumes = stockData.map(d => d.volume);

    const indicators: TechnicalIndicators = {};

    // Moving Averages
    if (closePrices.length >= 20) {
      indicators.sma20 = this.calculateSMA(closePrices, 20);
      indicators.ema12 = this.calculateEMA(closePrices, 12);
    }
    
    if (closePrices.length >= 50) {
      indicators.sma50 = this.calculateSMA(closePrices, 50);
      indicators.ema26 = this.calculateEMA(closePrices, 26);
    }

    // RSI
    if (closePrices.length >= 14) {
      indicators.rsi = this.calculateRSI(closePrices);
    }

    // MACD
    if (closePrices.length >= 26) {
      const macdResult = this.calculateMACD(closePrices);
      if (macdResult && macdResult.length > 0) {
        indicators.macd = {
          MACD: macdResult.map((r: any) => r.MACD).filter((v: any) => v !== undefined),
          signal: macdResult.map((r: any) => r.signal).filter((v: any) => v !== undefined),
          histogram: macdResult.map((r: any) => r.histogram).filter((v: any) => v !== undefined),
        };
      }
    }

    // Bollinger Bands
    if (closePrices.length >= 20) {
      const bb = this.calculateBollingerBands(closePrices);
      if (bb && bb.length > 0) {
        indicators.bollinger = {
          upper: bb.map((b: any) => b.upper),
          middle: bb.map((b: any) => b.middle),
          lower: bb.map((b: any) => b.lower),
        };
      }
    }

    // Volume Analysis
    if (volumes.length > 0) {
      const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
      const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
      
      indicators.volume = {
        average: avgVolume,
        trend: recentVolume > avgVolume * 1.1 ? 'increasing' :
               recentVolume < avgVolume * 0.9 ? 'decreasing' : 'stable'
      };
    }

    return indicators;
  }

  static generateSignal(
    stockData: StockData[],
    indicators: TechnicalIndicators,
    strategy: 'momentum' | 'meanReversion' | 'breakout' = 'momentum'
  ): TradeSignal {
    const latestData = stockData[stockData.length - 1];
    const currentPrice = latestData.close;
    
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;

    switch (strategy) {
      case 'momentum':
        action = this.momentumStrategy(indicators, stockData);
        break;
      case 'meanReversion':
        action = this.meanReversionStrategy(indicators, stockData);
        break;
      case 'breakout':
        action = this.breakoutStrategy(indicators, stockData);
        break;
    }

    // Calculate confidence based on multiple indicators
    confidence = this.calculateConfidence(indicators, action);

    return {
      action,
      symbol: latestData.symbol,
      quantity: 0, // Will be calculated by position sizing
      price: currentPrice,
      confidence,
    };
  }

  private static momentumStrategy(indicators: TechnicalIndicators, _stockData: StockData[]): 'BUY' | 'SELL' | 'HOLD' {
    if (!indicators.sma20 || !indicators.sma50 || !indicators.rsi || !indicators.macd) {
      return 'HOLD';
    }

    const latestSMA20 = indicators.sma20[indicators.sma20.length - 1];
    const latestSMA50 = indicators.sma50[indicators.sma50.length - 1];
    const latestRSI = indicators.rsi[indicators.rsi.length - 1];
    const latestMACD = indicators.macd.histogram[indicators.macd.histogram.length - 1];

    // Buy signals
    if (latestSMA20 > latestSMA50 && latestRSI < 70 && latestMACD > 0) {
      return 'BUY';
    }

    // Sell signals
    if (latestSMA20 < latestSMA50 || latestRSI > 70 || latestMACD < 0) {
      return 'SELL';
    }

    return 'HOLD';
  }

  private static meanReversionStrategy(indicators: TechnicalIndicators, stockData: StockData[]): 'BUY' | 'SELL' | 'HOLD' {
    if (!indicators.bollinger || !indicators.rsi) {
      return 'HOLD';
    }

    const currentPrice = stockData[stockData.length - 1].close;
    const latestUpper = indicators.bollinger.upper[indicators.bollinger.upper.length - 1];
    const latestLower = indicators.bollinger.lower[indicators.bollinger.lower.length - 1];
    const latestRSI = indicators.rsi[indicators.rsi.length - 1];

    // Buy when oversold
    if (currentPrice < latestLower && latestRSI < 30) {
      return 'BUY';
    }

    // Sell when overbought
    if (currentPrice > latestUpper && latestRSI > 70) {
      return 'SELL';
    }

    return 'HOLD';
  }

  private static breakoutStrategy(indicators: TechnicalIndicators, stockData: StockData[]): 'BUY' | 'SELL' | 'HOLD' {
    if (stockData.length < 20) {
      return 'HOLD';
    }

    const currentPrice = stockData[stockData.length - 1].close;
    
    // Calculate 20-day high and low
    const last20Days = stockData.slice(-20);
    const high20 = Math.max(...last20Days.map(d => d.high));
    const low20 = Math.min(...last20Days.map(d => d.low));
    
    // Check volume surge
    const volumeSurge = indicators.volume?.trend === 'increasing';

    // Buy on breakout above resistance
    if (currentPrice > high20 * 0.98 && volumeSurge) {
      return 'BUY';
    }

    // Sell on breakdown below support
    if (currentPrice < low20 * 1.02) {
      return 'SELL';
    }

    return 'HOLD';
  }

  private static calculateConfidence(indicators: TechnicalIndicators, action: 'BUY' | 'SELL' | 'HOLD'): number {
    let score = 0;
    let maxScore = 0;

    // RSI confirmation
    if (indicators.rsi) {
      maxScore += 25;
      const latestRSI = indicators.rsi[indicators.rsi.length - 1];
      if (action === 'BUY' && latestRSI < 50) score += 25;
      else if (action === 'SELL' && latestRSI > 50) score += 25;
      else if (action === 'HOLD' && latestRSI >= 40 && latestRSI <= 60) score += 25;
    }

    // MACD confirmation
    if (indicators.macd) {
      maxScore += 25;
      const latestHistogram = indicators.macd.histogram[indicators.macd.histogram.length - 1];
      if (action === 'BUY' && latestHistogram > 0) score += 25;
      else if (action === 'SELL' && latestHistogram < 0) score += 25;
      else if (action === 'HOLD' && Math.abs(latestHistogram) < 0.1) score += 25;
    }

    // Moving average confirmation
    if (indicators.sma20 && indicators.sma50) {
      maxScore += 25;
      const sma20 = indicators.sma20[indicators.sma20.length - 1];
      const sma50 = indicators.sma50[indicators.sma50.length - 1];
      if (action === 'BUY' && sma20 > sma50) score += 25;
      else if (action === 'SELL' && sma20 < sma50) score += 25;
      else if (action === 'HOLD' && Math.abs(sma20 - sma50) / sma50 < 0.02) score += 25;
    }

    // Volume confirmation
    if (indicators.volume) {
      maxScore += 25;
      if (action !== 'HOLD' && indicators.volume.trend === 'increasing') score += 25;
      else if (action === 'HOLD' && indicators.volume.trend === 'stable') score += 25;
    }

    return maxScore > 0 ? (score / maxScore) * 100 : 50;
  }

  static calculatePositionSize(
    signal: TradeSignal,
    accountBalance: number,
    riskPerTrade: number = 0.02,
    maxPositionSize: number = 0.1
  ): number {
    // Kelly Criterion adjusted for confidence
    const kellyFraction = (signal.confidence / 100) * riskPerTrade;
    
    // Calculate position size
    let positionValue = accountBalance * Math.min(kellyFraction, maxPositionSize);
    
    // Calculate number of shares
    const shares = Math.floor(positionValue / (signal.price || 1));
    
    return Math.max(1, shares);
  }

  static backtest(
    stockData: StockData[],
    strategy: 'momentum' | 'meanReversion' | 'breakout',
    initialCapital: number = 10000
  ): BacktestResult {
    const trades: any[] = [];
    let capital = initialCapital;
    let position = 0;
    let entryPrice = 0;
    
    for (let i = 50; i < stockData.length; i++) {
      const slice = stockData.slice(0, i + 1);
      const indicators = this.calculateIndicators(slice);
      const signal = this.generateSignal(slice, indicators, strategy);
      
      if (signal.action === 'BUY' && position === 0) {
        // Enter position
        position = Math.floor(capital / slice[i].close);
        entryPrice = slice[i].close;
        capital -= position * entryPrice;
        
        trades.push({
          date: slice[i].date,
          action: 'BUY',
          price: entryPrice,
          quantity: position,
        });
      } else if (signal.action === 'SELL' && position > 0) {
        // Exit position
        const exitPrice = slice[i].close;
        const pnl = (exitPrice - entryPrice) * position;
        capital += position * exitPrice;
        
        trades.push({
          date: slice[i].date,
          action: 'SELL',
          price: exitPrice,
          quantity: position,
          pnl,
        });
        
        position = 0;
      }
    }
    
    // Close any open position
    if (position > 0) {
      const exitPrice = stockData[stockData.length - 1].close;
      const pnl = (exitPrice - entryPrice) * position;
      capital += position * exitPrice;
      
      trades.push({
        date: stockData[stockData.length - 1].date,
        action: 'SELL',
        price: exitPrice,
        quantity: position,
        pnl,
      });
    }
    
    // Calculate metrics
    const winningTrades = trades.filter(t => t.pnl && t.pnl > 0).length;
    const losingTrades = trades.filter(t => t.pnl && t.pnl < 0).length;
    const totalReturn = ((capital - initialCapital) / initialCapital) * 100;
    
    // Calculate max drawdown
    let peak = initialCapital;
    let maxDrawdown = 0;
    let runningCapital = initialCapital;
    
    for (const trade of trades) {
      if (trade.pnl) {
        runningCapital += trade.pnl;
        peak = Math.max(peak, runningCapital);
        const drawdown = ((peak - runningCapital) / peak) * 100;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }
    
    // Simple Sharpe Ratio calculation
    const returns = trades.filter(t => t.pnl).map(t => t.pnl! / initialCapital);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length || 0;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    ) || 1;
    const sharpeRatio = (avgReturn / stdDev) * Math.sqrt(252); // Annualized
    
    return {
      totalTrades: Math.floor(trades.length / 2),
      winningTrades,
      losingTrades,
      winRate: winningTrades / (winningTrades + losingTrades) || 0,
      totalReturn,
      maxDrawdown,
      sharpeRatio,
      trades,
    };
  }
}