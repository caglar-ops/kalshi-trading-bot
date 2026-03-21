const express = require('express');
const Logger = require('../utils/logger');

const logger = new Logger('mirror-engine');

class MirrorEngine {
  constructor(client, monitor, positions, db) {
    this.client = client;
    this.monitor = monitor;
    this.positions = positions;
    this.db = db;
    this.running = false;
    this.mirrorTimer = null;
    this.server = null;
    this.app = express();
    this.mirroredTrades = [];
    this.maxPositionSize = parseFloat(process.env.MAX_POSITION_SIZE || 0.25);
    this.mirrorDelayMs = parseInt(process.env.MIRROR_DELAY_MS || 500);
    this.checkInterval = parseInt(process.env.CHECK_INTERVAL_MS || 5000);
  }

  async start() {
    if (this.running) {
      logger.warn('⚠️  Mirror engine already running');
      return;
    }

    logger.info('▶️  Starting Mirror Trading Engine');
    this.running = true;

    try {
      this.mirrorTimer = setInterval(
        () => this.checkAndMirrorTrades(),
        this.checkInterval
      );
      logger.info(`✅ Mirror engine active - checking every ${this.checkInterval}ms`);
    } catch (error) {
      logger.error('Failed to start mirror engine:', error);
      this.running = false;
      throw error;
    }
  }

  async stop() {
    logger.info('⏸️  Stopping Mirror Trading Engine');
    this.running = false;

    if (this.mirrorTimer) {
      clearInterval(this.mirrorTimer);
      this.mirrorTimer = null;
    }

    if (this.server) {
      this.server.close();
    }

    logger.info('✅ Mirror engine stopped');
  }

  async checkAndMirrorTrades() {
    try {
      const topTraders = this.monitor.getTopTraders();

      for (const trader of topTraders) {
        try {
          const recentTrades = await this.monitor.getTraderRecentTrades(trader.userId, 5);

          for (const trade of recentTrades) {
            const isMirrored = await this.db.get(
              'SELECT id FROM mirrored_trades WHERE trader_trade_id = ?',
              [trade.id]
            );

            if (!isMirrored) {
              await this.mirrorTrade(trader, trade);
            }
          }
        } catch (error) {
          logger.error(`Error processing trades from ${trader.username}:`, error);
        }
      }
    } catch (error) {
      logger.error('Error in mirror loop:', error);
    }
  }

  async mirrorTrade(trader, trade) {
    try {
      logger.info(`🪞 Mirroring trade from ${trader.username}: ${trade.ticker} ${trade.side}`);

      const balance = await this.client.getBalance();
      const availableBalance = (balance.balance - balance.pending_deposits) / 100;
      const maxTradeAmount = availableBalance * this.maxPositionSize;
      const tradeAmountUsd = Math.min(trade.quantity * (trade.price || 0.5) * 100, maxTradeAmount * 100);
      const mirrorQuantity = Math.floor(tradeAmountUsd / ((trade.price || 0.5) * 100));

      if (mirrorQuantity <= 0) {
        logger.warn(`⚠️  Insufficient balance to mirror trade. Need $${maxTradeAmount}`);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, this.mirrorDelayMs));

      const orderParams = {
        ticker: trade.ticker,
        side: trade.side,
        quantity: mirrorQuantity,
        yes_price: (trade.price || 0.5) * 100,
        type: 'limit'
      };

      const order = await this.client.createOrder(orderParams);

      await this.db.run(
        `INSERT INTO mirrored_trades 
         (trader_id, trader_name, trader_trade_id, order_id, ticker, side, quantity, price, status, mirrored_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          trader.userId,
          trader.username,
          trade.id,
          order.order_id,
          trade.ticker,
          trade.side,
          mirrorQuantity,
          trade.price || 0.5,
          'executed',
          new Date().toISOString()
        ]
      );

      logger.info(`✅ Trade mirrored successfully: ${trade.ticker} x${mirrorQuantity}`);

      this.mirroredTrades.push({
        tradeId: trade.id,
        orderId: order.order_id,
        ticker: trade.ticker,
        timestamp: new Date(),
        trader: trader.username
      });

      if (this.mirroredTrades.length > 100) {
        this.mirroredTrades = this.mirroredTrades.slice(-100);
      }

      return order;
    } catch (error) {
      logger.error(`Failed to mirror trade from ${trader.username}:`, error);
      throw error;
    }
  }

  async startServer() {
    return new Promise((resolve) => {
      this.app.use(express.json());

      this.app.get('/api/stats', (req, res) => {
        res.json({
          mirrored: this.mirroredTrades.length,
          topTraders: this.monitor.getTopTraders().length,
          running: this.running
        });
      });

      this.app.get('/api/mirrored-trades', (req, res) => {
        res.json(this.mirroredTrades.slice(-20));
      });

      this.app.get('/api/positions', (req, res) => {
        res.json(this.positions.getOpenPositions());
      });

      this.server = this.app.listen(3002, () => {
        logger.info('✅ Mirror engine API started on port 3002');
        resolve();
      });
    });
  }

  getStatistics() {
    return {
      running: this.running,
      mirrored_trades_total: this.mirroredTrades.length,
      recent_trades: this.mirroredTrades.slice(-5),
      max_position_size: this.maxPositionSize,
      mirror_delay_ms: this.mirrorDelayMs
    };
  }

  getMirroredTrades() {
    return this.mirroredTrades;
  }
}

module.exports = MirrorEngine;
