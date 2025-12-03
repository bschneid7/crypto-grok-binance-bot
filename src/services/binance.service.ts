import Binance, { Binance as BinanceClient, CandleChartInterval } from 'binance-api-node';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Candle, AccountBalance, Order, OrderSide, OrderType } from '../models';

export class BinanceService {
  private client: BinanceClient;
  private paperTrading: boolean;
  private paperBalances: Map<string, AccountBalance>;
  private paperOrders: Order[];

  constructor() {
    // Binance.US uses the same API but different base URL
    this.client = Binance({
      apiKey: config.binance.apiKey,
      apiSecret: config.binance.apiSecret,
      httpBase: 'https://api.binance.us',
    });

    this.paperTrading = config.trading.paperTrading;
    this.paperBalances = new Map();
    this.paperOrders = [];

    // Initialize paper trading balances
    if (this.paperTrading) {
      this.paperBalances.set('USD', { asset: 'USD', free: 10000, locked: 0 });
      this.paperBalances.set('BTC', { asset: 'BTC', free: 0, locked: 0 });
      this.paperBalances.set('ETH', { asset: 'ETH', free: 0, locked: 0 });
      logger.info('Paper trading mode enabled with $10,000 USD starting balance');
    }
  }

  async getAccountBalances(): Promise<AccountBalance[]> {
    if (this.paperTrading) {
      return Array.from(this.paperBalances.values());
    }

    try {
      const accountInfo = await this.client.accountInfo();
      return accountInfo.balances.map(b => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
      }));
    } catch (error) {
      logger.error('Failed to get account balances', error);
      throw error;
    }
  }

  async getBalance(asset: string): Promise<AccountBalance | undefined> {
    const balances = await this.getAccountBalances();
    return balances.find(b => b.asset === asset);
  }

  async getCandles(symbol: string, interval: CandleChartInterval = CandleChartInterval.ONE_HOUR, limit: number = 100): Promise<Candle[]> {
    try {
      const candles = await this.client.candles({
        symbol,
        interval,
        limit,
      });

      return candles.map(c => ({
        openTime: c.openTime,
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close),
        volume: parseFloat(c.volume),
        closeTime: c.closeTime,
      }));
    } catch (error) {
      logger.error(`Failed to get candles for ${symbol}`, error);
      throw error;
    }
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const ticker = await this.client.prices({ symbol });
      return parseFloat(ticker[symbol]);
    } catch (error) {
      logger.error(`Failed to get current price for ${symbol}`, error);
      throw error;
    }
  }

  async placeOrder(
    symbol: string,
    side: OrderSide,
    type: OrderType,
    quantity: number,
    price?: number
  ): Promise<Order> {
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const currentPrice = price || await this.getCurrentPrice(symbol);

    if (this.paperTrading) {
      return this.executePaperOrder(orderId, symbol, side, type, quantity, currentPrice);
    }

    try {
      // Create order parameters based on order type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let orderParams: any;
      
      if (type === 'MARKET') {
        orderParams = {
          symbol,
          side,
          type: 'MARKET',
          quantity: quantity.toString(),
        };
      } else {
        orderParams = {
          symbol,
          side,
          type: 'LIMIT',
          quantity: quantity.toString(),
          price: price?.toString() || currentPrice.toString(),
          timeInForce: 'GTC',
        };
      }

      const result = await this.client.order(orderParams);

      const order: Order = {
        id: result.orderId.toString(),
        symbol: result.symbol,
        side: result.side as OrderSide,
        type: result.type as OrderType,
        quantity: parseFloat(result.executedQty),
        price: parseFloat(result.price) || currentPrice,
        status: result.status as Order['status'],
        timestamp: result.transactTime || Date.now(),
      };

      logger.info(`Order placed: ${JSON.stringify(order)}`);
      return order;
    } catch (error) {
      logger.error(`Failed to place order for ${symbol}`, error);
      throw error;
    }
  }

  private executePaperOrder(
    orderId: string,
    symbol: string,
    side: OrderSide,
    type: OrderType,
    quantity: number,
    price: number
  ): Order {
    // Extract base and quote assets from symbol
    const quoteAsset = 'USD';
    const baseAsset = symbol.replace(quoteAsset, '');

    const quoteBalance = this.paperBalances.get(quoteAsset);
    let baseBalance = this.paperBalances.get(baseAsset);

    if (!baseBalance) {
      baseBalance = { asset: baseAsset, free: 0, locked: 0 };
      this.paperBalances.set(baseAsset, baseBalance);
    }

    const orderValue = quantity * price;

    if (side === 'BUY') {
      if (!quoteBalance || quoteBalance.free < orderValue) {
        throw new Error(`Insufficient ${quoteAsset} balance for paper trade`);
      }
      quoteBalance.free -= orderValue;
      baseBalance.free += quantity;
    } else {
      if (!baseBalance || baseBalance.free < quantity) {
        throw new Error(`Insufficient ${baseAsset} balance for paper trade`);
      }
      baseBalance.free -= quantity;
      if (quoteBalance) {
        quoteBalance.free += orderValue;
      }
    }

    const order: Order = {
      id: orderId,
      symbol,
      side,
      type,
      quantity,
      price,
      status: 'FILLED',
      timestamp: Date.now(),
    };

    this.paperOrders.push(order);
    logger.info(`Paper order executed: ${JSON.stringify(order)}`);

    return order;
  }

  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    if (this.paperTrading) {
      const orderIndex = this.paperOrders.findIndex(o => o.id === orderId);
      if (orderIndex !== -1) {
        this.paperOrders[orderIndex].status = 'CANCELED';
      }
      return;
    }

    try {
      await this.client.cancelOrder({
        symbol,
        orderId: parseInt(orderId),
      });
      logger.info(`Order canceled: ${orderId}`);
    } catch (error) {
      logger.error(`Failed to cancel order ${orderId}`, error);
      throw error;
    }
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    if (this.paperTrading) {
      return this.paperOrders.filter(o => 
        o.status === 'NEW' && (!symbol || o.symbol === symbol)
      );
    }

    try {
      const openOrders = await this.client.openOrders({ symbol });
      return openOrders.map(o => ({
        id: o.orderId.toString(),
        symbol: o.symbol,
        side: o.side as OrderSide,
        type: o.type as OrderType,
        quantity: parseFloat(o.origQty),
        price: parseFloat(o.price),
        status: o.status as Order['status'],
        timestamp: o.time,
      }));
    } catch (error) {
      logger.error('Failed to get open orders', error);
      throw error;
    }
  }

  getPaperOrders(): Order[] {
    return this.paperOrders;
  }

  isPaperTrading(): boolean {
    return this.paperTrading;
  }
}
