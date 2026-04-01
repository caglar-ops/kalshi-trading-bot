# Kalshi Trading Bot - Deployment Guide

## Overview

Complete guide for deploying the Kalshi Trading Bot to production with Node.js, React dashboard, and Kalshi API integration.

## Prerequisites

- Node.js v16+ and npm
- Git
- Kalshi demo or live account with API access
- API credentials (.kalshi-config.json and .kalshi-private-key.pem)
- ~100MB free disk space

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Kalshi Trading Bot v1.0.0                              │
├─────────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│ │  Dashboard   │  │  API Client  │  │   Database   │   │
│ │  (Port 3001) │  │  (RSA Auth)  │  │   (SQLite)   │   │
│ └──────────────┘  └──────────────┘  └──────────────┘   │
│        ▲                  ▲                  ▲          │
│        └──────────────────┴──────────────────┘          │
│              Trading Engine & Mirroring                 │
├─────────────────────────────────────────────────────────┤
│              Kalshi API (demo-api.kalshi.co)            │
└─────────────────────────────────────────────────────────┘
```

## Step 1: Installation

### 1.1 Clone/Setup Project

```bash
cd /home/clawd/.openclaw/workspace/projects/kalshi-bot
```

### 1.2 Install Dependencies

```bash
npm install
```

This installs:
- `axios` - HTTP client for API calls
- `express` - Web server for dashboard
- `sqlite3` - Database for trade history
- `winston` - Structured logging
- `crypto` - RSA signature generation
- Dev tools: `jest`, `nodemon`, `eslint`

### 1.3 Verify Installation

```bash
node -v          # Node.js version
npm -v           # npm version
npm list axios   # Verify dependencies
```

## Step 2: Configuration

### 2.1 Kalshi Credentials

The bot requires two files in the project root:

**`.kalshi-config.json`**
```json
{
  "key_id": "YOUR_API_KEY_ID",
  "private_key_path": ".kalshi-private-key.pem",
  "api_url": "https://demo-api.kalshi.co/trade-api/v2",
  "starting_capital": 100,
  "target_daily_profit": 1,
  "max_loss_per_trade": 5
}
```

**`.kalshi-private-key.pem`**
```
-----BEGIN RSA PRIVATE KEY-----
[Your private key content here]
-----END RSA PRIVATE KEY-----
```

### 2.2 Verify Configuration

```bash
npm run setup
```

This will:
- Validate API credentials
- Test connection to Kalshi API
- Initialize database
- Create logs directory

## Step 3: Running the Bot

### 3.1 Start the Trading Bot

```bash
npm start
```

The bot will:
1. Load configuration and credentials
2. Connect to Kalshi API
3. Start leaderboard monitoring
4. Begin tracking top 3 traders
5. Launch dashboard server on port 3001

Expected output:
```
[INFO] Bot starting...
[INFO] Connected to Kalshi API (demo)
[INFO] Leaderboard monitoring started
[INFO] Dashboard server running on http://localhost:3001
```

### 3.2 Access the Dashboard

Open your browser:
```
http://localhost:3001
```

The dashboard displays:
- **Current Positions**: Live open trades
- **Daily P&L**: Real-time profit/loss
- **Win Rate**: Percentage of winning trades
- **Top Traders**: Strategies being mirrored
- **Performance Chart**: P&L over time

## Step 4: Monitor Operations

### 4.1 View Real-time Logs

```bash
# In new terminal
tail -f logs/bot-$(date +%Y-%m-%d).log
```

### 4.2 Check Leaderboard

```bash
npm run leaderboard
```

Shows:
- Top 3 traders this month
- Their P&L and win rates
- Strategies being mirrored

### 4.3 Database Queries

```bash
# View trade history
sqlite3 trading.db "SELECT * FROM trades ORDER BY created_at DESC LIMIT 10;"

# Check positions
sqlite3 trading.db "SELECT * FROM positions WHERE status='OPEN';"

# Export trade history
sqlite3 trading.db ".mode csv" ".output trades.csv" "SELECT * FROM trades;"
```

## Step 5: Production Deployment

### 5.1 Enable Live Trading

To switch from demo to live trading:

**Edit `.kalshi-config.json`:**
```json
{
  "api_url": "https://api.kalshi.co/trade-api/v2",
  ...
}
```

### 5.2 Use Environment Variables (Recommended)

For CI/CD and production security:

```bash
# Set environment variables
export KALSHI_API_KEY_ID="your-key-id"
export KALSHI_PRIVATE_KEY="$(cat .kalshi-private-key.pem)"
export KALSHI_API_URL="https://api.kalshi.co/trade-api/v2"

# Run bot (will use env vars)
npm start
```

### 5.3 Background Execution

Run with systemd or PM2:

**Using PM2 (recommended):**
```bash
npm install -g pm2

