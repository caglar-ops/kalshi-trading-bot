const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const Logger = require('../utils/logger');

const logger = new Logger('database');

class Database {
  constructor() {
    const dbDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.dbPath = path.join(dbDir, 'kalshi-bot.db');
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, async (err) => {
        if (err) {
          logger.error('Failed to connect to database:', err);
          reject(err);
          return;
        }

        logger.info(`✅ Connected to database: ${this.dbPath}`);

        try {
          await this.createTables();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS top_traders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_id TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        rank INTEGER,
        profit REAL,
        win_rate REAL,
        trade_count INTEGER,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS mirrored_trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trader_id TEXT NOT NULL,
        trader_name TEXT NOT NULL,
        trader_trade_id TEXT UNIQUE,
        order_id TEXT,
        ticker TEXT NOT NULL,
        side TEXT NOT NULL,
        quantity INTEGER,
        price REAL,
        status TEXT DEFAULT 'pending',
        pnl REAL,
        mirrored_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        FOREIGN KEY(trader_id) REFERENCES top_traders(trader_id)
      )`,

      `CREATE TABLE IF NOT EXISTS trade_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT NOT NULL,
        side TEXT NOT NULL,
        quantity INTEGER,
        entry_price REAL,
        exit_price REAL,
        pnl REAL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        encrypted_value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const sql of tables) {
      await this.run(sql);
    }

    logger.info('✅ Database tables created/verified');
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) {
          logger.error('Database error:', err, sql);
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('Database error:', err, sql);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('Database error:', err, sql);
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  async transaction(callback) {
    try {
      await this.run('BEGIN TRANSACTION');
      const result = await callback();
      await this.run('COMMIT');
      return result;
    } catch (error) {
      await this.run('ROLLBACK');
      throw error;
    }
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error('Error closing database:', err);
            reject(err);
          } else {
            logger.info('✅ Database closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  async clear() {
    const tables = [
      'top_traders',
      'mirrored_trades',
      'trade_history',
      'activity_log'
    ];

    for (const table of tables) {
      await this.run(`DELETE FROM ${table}`);
    }

    logger.info('⚠️  Database cleared');
  }

  async getStatistics() {
    try {
      const stats = {};

      stats.topTraders = await this.get('SELECT COUNT(*) as count FROM top_traders');
      stats.mirroredTrades = await this.get('SELECT COUNT(*) as count FROM mirrored_trades');
      stats.trades = await this.get('SELECT COUNT(*) as count FROM trade_history');
      stats.totalPnL = await this.get('SELECT SUM(pnl) as total FROM trade_history');

      return stats;
    } catch (error) {
      logger.error('Failed to get statistics:', error);
      throw error;
    }
  }
}

module.exports = Database;
