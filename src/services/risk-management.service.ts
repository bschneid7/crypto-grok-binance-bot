import { config } from '../config';
import { logger, generateUniqueId } from '../utils';
import { Position, Trade, TradingStats } from '../models';
import { BinanceService } from './binance.service';

export class RiskManagementService {
  private binanceService: BinanceService;
  private positions: Map<string, Position>;
  private trades: Trade[];
  private maxRiskPerTrade: number;
  private maxOpenPositions: number;
  private stopLossPercent: number;
  private takeProfitPercent: number;
  private trailingStopPercent: number;

  constructor(binanceService: BinanceService) {
    this.binanceService = binanceService;
    this.positions = new Map();
    this.trades = [];
    this.maxRiskPerTrade = config.trading.maxRiskPerTrade;
    this.maxOpenPositions = config.trading.maxOpenPositions;
    this.stopLossPercent = config.trading.stopLossPercent;
    this.takeProfitPercent = config.trading.takeProfitPercent;
    this.trailingStopPercent = config.trading.trailingStopPercent;
  }

  async calculatePositionSize(symbol: string, currentPrice: number): Promise<number> {
    try {
      // Get USD balance
      const usdBalance = await this.binanceService.getBalance('USD');
      if (!usdBalance) {
        logger.warn('No USD balance found');
        return 0;
      }

      const availableBalance = usdBalance.free;
      
      // Calculate maximum amount to risk based on risk percentage
      const maxRiskAmount = availableBalance * (this.maxRiskPerTrade / 100);
      
      // Calculate position size based on stop loss
      // Position size = Risk Amount / (Entry Price * Stop Loss %)
      const stopLossDistance = currentPrice * (this.stopLossPercent / 100);
      const positionSize = maxRiskAmount / stopLossDistance;

      // Round to appropriate decimal places (8 for crypto)
      const roundedSize = Math.floor(positionSize * 100000000) / 100000000;

      logger.debug(`Calculated position size for ${symbol}: ${roundedSize} (max risk: $${maxRiskAmount.toFixed(2)})`);
      
      return roundedSize;
    } catch (error) {
      logger.error('Error calculating position size', error);
      return 0;
    }
  }

  canOpenNewPosition(): boolean {
    const openPositionCount = this.positions.size;
    if (openPositionCount >= this.maxOpenPositions) {
      logger.info(`Maximum open positions reached (${openPositionCount}/${this.maxOpenPositions})`);
      return false;
    }
    return true;
  }

  hasOpenPosition(symbol: string): boolean {
    return this.positions.has(symbol);
  }

  getPosition(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }

  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  openPosition(
    symbol: string,
    side: 'BUY' | 'SELL',
    entryPrice: number,
    quantity: number
  ): Position {
    const stopLoss = side === 'BUY'
      ? entryPrice * (1 - this.stopLossPercent / 100)
      : entryPrice * (1 + this.stopLossPercent / 100);

    const takeProfit = side === 'BUY'
      ? entryPrice * (1 + this.takeProfitPercent / 100)
      : entryPrice * (1 - this.takeProfitPercent / 100);

    const position: Position = {
      symbol,
      side,
      entryPrice,
      quantity,
      stopLoss,
      takeProfit,
      trailingStop: this.trailingStopPercent > 0 ? stopLoss : undefined,
      openTime: Date.now(),
    };

    this.positions.set(symbol, position);

    const trade: Trade = {
      id: `TRD-${generateUniqueId()}`,
      symbol,
      side,
      entryPrice,
      quantity,
      openTime: Date.now(),
      status: 'OPEN',
    };
    this.trades.push(trade);

    logger.info(`Opened ${side} position for ${symbol}: ${quantity} @ ${entryPrice}`);
    logger.info(`Stop Loss: ${stopLoss.toFixed(2)}, Take Profit: ${takeProfit.toFixed(2)}`);

    return position;
  }

