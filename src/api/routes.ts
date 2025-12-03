import { Request, Response, Router } from 'express';
import { TradingEngine } from '../services/trading-engine';
import { logger } from '../utils/logger';

export function createApiRouter(tradingEngine: TradingEngine): Router {
  const router = Router();

  // Health check
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get bot status
  router.get('/status', (_req: Request, res: Response) => {
    try {
      const status = tradingEngine.getStatus();
      res.json(status);
    } catch (error) {
      logger.error('Error getting status', error);
      res.status(500).json({ error: 'Failed to get status' });
    }
  });

  // Start trading
  router.post('/start', async (_req: Request, res: Response) => {
    try {
      await tradingEngine.start();
      res.json({ message: 'Trading engine started', status: tradingEngine.getStatus() });
    } catch (error) {
      logger.error('Error starting trading engine', error);
      res.status(500).json({ error: 'Failed to start trading engine' });
    }
  });

  // Stop trading
  router.post('/stop', async (_req: Request, res: Response) => {
    try {
      await tradingEngine.stop();
      res.json({ message: 'Trading engine stopped', status: tradingEngine.getStatus() });
    } catch (error) {
      logger.error('Error stopping trading engine', error);
      res.status(500).json({ error: 'Failed to stop trading engine' });
    }
  });

  // Get account balances
  router.get('/balances', async (_req: Request, res: Response) => {
    try {
      const binanceService = tradingEngine.getBinanceService();
      const balances = await binanceService.getAccountBalances();
      // Filter out zero balances
      const nonZeroBalances = balances.filter(b => b.free > 0 || b.locked > 0);
      res.json(nonZeroBalances);
    } catch (error) {
      logger.error('Error getting balances', error);
      res.status(500).json({ error: 'Failed to get balances' });
    }
  });

  // Get open positions
  router.get('/positions', (_req: Request, res: Response) => {
    try {
      const riskManagement = tradingEngine.getRiskManagement();
      const positions = riskManagement.getAllPositions();
      res.json(positions);
    } catch (error) {
      logger.error('Error getting positions', error);
      res.status(500).json({ error: 'Failed to get positions' });
    }
  });

  // Get trade history
  router.get('/trades', (_req: Request, res: Response) => {
    try {
      const riskManagement = tradingEngine.getRiskManagement();
      const trades = riskManagement.getTradeHistory();
      res.json(trades);
    } catch (error) {
      logger.error('Error getting trade history', error);
      res.status(500).json({ error: 'Failed to get trade history' });
    }
  });

  // Get trading statistics
  router.get('/stats', (_req: Request, res: Response) => {
    try {
      const riskManagement = tradingEngine.getRiskManagement();
      const stats = riskManagement.getTradingStats();
      res.json(stats);
    } catch (error) {
      logger.error('Error getting trading stats', error);
      res.status(500).json({ error: 'Failed to get trading stats' });
    }
  });

  // Get current signals
  router.get('/signals', (_req: Request, res: Response) => {
    try {
      const signals = tradingEngine.getLastSignals();
      const signalsObj: Record<string, unknown> = {};
      signals.forEach((value, key) => {
        signalsObj[key] = value;
      });
      res.json(signalsObj);
    } catch (error) {
      logger.error('Error getting signals', error);
      res.status(500).json({ error: 'Failed to get signals' });
    }
  });

  return router;
}
