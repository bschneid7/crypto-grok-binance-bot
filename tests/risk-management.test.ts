import { RiskManagementService } from '../src/services/risk-management.service';
import { BinanceService } from '../src/services/binance.service';

// Mock the BinanceService
jest.mock('../src/services/binance.service');

describe('RiskManagementService', () => {
  let riskManagement: RiskManagementService;
  let mockBinanceService: jest.Mocked<BinanceService>;

  beforeEach(() => {
    mockBinanceService = new BinanceService() as jest.Mocked<BinanceService>;
    mockBinanceService.getBalance = jest.fn().mockResolvedValue({ asset: 'USD', free: 10000, locked: 0 });
    mockBinanceService.getCurrentPrice = jest.fn().mockResolvedValue(50000);
    
    riskManagement = new RiskManagementService(mockBinanceService);
  });

  describe('Position Management', () => {
    test('should allow opening new position when under limit', () => {
      expect(riskManagement.canOpenNewPosition()).toBe(true);
    });

    test('should track open positions', () => {
      riskManagement.openPosition('BTCUSD', 'BUY', 50000, 0.1);
      
      expect(riskManagement.hasOpenPosition('BTCUSD')).toBe(true);
      expect(riskManagement.getAllPositions().length).toBe(1);
    });

    test('should calculate stop loss and take profit correctly for BUY', () => {
      const position = riskManagement.openPosition('BTCUSD', 'BUY', 50000, 0.1);
      
      // Stop loss should be below entry (default 5%)
      expect(position.stopLoss).toBeCloseTo(47500, 2); // 50000 * 0.95
      // Take profit should be above entry (default 10%)
      expect(position.takeProfit).toBeCloseTo(55000, 2); // 50000 * 1.10
    });

    test('should calculate stop loss and take profit correctly for SELL', () => {
      const position = riskManagement.openPosition('BTCUSD', 'SELL', 50000, 0.1);
      
      // Stop loss should be above entry (default 5%)
      expect(position.stopLoss).toBeCloseTo(52500, 2); // 50000 * 1.05
      // Take profit should be below entry (default 10%)
      expect(position.takeProfit).toBeCloseTo(45000, 2); // 50000 * 0.90
    });

    test('should close position and calculate P&L', () => {
      riskManagement.openPosition('BTCUSD', 'BUY', 50000, 0.1);
      const trade = riskManagement.closePosition('BTCUSD', 55000);
      
      expect(trade).not.toBeNull();
      expect(trade?.realizedPnL).toBe(500); // (55000 - 50000) * 0.1
      expect(trade?.status).toBe('CLOSED');
      expect(riskManagement.hasOpenPosition('BTCUSD')).toBe(false);
    });

    test('should calculate negative P&L for losing trade', () => {
      riskManagement.openPosition('BTCUSD', 'BUY', 50000, 0.1);
      const trade = riskManagement.closePosition('BTCUSD', 45000);
      
      expect(trade?.realizedPnL).toBe(-500); // (45000 - 50000) * 0.1
    });
  });

  describe('Trading Statistics', () => {
    test('should calculate correct stats for winning trades', () => {
      riskManagement.openPosition('BTCUSD', 'BUY', 50000, 0.1);
      riskManagement.closePosition('BTCUSD', 55000);
      
      riskManagement.openPosition('ETHUSD', 'BUY', 2000, 1);
      riskManagement.closePosition('ETHUSD', 2200);
      
      const stats = riskManagement.getTradingStats();
      
      expect(stats.totalTrades).toBe(2);
      expect(stats.winningTrades).toBe(2);
      expect(stats.losingTrades).toBe(0);
      expect(stats.winRate).toBe(100);
      expect(stats.totalPnL).toBe(700); // 500 + 200
    });

    test('should calculate correct stats for mixed trades', () => {
      riskManagement.openPosition('BTCUSD', 'BUY', 50000, 0.1);
      riskManagement.closePosition('BTCUSD', 55000); // Win $500
      
      riskManagement.openPosition('ETHUSD', 'BUY', 2000, 1);
      riskManagement.closePosition('ETHUSD', 1800); // Loss -$200
      
      const stats = riskManagement.getTradingStats();
      
      expect(stats.totalTrades).toBe(2);
      expect(stats.winningTrades).toBe(1);
      expect(stats.losingTrades).toBe(1);
      expect(stats.winRate).toBe(50);
      expect(stats.totalPnL).toBe(300); // 500 - 200
    });

    test('should return empty stats when no trades', () => {
      const stats = riskManagement.getTradingStats();
      
      expect(stats.totalTrades).toBe(0);
      expect(stats.winRate).toBe(0);
      expect(stats.totalPnL).toBe(0);
    });
  });

  describe('Position Size Calculation', () => {
    test('should calculate position size based on risk', async () => {
      const positionSize = await riskManagement.calculatePositionSize('BTCUSD', 50000);
      
      // With $10,000 balance, 2% risk = $200 max risk
      // With 5% stop loss, position size = $200 / ($50000 * 0.05) = 0.08
      expect(positionSize).toBeCloseTo(0.08, 2);
    });

    test('should return 0 when no balance', async () => {
      mockBinanceService.getBalance = jest.fn().mockResolvedValue(undefined);
      
      const positionSize = await riskManagement.calculatePositionSize('BTCUSD', 50000);
      
      expect(positionSize).toBe(0);
    });
  });

  describe('Trade History', () => {
    test('should maintain trade history', () => {
      riskManagement.openPosition('BTCUSD', 'BUY', 50000, 0.1);
      riskManagement.openPosition('ETHUSD', 'BUY', 2000, 1);
      
      const history = riskManagement.getTradeHistory();
      
      expect(history.length).toBe(2);
      expect(history[0].symbol).toBe('BTCUSD');
      expect(history[1].symbol).toBe('ETHUSD');
    });
  });
});
