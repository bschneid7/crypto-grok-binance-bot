export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT';
export type OrderStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';
export type TradeSignal = 'BUY' | 'SELL' | 'HOLD';

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price: number;
  status: OrderStatus;
  timestamp: number;
}

export interface Position {
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  trailingStop?: number;
  openTime: number;
  unrealizedPnL?: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  realizedPnL?: number;
  openTime: number;
  closeTime?: number;
  status: 'OPEN' | 'CLOSED';
}

export interface AccountBalance {
  asset: string;
  free: number;
  locked: number;
}

export interface StrategySignal {
  signal: TradeSignal;
  confidence: number;
  reasons: string[];
  indicators: {
    rsi?: number;
    macd?: { value: number; signal: number; histogram: number };
    ema?: { short: number; long: number };
  };
}

export interface TradingStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
}
