import { config } from './config';
import { logger } from './utils/logger';
import { TradingEngine } from './services/trading-engine';
import { startServer } from './api/server';

async function main(): Promise<void> {
  logger.info('='.repeat(50));
  logger.info('  Crypto Trading Bot Starting...');
  logger.info('='.repeat(50));

  // Log configuration
  logger.info(`Environment: ${config.server.nodeEnv}`);
  logger.info(`Paper Trading: ${config.trading.paperTrading}`);
  logger.info(`Strategy: ${config.strategy.type}`);
  logger.info(`Trading Pairs: ${config.trading.pairs.join(', ')}`);
  logger.info(`Max Risk Per Trade: ${config.trading.maxRiskPerTrade}%`);
  logger.info(`Stop Loss: ${config.trading.stopLossPercent}%`);
  logger.info(`Take Profit: ${config.trading.takeProfitPercent}%`);

  // Create trading engine
  const tradingEngine = new TradingEngine();

  // Start the server
  startServer(tradingEngine);

  // Handle graceful shutdown
  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down...');
    await tradingEngine.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('');
  logger.info('Bot is ready. Use the dashboard or API to control trading.');
  logger.info(`Dashboard: http://localhost:${config.server.port}`);
  logger.info(`API: http://localhost:${config.server.port}/api`);
  logger.info('');
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