  closePosition(symbol: string, exitPrice: number): Trade | null {
    const position = this.positions.get(symbol);
    if (!position) {
      logger.warn(`No position found for ${symbol}`);
      return null;
    }

    // Find the corresponding trade
    const trade = this.trades.find(t => t.symbol === symbol && t.status === 'OPEN');
    if (trade) {
      trade.exitPrice = exitPrice;
      trade.closeTime = Date.now();
      trade.status = 'CLOSED';

      // Calculate P&L
      if (position.side === 'BUY') {
        trade.realizedPnL = (exitPrice - position.entryPrice) * position.quantity;
      } else {
        trade.realizedPnL = (position.entryPrice - exitPrice) * position.quantity;
      }

      logger.info(`Closed ${position.side} position for ${symbol}: ${position.quantity} @ ${exitPrice}`);
      logger.info(`Realized P&L: $${trade.realizedPnL.toFixed(2)}`);
    }

    this.positions.delete(symbol);
    return trade || null;
  }

  async checkStopLossAndTakeProfit(symbol: string): Promise<{ shouldClose: boolean; reason: string } | null> {
    const position = this.positions.get(symbol);
    if (!position) {
      return null;
    }

    try {
      const currentPrice = await this.binanceService.getCurrentPrice(symbol);
      
      // Update unrealized P&L
      if (position.side === 'BUY') {
        position.unrealizedPnL = (currentPrice - position.entryPrice) * position.quantity;
      } else {
        position.unrealizedPnL = (position.entryPrice - currentPrice) * position.quantity;
      }

      // Update trailing stop if enabled
      if (this.trailingStopPercent > 0 && position.trailingStop) {
        if (position.side === 'BUY') {
          const newTrailingStop = currentPrice * (1 - this.trailingStopPercent / 100);
          if (newTrailingStop > position.trailingStop) {
            position.trailingStop = newTrailingStop;
            logger.debug(`Updated trailing stop for ${symbol} to ${newTrailingStop.toFixed(2)}`);
          }
        } else {
          const newTrailingStop = currentPrice * (1 + this.trailingStopPercent / 100);
          if (newTrailingStop < position.trailingStop) {
            position.trailingStop = newTrailingStop;
            logger.debug(`Updated trailing stop for ${symbol} to ${newTrailingStop.toFixed(2)}`);
          }
        }
      }

      // Check stop loss (including trailing stop)
      const effectiveStopLoss = position.trailingStop 
        ? (position.side === 'BUY' 
            ? Math.max(position.stopLoss, position.trailingStop)
            : Math.min(position.stopLoss, position.trailingStop))
        : position.stopLoss;

      if (position.side === 'BUY') {
        if (currentPrice <= effectiveStopLoss) {
          return { shouldClose: true, reason: `Stop loss triggered at ${currentPrice.toFixed(2)}` };
        }
        if (currentPrice >= position.takeProfit) {
          return { shouldClose: true, reason: `Take profit triggered at ${currentPrice.toFixed(2)}` };
        }
      } else {
        if (currentPrice >= effectiveStopLoss) {
          return { shouldClose: true, reason: `Stop loss triggered at ${currentPrice.toFixed(2)}` };
        }
        if (currentPrice <= position.takeProfit) {
          return { shouldClose: true, reason: `Take profit triggered at ${currentPrice.toFixed(2)}` };
        }
      }

      return { shouldClose: false, reason: '' };
    } catch (error) {
      logger.error(`Error checking stop loss for ${symbol}`, error);
      return null;
    }
  }

  getTradingStats(): TradingStats {
    const closedTrades = this.trades.filter(t => t.status === 'CLOSED');
    const winningTrades = closedTrades.filter(t => (t.realizedPnL || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.realizedPnL || 0) < 0);

    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0));

    const wins = winningTrades.map(t => t.realizedPnL || 0);
    const losses = losingTrades.map(t => t.realizedPnL || 0);

    return {
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      totalPnL,
      avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
      largestWin: wins.length > 0 ? Math.max(...wins) : 0,
      largestLoss: losses.length > 0 ? Math.min(...losses) : 0,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
    };
  }

  getTradeHistory(): Trade[] {
    return [...this.trades];
  }
}
