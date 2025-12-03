import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface Config {
  binance: {
    apiKey: string;
    apiSecret: string;
  };
  trading: {
    pairs: string[];
    maxRiskPerTrade: number;
    maxOpenPositions: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    trailingStopPercent: number;
    interval: number;
    paperTrading: boolean;
  };
  strategy: {
    type: 'RSI' | 'MACD' | 'EMA_CROSSOVER' | 'COMBINED';
    rsi: {
      period: number;
      oversold: number;
      overbought: number;
    };
    macd: {
      fastPeriod: number;
      slowPeriod: number;
      signalPeriod: number;
    };
    ema: {
      shortPeriod: number;
      longPeriod: number;
    };
  };
  server: {
    port: number;
    nodeEnv: string;
  };
  logging: {
    level: string;
  };
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

type StrategyType = 'RSI' | 'MACD' | 'EMA_CROSSOVER' | 'COMBINED';
const VALID_STRATEGIES: StrategyType[] = ['RSI', 'MACD', 'EMA_CROSSOVER', 'COMBINED'];

function getStrategyType(key: string, defaultValue: StrategyType): StrategyType {
  const value = process.env[key]?.toUpperCase();
  if (value === undefined) {
    return defaultValue;
  }
  if (VALID_STRATEGIES.includes(value as StrategyType)) {
    return value as StrategyType;
  }
  console.warn(`Invalid strategy type "${value}", using default "${defaultValue}"`);
  return defaultValue;
}

export function loadConfig(): Config {
  return {
    binance: {
      apiKey: getEnvVar('BINANCE_API_KEY', ''),
      apiSecret: getEnvVar('BINANCE_API_SECRET', ''),
    },
    trading: {
      pairs: getEnvVar('TRADING_PAIRS', 'BTCUSD,ETHUSD').split(',').map(p => p.trim()),
      maxRiskPerTrade: getEnvNumber('MAX_RISK_PER_TRADE', 2),
      maxOpenPositions: getEnvNumber('MAX_OPEN_POSITIONS', 3),
      stopLossPercent: getEnvNumber('STOP_LOSS_PERCENT', 5),
      takeProfitPercent: getEnvNumber('TAKE_PROFIT_PERCENT', 10),
      trailingStopPercent: getEnvNumber('TRAILING_STOP_PERCENT', 2),
      interval: getEnvNumber('TRADING_INTERVAL', 60000),
      paperTrading: getEnvBoolean('PAPER_TRADING', true),
    },
    strategy: {
      type: getStrategyType('STRATEGY', 'COMBINED'),
      rsi: {
        period: getEnvNumber('RSI_PERIOD', 14),
        oversold: getEnvNumber('RSI_OVERSOLD', 30),
        overbought: getEnvNumber('RSI_OVERBOUGHT', 70),
      },
      macd: {
        fastPeriod: getEnvNumber('MACD_FAST_PERIOD', 12),
        slowPeriod: getEnvNumber('MACD_SLOW_PERIOD', 26),
        signalPeriod: getEnvNumber('MACD_SIGNAL_PERIOD', 9),
      },
      ema: {
        shortPeriod: getEnvNumber('EMA_SHORT_PERIOD', 9),
        longPeriod: getEnvNumber('EMA_LONG_PERIOD', 21),
      },
    },
    server: {
      port: getEnvNumber('PORT', 3000),
      nodeEnv: getEnvVar('NODE_ENV', 'development'),
    },
    logging: {
      level: getEnvVar('LOG_LEVEL', 'info'),
    },
  };
}

export const config = loadConfig();
