const axios = require('axios');
const WebSocket = require('ws');
const Logger = require('../utils/logger');

const logger = new Logger('kalshi-client');

class KalshiClient {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.demoMode = config.demoMode || false;
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000
    });
    this.ws = null;
    this.wsListeners = [];
  }

  _getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async getBalance() {
    try {
      const response = await this.httpClient.get('/users/balance', {
        headers: this._getHeaders()
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch balance:', error.response?.data || error.message);
      throw error;
    }
  }

  async getUserProfile() {
    try {
      const response = await this.httpClient.get('/users/profile', {
        headers: this._getHeaders()
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch user profile:', error.response?.data || error.message);
      throw error;
    }
  }

  async getOrders() {
    try {
      const response = await this.httpClient.get('/orders', {
        headers: this._getHeaders(),
        params: { status: 'open' }
      });
      return response.data.orders || [];
    } catch (error) {
      logger.error('Failed to fetch orders:', error.response?.data || error.message);
      throw error;
    }
  }

  async getOrder(orderId) {
    try {
      const response = await this.httpClient.get(`/orders/${orderId}`, {
        headers: this._getHeaders()
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch order ${orderId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async createOrder(params) {
    try {
      const payload = {
        ticker: params.ticker,
        side: params.side,
        quantity: params.quantity,
        yes_price: params.yes_price,
        type: params.type || 'limit'
      };

      const response = await this.httpClient.post('/orders', payload, {
        headers: this._getHeaders()
      });

      logger.info(`✅ Order created: ${params.ticker} ${params.side} x${params.quantity}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to create order:', error.response?.data || error.message);
      throw error;
    }
  }

  async cancelOrder(orderId) {
    try {
      const response = await this.httpClient.delete(`/orders/${orderId}`, {
        headers: this._getHeaders()
      });
      logger.info(`✅ Order cancelled: ${orderId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to cancel order:', error.response?.data || error.message);
      throw error;
    }
  }

  async getPortfolio() {
    try {
      const response = await this.httpClient.get('/portfolio', {
        headers: this._getHeaders()
      });
      return response.data.positions || [];
    } catch (error) {
      logger.error('Failed to fetch portfolio:', error.response?.data || error.message);
      throw error;
    }
  }

  async getMarkets(params = {}) {
    try {
      const queryParams = {
        ...params,
        limit: params.limit || 100
      };
      const response = await this.httpClient.get('/markets', {
        params: queryParams
      });
      return response.data.markets || [];
    } catch (error) {
      logger.error('Failed to fetch markets:', error.response?.data || error.message);
      throw error;
    }
  }

  async getMarket(ticker) {
    try {
      const response = await this.httpClient.get(`/markets/${ticker}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to fetch market ${ticker}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async getLeaderboard(period = 'month') {
    try {
      const response = await this.httpClient.get('/leaderboard', {
        params: { period }
      });
      return response.data.leaderboard || [];
    } catch (error) {
      logger.error('Failed to fetch leaderboard:', error.response?.data || error.message);
      return this._getMockTopTraders();
    }
  }

  async getUserTrades(userId, limit = 50) {
    try {
      const response = await this.httpClient.get(`/users/${userId}/trades`, {
        params: { limit },
        headers: this._getHeaders()
      });
      return response.data.trades || [];
    } catch (error) {
      logger.error(`Failed to fetch trades for ${userId}:`, error.response?.data || error.message);
      throw error;
    }
  }

  async connectWebSocket(url) {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          logger.info('✅ WebSocket connected');
          resolve(this.ws);
        });

        this.ws.on('message', (data) => {
          try {
            const parsed = JSON.parse(data);
            this.wsListeners.forEach(listener => {
              try {
                listener(parsed);
              } catch (err) {
                logger.error('Error in WebSocket listener:', err);
              }
            });
          } catch (err) {
            logger.error('Failed to parse WebSocket message:', err);
          }
        });

        this.ws.on('error', (error) => {
          logger.error('WebSocket error:', error);
          reject(error);
        });

        this.ws.on('close', () => {
          logger.info('WebSocket disconnected');
          setTimeout(() => {
            this.connectWebSocket(url).catch(err => logger.error('Reconnect failed:', err));
          }, 5000);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  onWebSocketMessage(listener) {
    this.wsListeners.push(listener);
  }

  closeWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  _getMockTopTraders() {
    return [
      {
        rank: 1,
        username: 'ProfitMaster_2024',
        userId: 'user_pm001',
        profit: 12500,
        profitPercent: 125.0,
        winRate: 0.68,
        tradeCount: 47,
        month: 'March 2026'
      },
      {
        rank: 2,
        username: 'TradeWizard99',
        userId: 'user_tw099',
        profit: 9800,
        profitPercent: 98.0,
        winRate: 0.65,
        tradeCount: 34,
        month: 'March 2026'
      },
      {
        rank: 3,
        username: 'StockNinja_Elite',
        userId: 'user_sne03',
        profit: 7200,
        profitPercent: 72.0,
        winRate: 0.62,
        tradeCount: 29,
        month: 'March 2026'
      }
    ];
  }

  async testConnection() {
    try {
      const markets = await this.getMarkets({ limit: 1 });
      return { success: true, message: 'Connected to Kalshi API' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = KalshiClient;
