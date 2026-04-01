const Logger = require('../utils/logger');

const logger = new Logger('position-tracker');

class PositionTracker {
  constructor(db, client) {
    this.db = db;
    this.client = client;
    this.positions = [];
    this.dailyPnL = 0;
    this.winCount = 0;
    this.lossCount = 0;
    this.running = false;
    this.updateTimer = null;
    this.checkInterval = parseInt(process.env.CHECK_INTERVAL_MS || 5000);
  }

  async start() {
    if (this.running) {
      logger.warn('⚠️  Position tracker already running');
      return;
    }

    logger.info('▶️  Starting Position Tracker');
    this.running = true;

    try {
      await this.updatePositions();
      this.updateTimer = setInterval(
        () => this.updatePositions(),
        this.checkInterval
      );
      logger.info('✅ Position tracker running');
    } catch (error) {
      logger.error('Failed to start position tracker:', error);
      this.running = false;
      throw error;
    }
  }

  async stop() {
    logger.info('⏸️  Stopping Position Tracker');
    this.running = false;

    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    logger.info('✅ Position tracker stopped');
  }

  async updatePositions() {
    try {
      const portfolio = await this.client.getPortfolio();

      this.positions = portfolio.map(pos => ({
        ticker: pos.ticker,
        side: pos.side,
        quantity: pos.quantity,
        entryPrice: pos.entry_price,
        currentPrice: pos.current_price,
        unrealizedPnL: pos.unrealized_pnl,
        percentChange: pos.percent_change,
        timestamp: new Date().toISOString()
      }));

      await this.calculateDailyPnL();
      return this.positions;
    } catch (error) {
      logger.error('Failed to update positions:', error);
      return this.positions;
    }
  }

  async calculateDailyPnL() {
    try {
      const today = new Date().toISOString().split('T')[0];

      const result = await this.db.get(
        `SELECT 
          SUM(pnl) as total_pnl,
          COUNT(*) as total_trades,
          SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
          SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses
        FROM trade_history 
        WHERE DATE(timestamp) = ?`,
        [today]
      );

      this.dailyPnL = result?.total_pnl || 0;
      this.winCount = result?.wins || 0;
      this.lossCount = result?.losses || 0;

      return {
        dailyPnL: this.dailyPnL,
        winRate: this.getWinRate(),
        totalTrades: result?.total_trades || 0
      };
    } catch (error) {
      logger.error('Failed to calculate daily P&L:', error);
      return { dailyPnL: 0, winRate: 0, totalTrades: 0 };
    }
  }

  getOpenPositions() {
    return this.positions.filter(p => p.quantity > 0);
  }

  getDailyPnL() {
    return this.dailyPnL;
  }

  getWinRate() {
    const total = this.winCount + this.lossCount;
    if (total === 0) return 0;
    return this.winCount / total;
  }

  async getPortfolioSummary() {
    try {
      const balance = await this.client.getBalance();
      const positions = this.getOpenPositions();

      const totalEquity = positions.reduce((sum, pos) => {
        return sum + (pos.currentPrice * pos.quantity);
      }, 0);

      return {
        balance: balance.balance / 100,
        equity: totalEquity,
        totalValue: (balance.balance / 100) + totalEquity,
        positions: positions.length,
        dailyPnL: this.dailyPnL,
        winRate: this.getWinRate(),
        winCount: this.winCount,
        lossCount: this.lossCount
      };
    } catch (error) {
      logger.error('Failed to get portfolio summary:', error);
      throw error;
    }
  }

  async recordClosedTrade(ticker, entryPrice, exitPrice, quantity, side) {
    try {
      const pnl = side === 'yes'
        ? (exitPrice - entryPrice) * quantity
        : (entryPrice - exitPrice) * quantity;

      await this.db.run(
        `INSERT INTO trade_history 
         (ticker, side, quantity, entry_price, exit_price, pnl, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ticker, side, quantity, entryPrice, exitPrice, pnl, new Date().toISOString()]
      );

      logger.info(`📊 Trade recorded: ${ticker} PnL: $${(pnl / 100).toFixed(2)}`);
      
      if (pnl > 0) this.winCount++;
      if (pnl < 0) this.lossCount++;

      return { success: true, pnl };
    } catch (error) {
      logger.error('Failed to record trade:', error);
      throw error;
    }
  }

  getPosition(ticker) {
    return this.positions.find(p => p.ticker === ticker);
  }

  getStatistics() {
    return {
      openPositions: this.getOpenPositions().length,
      dailyPnL: this.dailyPnL,
      winRate: this.getWinRate(),
      wins: this.winCount,
      losses: this.lossCount,
      running: this.running
    };
  }
}

module.exports = PositionTracker;
