const dotenv = require('dotenv');
const Logger = require('./utils/logger');
const ConfigManager = require('./config/config-manager');
const KalshiClient = require('./api/kalshi-client');
const TraderMonitor = require('./trading/trader-monitor');
const MirrorEngine = require('./trading/mirror-engine');
const PositionTracker = require('./trading/position-tracker');
const Database = require('./db/database');
const DashboardServer = require('./dashboard-server');

dotenv.config();
const logger = new Logger('kalshi-bot');

class KalshiBot {
  constructor() {
    this.config = null;
    this.client = null;
    this.monitor = null;
    this.mirror = null;
    this.positions = null;
    this.db = null;
    this.dashboard = null;
    this.running = false;
  }

  async initialize() {
    try {
      logger.info('🚀 Initializing Kalshi Trading Bot...');
      this.config = new ConfigManager();
      await this.config.load();
      logger.info('✅ Configuration loaded');

      this.db = new Database();
      await this.db.initialize();
      logger.info('✅ Database initialized');

      const baseUrl = process.env.DEMO_MODE === 'true'
        ? process.env.KALSHI_DEMO_BASE
        : process.env.KALSHI_API_BASE;

      this.client = new KalshiClient({
        baseUrl,
        apiKey: this.config.getApiKey(),
        apiSecret: this.config.getApiSecret(),
        demoMode: process.env.DEMO_MODE === 'true'
      });

      const balance = await this.client.getBalance();
      logger.info(`✅ Connected to Kalshi. Balance: $${balance.balance / 100}`);

      this.positions = new PositionTracker(this.db, this.client);
      this.monitor = new TraderMonitor(this.client, this.db);
      this.mirror = new MirrorEngine(
        this.client,
        this.monitor,
        this.positions,
        this.db
      );

      this.dashboard = new DashboardServer(
        this.db,
        this.positions,
        this.monitor,
        parseInt(process.env.DASHBOARD_PORT || 3001)
      );
      await this.dashboard.start();
      logger.info(`✅ Dashboard started on port ${process.env.DASHBOARD_PORT || 3001}`);

      await this.mirror.startServer();
      logger.info('✅ Kalshi Bot fully initialized');
      return true;
    } catch (error) {
      logger.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  async start() {
    if (this.running) {
      logger.warn('⚠️  Bot is already running');
      return;
    }

    try {
      logger.info('▶️  Starting Kalshi Trading Bot');
      this.running = true;

      await this.monitor.start();
      await this.mirror.start();
      await this.positions.start();

      logger.info('✅ Bot is running - press Ctrl+C to stop');
      
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());
    } catch (error) {
      logger.error('❌ Failed to start bot:', error);
      this.running = false;
      throw error;
    }
  }

  async stop() {
    if (!this.running) return;

    try {
      logger.info('⏸️  Stopping Kalshi Trading Bot');
      this.running = false;

      if (this.mirror) await this.mirror.stop();
      if (this.monitor) await this.monitor.stop();
      if (this.positions) await this.positions.stop();
      if (this.dashboard) await this.dashboard.stop();
      if (this.db) await this.db.close();

      logger.info('✅ Bot stopped gracefully');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error stopping bot:', error);
      process.exit(1);
    }
  }

  getStatus() {
    return {
      running: this.running,
      mode: process.env.DEMO_MODE === 'true' ? 'demo' : 'live',
      dashboard: `http://localhost:${process.env.DASHBOARD_PORT || 3001}`,
      topTraders: this.monitor?.getTopTraders() || [],
      positions: this.positions?.getOpenPositions() || [],
      dailyPnL: this.positions?.getDailyPnL() || 0,
      winRate: this.positions?.getWinRate() || 0
    };
  }
}

async function main() {
  const bot = new KalshiBot();
  try {
    await bot.initialize();
    await bot.start();
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = KalshiBot;
