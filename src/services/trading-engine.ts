import { CandleChartInterval } from 'binance-api-node';
import { config } from '../config';
import { logger } from '../utils/logger';
import { BinanceService } from './binance.service';
import { RiskManagementService } from './risk-management.service';
import { Strategy, createStrategy } from '../strategies';
import { StrategySignal } from '../models';

export interface TradingEngineStatus {
  isRunning: boolean;
  tradingPairs: string[];
  strategy: string;
  paperTrading: boolean;
  lastCheck: Date | null;
  positions: number;
}

export class TradingEngine {
  private binanceService: BinanceService;
  private riskManagement: RiskManagementService;
  private strategy: Strategy;
  private tradingPairs: string[];
  private isRunning: boolean;
  private intervalId: NodeJS.Timeout | null;
  private lastSignals: Map<string, StrategySignal>;
  private lastCheck: Date | null;

  constructor() {
    this.binanceService = new BinanceService();
    this.riskManagement = new RiskManagementService(this.binanceService);
    this.strategy = createStrategy(config.strategy.type);
    this.tradingPairs = config.trading.pairs;
    this.isRunning = false;
    this.intervalId = null;
    this.lastSignals = new Map();
    this.lastCheck = null;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Trading engine is already running');
      return;
    }

    logger.info('Starting trading engine...');
    logger.info(`Strategy: ${this.strategy.name}`);
    logger.info(`Trading pairs: ${this.tradingPairs.join(', ')}`);
    logger.info(`Paper trading: ${this.binanceService.isPaperTrading()}`);

    this.isRunning = true;

    // Run initial check
    await this.runTradingCycle();

    // Set up interval for continuous trading
    this.intervalId = setInterval(async () => {
      await this.runTradingCycle();
    }, config.trading.interval);

    logger.info(`Trading engine started. Checking every ${config.trading.interval / 1000} seconds`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Trading engine is not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info('Trading engine stopped');
  }

  private async runTradingCycle(): Promise<void> {
    this.lastCheck = new Date();
    logger.info('Running trading cycle...');

    try {
      // Check existing positions for stop loss / take profit
      for (const position of this.riskManagement.getAllPositions()) {
        const result = await this.riskManagement.checkStopLossAndTakeProfit(position.symbol);
        if (result && result.shouldClose) {
          logger.info(`${position.symbol}: ${result.reason}`);
          const currentPrice = await this.binanceService.getCurrentPrice(position.symbol);
          
          // Close the position
          const closeSide = position.side === 'BUY' ? 'SELL' : 'BUY';
          await this.binanceService.placeOrder(
            position.symbol,
            closeSide,
            'MARKET',
            position.quantity
          );
          this.riskManagement.closePosition(position.symbol, currentPrice);
        }
      }

      // Analyze each trading pair
      for (const symbol of this.tradingPairs) {
        await this.analyzePair(symbol);
      }
    } catch (error) {
      logger.error('Error in trading cycle', error);
    }
  }

  private async analyzePair(symbol: string): Promise<void> {
    try {
      logger.debug(`Analyzing ${symbol}...`);

      // Get historical candles
      const candles = await this.binanceService.getCandles(
        symbol,
        CandleChartInterval.ONE_HOUR,
        100
      );

      if (candles.length < 50) {
        logger.warn(`Insufficient candle data for ${symbol}`);
        return;
      }

      // Run strategy analysis
      const signal = this.strategy.analyze(candles);
      this.lastSignals.set(symbol, signal);

      logger.info(`${symbol} Signal: ${signal.signal} (confidence: ${signal.confidence.toFixed(1)}%)`);
      signal.reasons.forEach(reason => logger.debug(`  - ${reason}`));

      // Execute trades based on signals
      await this.executeSignal(symbol, signal);
    } catch (error) {
      logger.error(`Error analyzing ${symbol}`, error);
    }
  }

  private async executeSignal(symbol: string, signal: StrategySignal): Promise<void> {
    const hasPosition = this.riskManagement.hasOpenPosition(symbol);

    // Handle SELL signal
    if (signal.signal === 'SELL' && hasPosition) {
      const position = this.riskManagement.getPosition(symbol);
      if (position && position.side === 'BUY') {
        // Close long position
        logger.info(`Closing long position for ${symbol} based on SELL signal`);
        const currentPrice = await this.binanceService.getCurrentPrice(symbol);
        await this.binanceService.placeOrder(symbol, 'SELL', 'MARKET', position.quantity);
        this.riskManagement.closePosition(symbol, currentPrice);
      }
    }

    // Handle BUY signal
    if (signal.signal === 'BUY' && signal.confidence >= 60) {
      if (!hasPosition && this.riskManagement.canOpenNewPosition()) {
        logger.info(`Opening long position for ${symbol} based on BUY signal`);
        const currentPrice = await this.binanceService.getCurrentPrice(symbol);
        const positionSize = await this.riskManagement.calculatePositionSize(symbol, currentPrice);

        if (positionSize > 0) {
          await this.binanceService.placeOrder(symbol, 'BUY', 'MARKET', positionSize, currentPrice);
          this.riskManagement.openPosition(symbol, 'BUY', currentPrice, positionSize);
        } else {
          logger.warn(`Insufficient balance to open position for ${symbol}`);
        }
      }
    }
  }

  getStatus(): TradingEngineStatus {
    return {
      isRunning: this.isRunning,
      tradingPairs: this.tradingPairs,
      strategy: this.strategy.name,
      paperTrading: this.binanceService.isPaperTrading(),
      lastCheck: this.lastCheck,
      positions: this.riskManagement.getAllPositions().length,
    };
  }

  getLastSignals(): Map<string, StrategySignal> {
    return new Map(this.lastSignals);
  }

  getRiskManagement(): RiskManagementService {
    return this.riskManagement;
  }

  getBinanceService(): BinanceService {
    return this.binanceService;
  }
}
