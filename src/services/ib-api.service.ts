import IBApi, { EventName, Contract, Order, OrderAction, OrderType, SecType } from '@stoqey/ib';

export interface TradeSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  symbol: string;
  quantity: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
  confidence: number;
}

export interface Position {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

export interface AccountInfo {
  balance: number;
  buyingPower: number;
  positions: Position[];
  dailyPnl: number;
}

export class IBApiService {
  private ib: IBApi | null = null;
  private connected: boolean = false;
  private clientId: number = 1;
  private port: number = 7497; // TWS paper trading port (7496 for live)

  constructor(paperTrading: boolean = true) {
    this.port = paperTrading ? 7497 : 7496;
  }

  async connect(): Promise<boolean> {
    try {
      this.ib = new IBApi({
        clientId: this.clientId++,
        host: '127.0.0.1',
        port: this.port,
      });

      await this.ib.connect();
      this.connected = true;
      console.log('Connected to IB TWS');
      return true;
    } catch (error) {
      console.error('Failed to connect to IB TWS:', error);
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.ib && this.connected) {
      await this.ib.disconnect();
      this.connected = false;
      console.log('Disconnected from IB TWS');
    }
  }

  async getAccountInfo(): Promise<AccountInfo> {
    if (!this.ib || !this.connected) {
      throw new Error('Not connected to IB TWS');
    }

    return new Promise((resolve, reject) => {
      const accountInfo: AccountInfo = {
        balance: 0,
        buyingPower: 0,
        positions: [],
        dailyPnl: 0,
      };

      this.ib!.reqAccountSummary(
        1,
        'All',
        'NetLiquidation,BuyingPower,DailyPnL'
      );

      this.ib!.on(EventName.accountSummary, (
        _reqId: number,
        _account: string,
        tag: string,
        value: string,
        _currency: string
      ) => {
        if (tag === 'NetLiquidation') {
          accountInfo.balance = parseFloat(value);
        } else if (tag === 'BuyingPower') {
          accountInfo.buyingPower = parseFloat(value);
        } else if (tag === 'DailyPnL') {
          accountInfo.dailyPnl = parseFloat(value);
        }
      });

      this.ib!.on(EventName.accountSummaryEnd, () => {
        resolve(accountInfo);
      });

      setTimeout(() => {
        reject(new Error('Account info request timeout'));
      }, 10000);
    });
  }

  async getMarketData(symbol: string): Promise<number> {
    if (!this.ib || !this.connected) {
      throw new Error('Not connected to IB TWS');
    }

    const contract: Contract = {
      symbol: symbol,
      secType: SecType.STK,
      exchange: 'SMART',
      currency: 'USD',
    };

    return new Promise((resolve, reject) => {
      const reqId = Math.floor(Math.random() * 10000);
      let lastPrice = 0;

      this.ib!.reqMktData(reqId, contract, '', false, false);

      this.ib!.on(EventName.tickPrice, (tickerId: number, tickType: number, price: number) => {
        if (tickerId === reqId && tickType === 4) { // Last price
          lastPrice = price;
          this.ib!.cancelMktData(reqId);
          resolve(lastPrice);
        }
      });

      setTimeout(() => {
        this.ib!.cancelMktData(reqId);
        if (lastPrice > 0) {
          resolve(lastPrice);
        } else {
          reject(new Error('Market data request timeout'));
        }
      }, 5000);
    });
  }

  async placeOrder(signal: TradeSignal): Promise<number> {
    if (!this.ib || !this.connected) {
      throw new Error('Not connected to IB TWS');
    }

    const contract: Contract = {
      symbol: signal.symbol,
      secType: SecType.STK,
      exchange: 'SMART',
      currency: 'USD',
    };

    const order: Order = {
      action: signal.action as OrderAction,
      totalQuantity: signal.quantity,
      orderType: signal.price ? OrderType.LMT : OrderType.MKT,
      lmtPrice: signal.price,
    };

    const orderId = Math.floor(Math.random() * 100000);
    
    return new Promise((resolve, reject) => {
      this.ib!.placeOrder(orderId, contract, order);

      this.ib!.on(EventName.orderStatus, (
        id: number,
        status: string,
        _filled: number,
        _remaining: number,
        avgFillPrice: number
      ) => {
        if (id === orderId) {
          if (status === 'Filled') {
            console.log(`Order ${orderId} filled at ${avgFillPrice}`);
            resolve(orderId);
          } else if (status === 'Cancelled' || status === 'ApiCancelled') {
            reject(new Error(`Order ${orderId} was cancelled`));
          }
        }
      });

      this.ib!.on(EventName.error, (error: Error, _code: number, reqId: number) => {
        if (reqId === orderId) {
          reject(error);
        }
      });

      setTimeout(() => {
        reject(new Error('Order placement timeout'));
      }, 30000);
    });
  }

  async getHistoricalData(
    symbol: string,
    duration: string = '30 D',
    barSize: string = '1 day'
  ): Promise<any[]> {
    if (!this.ib || !this.connected) {
      throw new Error('Not connected to IB TWS');
    }

    const contract: Contract = {
      symbol: symbol,
      secType: SecType.STK,
      exchange: 'SMART',
      currency: 'USD',
    };

    return new Promise((resolve, reject) => {
      const reqId = Math.floor(Math.random() * 10000);
      const bars: any[] = [];

      this.ib!.reqHistoricalData(
        reqId,
        contract,
        '',
        duration,
        barSize as any,
        'TRADES',
        1,
        1,
        false
      );

      this.ib!.on(EventName.historicalData, (
        _reqId: number,
        time: string,
        open: number,
        high: number,
        low: number,
        close: number,
        volume: number
      ) => {
        bars.push({ time, open, high, low, close, volume });
      });

      setTimeout(() => {
        resolve(bars);
      }, 5000);

      setTimeout(() => {
        reject(new Error('Historical data request timeout'));
      }, 10000);
    });
  }

  isConnected(): boolean {
    return this.connected;
  }
}