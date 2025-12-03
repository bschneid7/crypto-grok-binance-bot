import express, { Application } from 'express';
import cors from 'cors';
import path from 'path';
import { config } from '../config';
import { logger } from '../utils/logger';
import { TradingEngine } from '../services/trading-engine';
import { createApiRouter } from './routes';

export function createServer(tradingEngine: TradingEngine): Application {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api', createApiRouter(tradingEngine));

  // Serve static dashboard files
  app.use(express.static(path.join(__dirname, '../dashboard')));

  // Fallback to dashboard index
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../dashboard/index.html'));
  });

  return app;
}

export function startServer(tradingEngine: TradingEngine): void {
  const app = createServer(tradingEngine);
  const port = config.server.port;

  app.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`);
    logger.info(`Dashboard available at http://localhost:${port}`);
    logger.info(`API available at http://localhost:${port}/api`);
  });
}
