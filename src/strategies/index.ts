import { Candle, StrategySignal, TradeSignal } from '../models';
import { config } from '../config';

// Import technical indicators
import { RSI, MACD, EMA } from 'technicalindicators';

export interface Strategy {
  name: string;
  analyze(candles: Candle[]): StrategySignal;
}

export class RSIStrategy implements Strategy {
  name = 'RSI';
  private period: number;
  private oversold: number;
  private overbought: number;

  constructor() {
    this.period = config.strategy.rsi.period;
    this.oversold = config.strategy.rsi.oversold;
    this.overbought = config.strategy.rsi.overbought;
  }

  analyze(candles: Candle[]): StrategySignal {
    const closePrices = candles.map(c => c.close);
    
    const rsiValues = RSI.calculate({
      values: closePrices,
      period: this.period,
    });

    if (rsiValues.length === 0) {
      return {
        signal: 'HOLD',
        confidence: 0,
        reasons: ['Insufficient data for RSI calculation'],
        indicators: {},
      };
    }

    const currentRSI = rsiValues[rsiValues.length - 1];
    let signal: TradeSignal = 'HOLD';
    let confidence = 0;
    const reasons: string[] = [];

    if (currentRSI <= this.oversold) {
      signal = 'BUY';
      confidence = Math.min(100, (this.oversold - currentRSI) * 5 + 50);
      reasons.push(`RSI is oversold at ${currentRSI.toFixed(2)} (below ${this.oversold})`);
    } else if (currentRSI >= this.overbought) {
      signal = 'SELL';
      confidence = Math.min(100, (currentRSI - this.overbought) * 5 + 50);
      reasons.push(`RSI is overbought at ${currentRSI.toFixed(2)} (above ${this.overbought})`);
    } else {
      reasons.push(`RSI at ${currentRSI.toFixed(2)} is in neutral zone`);
    }

    return {
      signal,
      confidence,
      reasons,
      indicators: { rsi: currentRSI },
    };
  }
}

export class MACDStrategy implements Strategy {
  name = 'MACD';
  private fastPeriod: number;
  private slowPeriod: number;
  private signalPeriod: number;

  constructor() {
    this.fastPeriod = config.strategy.macd.fastPeriod;
    this.slowPeriod = config.strategy.macd.slowPeriod;
    this.signalPeriod = config.strategy.macd.signalPeriod;
  }

