import { loadConfig } from '../src/config';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should load default config values', () => {
    const config = loadConfig();
    
    expect(config.trading.maxRiskPerTrade).toBe(2);
    expect(config.trading.maxOpenPositions).toBe(3);
    expect(config.trading.stopLossPercent).toBe(5);
    expect(config.trading.takeProfitPercent).toBe(10);
    expect(config.trading.paperTrading).toBe(true);
    expect(config.strategy.type).toBe('COMBINED');
    expect(config.server.port).toBe(3000);
  });

  test('should parse trading pairs correctly', () => {
    process.env.TRADING_PAIRS = 'BTCUSD,ETHUSD,SOLUSD';
    const config = loadConfig();
    
    expect(config.trading.pairs).toEqual(['BTCUSD', 'ETHUSD', 'SOLUSD']);
  });

  test('should parse boolean values', () => {
    process.env.PAPER_TRADING = 'false';
    const config = loadConfig();
    
    expect(config.trading.paperTrading).toBe(false);
  });

  test('should parse numeric values', () => {
    process.env.MAX_RISK_PER_TRADE = '5';
    process.env.STOP_LOSS_PERCENT = '3';
    process.env.PORT = '8080';
    
    const config = loadConfig();
    
    expect(config.trading.maxRiskPerTrade).toBe(5);
    expect(config.trading.stopLossPercent).toBe(3);
    expect(config.server.port).toBe(8080);
  });

  test('should have RSI default config', () => {
    const config = loadConfig();
    
    expect(config.strategy.rsi.period).toBe(14);
    expect(config.strategy.rsi.oversold).toBe(30);
    expect(config.strategy.rsi.overbought).toBe(70);
  });

  test('should have MACD default config', () => {
    const config = loadConfig();
    
    expect(config.strategy.macd.fastPeriod).toBe(12);
    expect(config.strategy.macd.slowPeriod).toBe(26);
    expect(config.strategy.macd.signalPeriod).toBe(9);
  });

  test('should have EMA default config', () => {
    const config = loadConfig();
    
    expect(config.strategy.ema.shortPeriod).toBe(9);
    expect(config.strategy.ema.longPeriod).toBe(21);
  });
});