# Start bot
pm2 start src/index.js --name "kalshi-bot"

# Monitor
pm2 monit

# View logs
pm2 logs kalshi-bot

# Auto-restart on reboot
pm2 startup
pm2 save
```

**Using systemd:**

Create `/etc/systemd/system/kalshi-bot.service`:
```ini
[Unit]
Description=Kalshi Trading Bot
After=network.target

[Service]
Type=simple
User=clawd
WorkingDirectory=/home/clawd/.openclaw/workspace/projects/kalshi-bot
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable kalshi-bot
sudo systemctl start kalshi-bot
sudo systemctl status kalshi-bot
```

## Step 6: Testing

### 6.1 Run Tests

```bash
npm test
```

Runs:
- API client tests
- Trade mirroring logic tests
- P&L calculation tests
- Database tests

### 6.2 Paper Trading Mode

```bash
# Run with demo account (safe testing)
npm run paper
```

### 6.3 Dry Run (No Trades)

```bash
# Monitor without executing trades
node src/index.js --dry-run
```

## Troubleshooting

### Issue: "Cannot find module 'axios'"

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: API Authentication Error

**Check:**
1. `.kalshi-config.json` has correct `key_id`
2. `.kalshi-private-key.pem` exists and is valid
3. Private key matches API key ID in Kalshi account
4. File permissions allow reading

### Issue: Dashboard not loading on http://localhost:3001

**Check:**
1. Bot is running: `npm start`
2. Port 3001 is free: `lsof -i :3001`
3. Check logs: `tail -f logs/bot-$(date +%Y-%m-%d).log`
4. Restart if needed: `npm start`

### Issue: Database locked error

**Solution:**
```bash
# Close all connections
pkill -f "npm start"

# Clear lock file
rm -f trading.db-wal trading.db-shm

# Restart
npm start
```

## Monitoring & Alerts

### 6.1 Email Alerts (Optional)

Add to `src/index.js`:
```javascript
const nodemailer = require('nodemailer');

function sendAlert(subject, message) {
  // Configure email settings
  // Send notification on large P&L swings
}
```

### 6.2 Webhook Alerts

```javascript
// Post to external service on trade execution
axios.post('https://your-webhook.com/alerts', {
  event: 'trade_executed',
  trade: tradeData,
  pnl: pnlData
});
```

### 6.3 Log Rotation

Logs automatically rotate daily in `logs/` directory.

View latest:
```bash
ls -lt logs/ | head -1
```

## Performance Optimization

### 7.1 API Rate Limiting

The bot respects Kalshi's rate limits:
- Leaderboard: Every 5-10 minutes
- Orders: Every 30 seconds
- Positions: Every 60 seconds

### 7.2 Database Optimization

```bash
# Vacuum database (optimize storage)
sqlite3 trading.db "VACUUM;"

# Create indices for faster queries
sqlite3 trading.db "CREATE INDEX idx_trades_timestamp ON trades(created_at);"
```

### 7.3 Memory Management

Monitor memory usage:
```bash
# Check process memory
ps aux | grep "node src/index.js"

# Top memory consumers
node --expose-gc src/index.js
```

## Backup & Recovery

### 8.1 Backup Database

```bash
# Create backup
cp trading.db trading.db.backup.$(date +%s)

# Automated daily backups
0 2 * * * cp /path/to/trading.db /backups/trading.db.$(date +\%Y\%m\%d)
```

### 8.2 Restore from Backup

```bash
cp trading.db.backup.1234567890 trading.db
npm start
```

### 8.3 Export Trade History

```bash
# JSON export
npm run export -- --format json --output trades.json

# CSV export
npm run export -- --format csv --output trades.csv
```

## Upgrading

### 9.1 Update Code

```bash
git pull origin master
npm install
npm test
npm start
```

### 9.2 Update Dependencies

```bash
npm update
npm audit fix
npm test
```

## Support & Documentation

- **Kalshi API**: https://docs.kalshi.com
- **Trading Guide**: https://help.kalshi.com
- **Demo Environment**: https://demo.kalshi.co
- **Project Repo**: https://github.com/caglar-ops/kalshi-trading-bot

## Security Checklist

- [ ] Private key stored securely (not in Git)
- [ ] .kalshi-config.json not committed
- [ ] API key rotated regularly
- [ ] Logs monitored for unauthorized access
- [ ] Database backups automated
- [ ] Environment variables used in production
- [ ] SSL/TLS enabled for web connections
- [ ] Rate limiting configured
- [ ] Error logs reviewed regularly

## Summary

Your Kalshi Trading Bot is now deployed and ready to:
1. Mirror top traders' trades automatically
2. Track live P&L in real-time
3. Execute trades with risk management
4. Store complete trade history

Monitor the dashboard and logs regularly for optimal performance.