  analyze(candles: Candle[]): StrategySignal {
    const closePrices = candles.map(c => c.close);

    const macdResults = MACD.calculate({
      values: closePrices,
      fastPeriod: this.fastPeriod,
      slowPeriod: this.slowPeriod,
      signalPeriod: this.signalPeriod,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    if (macdResults.length < 2) {
      return {
        signal: 'HOLD',
        confidence: 0,
        reasons: ['Insufficient data for MACD calculation'],
        indicators: {},
      };
    }

    const current = macdResults[macdResults.length - 1];
    const previous = macdResults[macdResults.length - 2];

    if (!current.MACD || !current.signal || !current.histogram ||
        !previous.MACD || !previous.signal || !previous.histogram) {
      return {
        signal: 'HOLD',
        confidence: 0,
        reasons: ['MACD values not available'],
        indicators: {},
      };
    }

    let signal: TradeSignal = 'HOLD';
    let confidence = 0;
    const reasons: string[] = [];

    // Bullish crossover: MACD crosses above signal line
    if (previous.MACD < previous.signal && current.MACD > current.signal) {
      signal = 'BUY';
      confidence = Math.min(100, Math.abs(current.histogram) * 100 + 50);
      reasons.push('MACD bullish crossover detected');
    }
    // Bearish crossover: MACD crosses below signal line
    else if (previous.MACD > previous.signal && current.MACD < current.signal) {
      signal = 'SELL';
      confidence = Math.min(100, Math.abs(current.histogram) * 100 + 50);
      reasons.push('MACD bearish crossover detected');
    } else {
      reasons.push(`MACD histogram at ${current.histogram.toFixed(4)}`);
    }

    return {
      signal,
      confidence,
      reasons,
      indicators: {
        macd: {
          value: current.MACD,
          signal: current.signal,
          histogram: current.histogram,
        },
      },
    };
  }
}

export class EMACrossoverStrategy implements Strategy {
  name = 'EMA_CROSSOVER';
  private shortPeriod: number;
  private longPeriod: number;

  constructor() {
    this.shortPeriod = config.strategy.ema.shortPeriod;
    this.longPeriod = config.strategy.ema.longPeriod;
  }

  analyze(candles: Candle[]): StrategySignal {
    const closePrices = candles.map(c => c.close);

    const shortEMA = EMA.calculate({
      values: closePrices,
      period: this.shortPeriod,
    });

    const longEMA = EMA.calculate({
      values: closePrices,
      period: this.longPeriod,
    });

    if (shortEMA.length < 2 || longEMA.length < 2) {
      return {
        signal: 'HOLD',
        confidence: 0,
        reasons: ['Insufficient data for EMA calculation'],
        indicators: {},
      };
    }

    // Align the EMAs (they have different starting points)
    const currentShort = shortEMA[shortEMA.length - 1];
    const previousShort = shortEMA[shortEMA.length - 2];
    const currentLong = longEMA[longEMA.length - 1];
    const previousLong = longEMA[longEMA.length - 2];

    let signal: TradeSignal = 'HOLD';
    let confidence = 0;
    const reasons: string[] = [];

    // Golden cross: Short EMA crosses above Long EMA
    if (previousShort <= previousLong && currentShort > currentLong) {
      signal = 'BUY';
      const crossStrength = ((currentShort - currentLong) / currentLong) * 100;
      confidence = Math.min(100, crossStrength * 50 + 50);
      reasons.push(`Golden cross: EMA(${this.shortPeriod}) crossed above EMA(${this.longPeriod})`);
    }
    // Death cross: Short EMA crosses below Long EMA
    else if (previousShort >= previousLong && currentShort < currentLong) {
      signal = 'SELL';
      const crossStrength = ((currentLong - currentShort) / currentShort) * 100;
      confidence = Math.min(100, crossStrength * 50 + 50);
      reasons.push(`Death cross: EMA(${this.shortPeriod}) crossed below EMA(${this.longPeriod})`);
    } else if (currentShort > currentLong) {
      reasons.push(`EMA(${this.shortPeriod}) is above EMA(${this.longPeriod}) - bullish trend`);
    } else {
      reasons.push(`EMA(${this.shortPeriod}) is below EMA(${this.longPeriod}) - bearish trend`);
    }

    return {
      signal,
      confidence,
      reasons,
      indicators: {
        ema: {
          short: currentShort,
          long: currentLong,
        },
      },
    };
  }
}

export class CombinedStrategy implements Strategy {
  name = 'COMBINED';
  private rsiStrategy: RSIStrategy;
  private macdStrategy: MACDStrategy;
  private emaCrossoverStrategy: EMACrossoverStrategy;

  constructor() {
    this.rsiStrategy = new RSIStrategy();
    this.macdStrategy = new MACDStrategy();
    this.emaCrossoverStrategy = new EMACrossoverStrategy();
  }

  analyze(candles: Candle[]): StrategySignal {
    const rsiSignal = this.rsiStrategy.analyze(candles);
    const macdSignal = this.macdStrategy.analyze(candles);
    const emaSignal = this.emaCrossoverStrategy.analyze(candles);

    const signals = [rsiSignal, macdSignal, emaSignal];
    const reasons: string[] = [];
    
    let buyCount = 0;
    let sellCount = 0;
    let totalConfidence = 0;

    for (const s of signals) {
      reasons.push(...s.reasons);
      if (s.signal === 'BUY') {
        buyCount++;
        totalConfidence += s.confidence;
      } else if (s.signal === 'SELL') {
        sellCount++;
        totalConfidence += s.confidence;
      }
    }

    let signal: TradeSignal = 'HOLD';
    let confidence = 0;

    // Require at least 2 out of 3 indicators to agree for a trade signal
    if (buyCount >= 2) {
      signal = 'BUY';
      confidence = totalConfidence / buyCount;
      reasons.unshift(`${buyCount}/3 strategies indicate BUY`);
    } else if (sellCount >= 2) {
      signal = 'SELL';
      confidence = totalConfidence / sellCount;
      reasons.unshift(`${sellCount}/3 strategies indicate SELL`);
    } else {
      reasons.unshift('Mixed signals - holding position');
    }

    return {
      signal,
      confidence,
      reasons,
      indicators: {
        rsi: rsiSignal.indicators.rsi,
        macd: macdSignal.indicators.macd,
        ema: emaSignal.indicators.ema,
      },
    };
  }
}

export function createStrategy(type: string): Strategy {
  switch (type) {
    case 'RSI':
      return new RSIStrategy();
    case 'MACD':
      return new MACDStrategy();
    case 'EMA_CROSSOVER':
      return new EMACrossoverStrategy();
    case 'COMBINED':
    default:
      return new CombinedStrategy();
  }
}
