import { RSIStrategy, MACDStrategy, EMACrossoverStrategy, CombinedStrategy, createStrategy } from '../src/strategies';
import { Candle } from '../src/models';

// Helper function to create mock candles
function createMockCandles(closePrices: number[]): Candle[] {
  return closePrices.map((close, i) => ({
    openTime: Date.now() - (closePrices.length - i) * 3600000,
    open: close * 0.99,
    high: close * 1.02,
    low: close * 0.98,
    close,
    volume: 1000,
    closeTime: Date.now() - (closePrices.length - i - 1) * 3600000,
  }));
}

// Generate realistic price data with trend
function generateTrendingPrices(start: number, count: number, trend: 'up' | 'down' | 'sideways'): number[] {
  const prices: number[] = [];
  let price = start;
  
  for (let i = 0; i < count; i++) {
    const noise = (Math.random() - 0.5) * start * 0.01;
    switch (trend) {
      case 'up':
        price += start * 0.005 + noise;
        break;
      case 'down':
        price -= start * 0.005 + noise;
        break;
      case 'sideways':
        price += noise;
        break;
    }
    prices.push(price);
  }
  
  return prices;
}

describe('RSIStrategy', () => {
  let strategy: RSIStrategy;

  beforeEach(() => {
    strategy = new RSIStrategy();
  });

  test('should return HOLD when insufficient data', () => {
    const candles = createMockCandles([100, 101, 102]);
    const signal = strategy.analyze(candles);
    
    expect(signal.signal).toBe('HOLD');
    expect(signal.confidence).toBe(0);
  });

  test('should return valid signal with sufficient data', () => {
    const prices = generateTrendingPrices(100, 50, 'sideways');
    const candles = createMockCandles(prices);
    const signal = strategy.analyze(candles);
    
    expect(['BUY', 'SELL', 'HOLD']).toContain(signal.signal);
    expect(signal.reasons.length).toBeGreaterThan(0);
    expect(signal.indicators.rsi).toBeDefined();
  });

  test('should return BUY signal for oversold conditions', () => {
    // Create a strong downtrend to push RSI into oversold territory
    const prices = generateTrendingPrices(100, 50, 'down');
    const candles = createMockCandles(prices);
    const signal = strategy.analyze(candles);
    
    // RSI should be calculated
    expect(signal.indicators.rsi).toBeDefined();
    // With strong downtrend, RSI should be low
    if (signal.indicators.rsi && signal.indicators.rsi < 30) {
      expect(signal.signal).toBe('BUY');
    }
  });
});

describe('MACDStrategy', () => {
  let strategy: MACDStrategy;

  beforeEach(() => {
    strategy = new MACDStrategy();
  });

  test('should return HOLD when insufficient data', () => {
    const candles = createMockCandles([100, 101, 102]);
    const signal = strategy.analyze(candles);
    
    expect(signal.signal).toBe('HOLD');
  });

  test('should return valid signal with sufficient data', () => {
    const prices = generateTrendingPrices(100, 50, 'up');
    const candles = createMockCandles(prices);
    const signal = strategy.analyze(candles);
    
    expect(['BUY', 'SELL', 'HOLD']).toContain(signal.signal);
    expect(signal.reasons.length).toBeGreaterThan(0);
  });
});

describe('EMACrossoverStrategy', () => {
  let strategy: EMACrossoverStrategy;

  beforeEach(() => {
    strategy = new EMACrossoverStrategy();
  });

  test('should return HOLD when insufficient data', () => {
    const candles = createMockCandles([100, 101, 102]);
    const signal = strategy.analyze(candles);
    
    expect(signal.signal).toBe('HOLD');
  });

  test('should return valid signal with sufficient data', () => {
    const prices = generateTrendingPrices(100, 50, 'up');
    const candles = createMockCandles(prices);
    const signal = strategy.analyze(candles);
    
    expect(['BUY', 'SELL', 'HOLD']).toContain(signal.signal);
    expect(signal.reasons.length).toBeGreaterThan(0);
    expect(signal.indicators.ema).toBeDefined();
  });
});

describe('CombinedStrategy', () => {
  let strategy: CombinedStrategy;

  beforeEach(() => {
    strategy = new CombinedStrategy();
  });

  test('should combine signals from all strategies', () => {
    const prices = generateTrendingPrices(100, 50, 'up');
    const candles = createMockCandles(prices);
    const signal = strategy.analyze(candles);
    
    expect(['BUY', 'SELL', 'HOLD']).toContain(signal.signal);
    expect(signal.reasons.length).toBeGreaterThan(0);
    // Combined strategy should have all indicators
    expect(signal.indicators.rsi).toBeDefined();
  });
});

describe('createStrategy', () => {
  test('should create RSI strategy', () => {
    const strategy = createStrategy('RSI');
    expect(strategy.name).toBe('RSI');
  });

  test('should create MACD strategy', () => {
    const strategy = createStrategy('MACD');
    expect(strategy.name).toBe('MACD');
  });

  test('should create EMA_CROSSOVER strategy', () => {
    const strategy = createStrategy('EMA_CROSSOVER');
    expect(strategy.name).toBe('EMA_CROSSOVER');
  });

  test('should create COMBINED strategy by default', () => {
    const strategy = createStrategy('COMBINED');
    expect(strategy.name).toBe('COMBINED');
  });

  test('should create COMBINED strategy for unknown type', () => {
    const strategy = createStrategy('UNKNOWN');
    expect(strategy.name).toBe('COMBINED');
  });
});
