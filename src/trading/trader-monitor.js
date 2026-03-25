const Logger = require('../utils/logger');

const logger = new Logger('trader-monitor');

class TraderMonitor {
  constructor(client, db) {
    this.client = client;
    this.db = db;
    this.topTraders = [];
    this.traderCache = {};
    this.updateInterval = parseInt(process.env.CHECK_INTERVAL_MS || 5000);
    this.running = false;
    this.monitorTimer = null;
  }

  async start() {
    if (this.running) {
      logger.warn('⚠️  Monitor already running');
      return;
    }

    logger.info('▶️  Starting Trader Monitor');
    this.running = true;

    try {
      await this.updateTopTraders();
      this.monitorTimer = setInterval(
        () => this.updateTopTraders(),
        this.updateInterval
      );
      logger.info(`✅ Monitoring top 3 traders every ${this.updateInterval}ms`);
    } catch (error) {
      logger.error('Failed to start monitor:', error);
      this.running = false;
      throw error;
    }
  }

  async stop() {
    logger.info('⏸️  Stopping Trader Monitor');
    this.running = false;

    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }

    logger.info('✅ Monitor stopped');
  }

  async updateTopTraders() {
    try {
      const leaderboard = await this.client.getLeaderboard('month');
      this.topTraders = leaderboard.slice(0, 3);
      logger.info(`📊 Updated top traders: ${this.topTraders.map(t => t.username).join(', ')}`);

      for (const trader of this.topTraders) {
        await this.db.run(
          `INSERT OR REPLACE INTO top_traders 
           (trader_id, username, rank, profit, win_rate, trade_count, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            trader.userId,
            trader.username,
            trader.rank,
            trader.profit,
            trader.winRate,
            trader.tradeCount,
            new Date().toISOString()
          ]
        );
      }

      return this.topTraders;
    } catch (error) {
      logger.error('Failed to update top traders:', error);
      throw error;
    }
  }

  getTopTraders() {
    return this.topTraders;
  }

  async getTraderDetails(traderId) {
    if (this.traderCache[traderId]) {
      return this.traderCache[traderId];
    }

    try {
      const trades = await this.client.getUserTrades(traderId, 20);
      this.traderCache[traderId] = trades;
      return trades;
    } catch (error) {
      logger.error(`Failed to fetch trades for ${traderId}:`, error);
      return [];
    }
  }

  async getTraderRecentTrades(traderId, limit = 10) {
    try {
      const trades = await this.getTraderDetails(traderId);
      return trades.slice(0, limit);
    } catch (error) {
      logger.error('Failed to get recent trades:', error);
      return [];
    }
  }

  isTraderActive(traderId) {
    const trades = this.traderCache[traderId] || [];
    if (trades.length === 0) return false;
    const lastTrade = trades[0];
    const minutesAgo = (Date.now() - new Date(lastTrade.timestamp).getTime()) / (1000 * 60);
    return minutesAgo < 5;
  }

  async getTradersOverview() {
    const overview = [];
    for (const trader of this.topTraders) {
      const trades = await this.getTraderDetails(trader.userId);
      overview.push({
        ...trader,
        recentTrades: trades.slice(0, 5),
        isActive: this.isTraderActive(trader.userId),
        lastTradeTime: trades.length > 0 ? trades[0].timestamp : null
      });
    }
    return overview;
  }

  clearCache() {
    this.traderCache = {};
  }

  getStatistics() {
    return {
      topTradersCount: this.topTraders.length,
      topTraders: this.topTraders.map(t => ({
        name: t.username,
        profit: t.profit,
        winRate: t.winRate,
        trades: t.tradeCount
      })),
      cacheSize: Object.keys(this.traderCache).length,
      running: this.running
    };
  }
}

module.exports = TraderMonitor;
