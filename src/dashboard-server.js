const express = require('express');
const cors = require('cors');
const Logger = require('./utils/logger');

const logger = new Logger('dashboard-server');

class DashboardServer {
  constructor(db, positions, monitor, port = 3001) {
    this.db = db;
    this.positions = positions;
    this.monitor = monitor;
    this.port = port;
    this.app = express();
    this.server = null;
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.use(cors());
    this.app.use(express.json());

    // API Routes
    this.app.get('/api/status', (req, res) => {
      res.json({
        running: true,
        timestamp: new Date().toISOString(),
        mode: process.env.DEMO_MODE === 'true' ? 'demo' : 'live'
      });
    });

    this.app.get('/api/portfolio', async (req, res) => {
      try {
        const summary = await this.positions.getPortfolioSummary();
        res.json(summary);
      } catch (error) {
        logger.error('Failed to get portfolio:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/positions', (req, res) => {
      const positions = this.positions.getOpenPositions();
      res.json(positions);
    });

    this.app.get('/api/traders', (req, res) => {
      const traders = this.monitor.getTopTraders();
      res.json(traders);
    });

    this.app.get('/api/pnl', (req, res) => {
      res.json({
        dailyPnL: this.positions.getDailyPnL(),
        winRate: this.positions.getWinRate(),
        winCount: this.positions.winCount,
        lossCount: this.positions.lossCount
      });
    });

    this.app.get('/api/stats', async (req, res) => {
      try {
        const dbStats = await this.db.getStatistics();
        const posStats = this.positions.getStatistics();

        res.json({
          ...dbStats,
          ...posStats,
          topTraders: this.monitor.getStatistics()
        });
      } catch (error) {
        logger.error('Failed to get stats:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/trades/mirrored', async (req, res) => {
      try {
        const trades = await this.db.all(
          `SELECT * FROM mirrored_trades ORDER BY mirrored_at DESC LIMIT 50`
        );
        res.json(trades);
      } catch (error) {
        logger.error('Failed to get mirrored trades:', error);
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/trades/history', async (req, res) => {
      try {
        const trades = await this.db.all(
          `SELECT * FROM trade_history ORDER BY timestamp DESC LIMIT 50`
        );
        res.json(trades);
      } catch (error) {
        logger.error('Failed to get trade history:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Dashboard HTML
    this.app.get('/', (req, res) => {
      res.send(this.getDashboardHTML());
    });

    // Static files (if needed)
    this.app.use(express.static(path.join(__dirname, '../dashboard/dist')));
  }

  /**
   * Get dashboard HTML
   */
  getDashboardHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kalshi Trading Bot - P&L Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
      color: #e0e0e0;
      line-height: 1.6;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding: 20px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      border-left: 4px solid #00d4ff;
    }

    header h1 {
      font-size: 28px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .status {
      display: flex;
      gap: 20px;
    }

    .status-item {
      text-align: right;
    }

    .status-label {
      font-size: 12px;
      color: #888;
      text-transform: uppercase;
    }

    .status-value {
      font-size: 18px;
      font-weight: bold;
      color: #00d4ff;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .card {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 8px;
      padding: 20px;
      backdrop-filter: blur(10px);
    }

    .card h2 {
      font-size: 14px;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 15px;
      border-bottom: 1px solid rgba(0, 212, 255, 0.1);
      padding-bottom: 10px;
    }

    .metric {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 10px 0;
      padding: 8px 0;
    }

    .metric-label {
      color: #999;
      font-size: 14px;
    }

    .metric-value {
      font-weight: bold;
      font-size: 16px;
      color: #00d4ff;
    }

    .metric-value.positive {
      color: #00ff88;
    }

    .metric-value.negative {
      color: #ff4444;
    }

    .traders-list {
      display: grid;
      gap: 10px;
    }

    .trader-item {
      background: rgba(0, 212, 255, 0.05);
      padding: 12px;
      border-radius: 6px;
      border-left: 3px solid #00d4ff;
    }

    .trader-name {
      font-weight: bold;
      color: #00d4ff;
      font-size: 14px;
    }

    .trader-stats {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #888;
      margin-top: 5px;
    }

    .positions-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }

    .positions-table thead {
      background: rgba(0, 212, 255, 0.1);
    }

    .positions-table th {
      padding: 10px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      color: #00d4ff;
    }

    .positions-table td {
      padding: 10px;
      border-top: 1px solid rgba(0, 212, 255, 0.1);
      font-size: 13px;
    }

    .pnl-value {
      font-weight: bold;
    }

    .pnl-positive {
      color: #00ff88;
    }

    .pnl-negative {
      color: #ff4444;
    }

    @media (max-width: 768px) {
      header {
        flex-direction: column;
        gap: 15px;
      }

      .grid {
        grid-template-columns: 1fr;
      }
    }

    .loading {
      text-align: center;
      padding: 20px;
      color: #888;
    }

    .error {
      background: rgba(255, 68, 68, 0.1);
      border-left: 4px solid #ff4444;
      padding: 15px;
      border-radius: 6px;
      color: #ff9999;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🤖 Kalshi Trading Bot</h1>
      <div class="status">
        <div class="status-item">
          <div class="status-label">Mode</div>
          <div class="status-value" id="mode">Demo</div>
        </div>
        <div class="status-item">
          <div class="status-label">Status</div>
          <div class="status-value" id="status" style="color: #00ff88;">● Active</div>
        </div>
      </div>
    </header>

    <div class="grid">
      <div class="card">
        <h2>Portfolio</h2>
        <div class="metric">
          <span class="metric-label">Balance</span>
          <span class="metric-value" id="balance">--</span>
        </div>
        <div class="metric">
          <span class="metric-label">Equity</span>
          <span class="metric-value" id="equity">--</span>
        </div>
        <div class="metric">
          <span class="metric-label">Total Value</span>
          <span class="metric-value" id="totalValue">--</span>
        </div>
        <div class="metric">
          <span class="metric-label">Open Positions</span>
          <span class="metric-value" id="positionCount">0</span>
        </div>
      </div>

      <div class="card">
        <h2>Daily P&L</h2>
        <div class="metric">
          <span class="metric-label">P&L</span>
          <span class="metric-value" id="dailyPnL">--</span>
        </div>
        <div class="metric">
          <span class="metric-label">Win Rate</span>
          <span class="metric-value" id="winRate">--</span>
        </div>
        <div class="metric">
          <span class="metric-label">Wins / Losses</span>
          <span class="metric-value" id="winLoss">-- / --</span>
        </div>
      </div>

      <div class="card">
        <h2>Top Traders</h2>
        <div class="traders-list" id="traders">
          <div class="loading">Loading...</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Open Positions</h2>
      <div id="positions">
        <div class="loading">Loading...</div>
      </div>
    </div>

    <div class="card">
      <h2>Recent Mirrored Trades</h2>
      <div id="trades">
        <div class="loading">Loading...</div>
      </div>
    </div>
  </div>

  <script>
    const API_BASE = 'http://localhost:3001/api';

    async function fetchData() {
      try {
        const [portfolio, positions, traders, pnl, trades] = await Promise.all([
          fetch(\`\${API_BASE}/portfolio\`).then(r => r.json()),
          fetch(\`\${API_BASE}/positions\`).then(r => r.json()),
          fetch(\`\${API_BASE}/traders\`).then(r => r.json()),
          fetch(\`\${API_BASE}/pnl\`).then(r => r.json()),
          fetch(\`\${API_BASE}/trades/mirrored\`).then(r => r.json())
        ]);

        // Update portfolio
        document.getElementById('balance').textContent = \`$\${(portfolio.balance || 0).toFixed(2)}\`;
        document.getElementById('equity').textContent = \`$\${(portfolio.equity || 0).toFixed(2)}\`;
        document.getElementById('totalValue').textContent = \`$\${(portfolio.totalValue || 0).toFixed(2)}\`;
        document.getElementById('positionCount').textContent = (portfolio.positions || 0).toString();

        // Update P&L
        const pnlValue = pnl.dailyPnL || 0;
        const pnlEl = document.getElementById('dailyPnL');
        pnlEl.textContent = \`$\${pnlValue.toFixed(2)}\`;
        pnlEl.className = 'metric-value ' + (pnlValue > 0 ? 'positive' : pnlValue < 0 ? 'negative' : '');
        document.getElementById('winRate').textContent = \`\${((pnl.winRate || 0) * 100).toFixed(1)}%\`;
        document.getElementById('winLoss').textContent = \`\${pnl.winCount || 0} / \${pnl.lossCount || 0}\`;

        // Update traders
        const tradersHtml = (traders || [])
          .map(t => \`
            <div class="trader-item">
              <div class="trader-name">#\${t.rank} \${t.username}</div>
              <div class="trader-stats">
                <span>Profit: $\${t.profit?.toFixed(0) || 0}</span>
                <span>Win Rate: \${(t.winRate * 100).toFixed(1)}%</span>
                <span>Trades: \${t.tradeCount}</span>
              </div>
            </div>
          \`)
          .join('');
        document.getElementById('traders').innerHTML = tradersHtml || '<div class="loading">No traders</div>';

        // Update positions
        const posHtml = positions && positions.length > 0
          ? \`
            <table class="positions-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Side</th>
                  <th>Qty</th>
                  <th>Entry</th>
                  <th>Current</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                \${positions.map(p => \`
                  <tr>
                    <td>\${p.ticker}</td>
                    <td>\${p.side}</td>
                    <td>\${p.quantity}</td>
                    <td>$\${(p.entryPrice || 0).toFixed(2)}</td>
                    <td>$\${(p.currentPrice || 0).toFixed(2)}</td>
                    <td class="pnl-value \${(p.unrealizedPnL || 0) > 0 ? 'pnl-positive' : 'pnl-negative'}">
                      $\${(p.unrealizedPnL || 0).toFixed(2)}
                    </td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          \`
          : '<div class="loading">No open positions</div>';
        document.getElementById('positions').innerHTML = posHtml;

        // Update trades
        const tradesHtml = trades && trades.length > 0
          ? \`
            <table class="positions-table">
              <thead>
                <tr>
                  <th>Trader</th>
                  <th>Ticker</th>
                  <th>Side</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                \${trades.slice(0, 10).map(t => \`
                  <tr>
                    <td>\${t.trader_name}</td>
                    <td>\${t.ticker}</td>
                    <td>\${t.side}</td>
                    <td>\${t.quantity}</td>
                    <td>$\${(t.price || 0).toFixed(2)}</td>
                    <td>\${new Date(t.mirrored_at).toLocaleString()}</td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          \`
          : '<div class="loading">No mirrored trades yet</div>';
        document.getElementById('trades').innerHTML = tradesHtml;

      } catch (error) {
        console.error('Failed to fetch data:', error);
        document.getElementById('positions').innerHTML = \`<div class="error">Failed to load data</div>\`;
      }
    }

    // Initial load
    fetchData();

    // Refresh every 5 seconds
    setInterval(fetchData, 5000);
  </script>
</body>
</html>
    `;
  }

  /**
   * Start the dashboard server
   */
  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        logger.info(`✅ Dashboard running on http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the dashboard server
   */
  async stop() {
    if (this.server) {
      this.server.close();
      logger.info('✅ Dashboard stopped');
    }
  }
}

const path = require('path');
module.exports = DashboardServer;
