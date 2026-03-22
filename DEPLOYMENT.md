# Kalshi Trading Bot - Deployment Guide

## Overview

This guide walks you through setting up and deploying the Kalshi Trading Bot to start mirroring top traders and tracking live P&L.

## Prerequisites

- Python 3.8+
- pip or conda
- Kalshi demo or live account
- API credentials from Kalshi

## Step 1: Setup Environment

### Clone/Download the Bot
```bash
cd /path/to/kalshi-bot
```

### Install Dependencies
```bash
pip install -r requirements.txt
```

Verify installation:
```bash
python -c "import requests, flask; print('✓ Dependencies installed')"
```

## Step 2: Create Kalshi Account & Get API Credentials

### For Demo/Paper Trading (Recommended First)
1. Visit: https://demo.kalshi.co/
2. Create an account
3. Go to Settings → API
4. Generate API Key ID and download Private Key (PEM file)
5. Keep these credentials safe

### For Live Trading
1. Visit: https://kalshi.com/
2. Create an account and deposit funds
3. Go to Settings → API
4. Generate API credentials

## Step 3: Configure the Bot

### Create `.kalshi-config.json`
The bot creates a default config on first run. Edit it with your credentials:

```bash
python main.py  # This creates .kalshi-config.json
```

Then edit `.kalshi-config.json`:
```json
{
  "api_url": "https://demo-api.kalshi.co/trade-api/v2",
  "api_key_id": "YOUR_API_KEY_ID",
  "private_key_pem": "-----BEGIN RSA PRIVATE KEY-----\nPASTE_YOUR_PRIVATE_KEY_HERE\n-----END RSA PRIVATE KEY-----",
  "paper_trading": true,
  "initial_balance": 100.00,
  "leaderboard_check_interval": 300,
  "trade_mirror_interval": 300,
  "max_position_size_percent": 10.0,
  "min_balance_before_trade": 10.0,
  "top_traders_count": 3,
  "timezone": "UTC"
}
```

**Important:**
- `api_url`: Use `https://demo-api.kalshi.co/trade-api/v2` for demo/paper
- `api_url`: Use `https://api.elections.kalshi.com/trade-api/v2` for live
- Keep `.kalshi-config.json` in `.gitignore` (already configured)
- **NEVER commit credentials to version control**

## Step 4: Test the Bot

### Run Tests
```bash
python test_bot.py
```

Expected output:
```
KALSHI TRADING BOT - TEST SUITE
==================================================
✓ Configuration: PASS
✓ API Client: PASS
✓ Leaderboard Scraper: PASS
✓ P&L Tracker: PASS
✓ Trade Mirror: PASS
✓ Dashboard: PASS

Total: 6/6 passed
```

### Verify API Connection
```bash
python main.py --stats
```

This will:
- Check configuration
- Test API connection
- Fetch top traders
- Display current stats

## Step 5: Run the Bot

### Start with Dashboard
```bash
python main.py
```

This starts:
1. **Leaderboard Monitor** - Fetches top traders every 5 minutes
2. **Trade Mirror** - Mirrors trades every 5 minutes
3. **Web Dashboard** - Opens at http://localhost:5000

### Without Dashboard (Headless)
```bash
python main.py --no-dashboard
```

### Custom Intervals
```bash
# Check leaderboard every 10 minutes, mirror trades every 5 minutes
python main.py --leaderboard-interval 600 --trade-interval 300
```

### Show Statistics Only
```bash
python main.py --stats
```

## Step 6: Monitor the Dashboard

### Access Dashboard
Open browser: http://localhost:5000

### Dashboard Metrics
- **Account Balance**: Total equity and buying power
- **P&L Tracking**: Daily and total P&L
- **Win Rate**: Percentage of winning trades
- **Open Positions**: Current active trades
- **Top Traders**: Currently mirrored traders
- **Recent Trades**: Last 10 executed trades

### Real-time Updates
Dashboard refreshes every 5 seconds automatically.

## File Structure

```
kalshi-bot/
├── main.py                 # Entry point
├── config.py              # Configuration management
├── kalshi_api.py          # API client
├── leaderboard_scraper.py # Top traders fetcher
├── trade_mirror.py        # Trade execution
├── pnl_tracker.py         # P&L calculation
├── dashboard.py           # Flask app
├── test_bot.py            # Test suite
├── requirements.txt       # Dependencies
├── .kalshi-config.json    # Credentials (git-ignored)
├── trade_history.json     # Trade log
├── mirrored_trades.json   # Mirror log
└── templates/
    └── dashboard.html     # Web UI
```

## Logs & Data

### Trade History
All executed trades are saved in `trade_history.json`:
```json
{
  "trades": [
    {
      "timestamp": "2026-03-16T10:30:45",
      "ticker": "TSLA",
      "side": "BUY",
      "size": 10,
      "price": 150.50,
      "status": "open"
    }
  ]
}
```

### Mirrored Trades Log
Track which trades were mirrored from which traders in `mirrored_trades.json`.

## Troubleshooting

### "Cannot connect to Kalshi API"
- Check `api_url` in config
- Ensure credentials are valid
- Verify internet connection

### "No top traders loaded"
- Leaderboard may be unavailable
- Bot will retry automatically
- Fallback to web scraping if API down

### "Insufficient balance for trade"
- Account balance too low
- Increase account balance or reduce position size
- Check `min_balance_before_trade` setting

### "Order failed to execute"
- Check market is open
- Verify position size is valid
- Check order type compatibility

### Dashboard won't load
- Ensure Flask is running on port 5000
- Check if port is already in use: `lsof -i :5000`
- Try different port: `python main.py --port 5001`

## Switching from Paper to Live

### ⚠️ IMPORTANT: Risk Management

1. **Start Small**: Begin with small position sizes
2. **Test Thoroughly**: Verify all trades execute correctly
3. **Monitor Closely**: Watch dashboard in real-time
4. **Set Limits**: Configure `max_position_size_percent` conservatively

### Steps to Go Live

1. Create live Kalshi account at https://kalshi.com/
2. Deposit real funds (start small!)
3. Generate live API credentials
4. Update `.kalshi-config.json`:
   ```json
   {
     "api_url": "https://api.elections.kalshi.com/trade-api/v2",
     "api_key_id": "YOUR_LIVE_KEY",
     "paper_trading": false
   }
   ```
5. Run with `--live` flag:
   ```bash
   python main.py --live
   ```
   You'll be asked to confirm: "Type 'YES' to confirm"

## Performance Tips

### Optimize Trade Mirroring
- Adjust `trade_mirror_interval` based on trading frequency
- Lower intervals = faster mirrors but more API calls
- Recommended: 300-600 seconds (5-10 minutes)

### Reduce API Load
- Increase `leaderboard_check_interval` to 600 seconds
- Batch API calls when possible
- Use cache to avoid duplicate requests

### Improve P&L Tracking
- Dashboard calculates metrics on-demand
- P&L history saved after each trade
- Sharpe ratio uses 30-day history

## Security Best Practices

1. **Protect Credentials**
   - Never share `.kalshi-config.json`
   - Use environment variables in production
   - Rotate API keys regularly

2. **Secure the Dashboard**
   - Bind to localhost only (default)
   - Use VPN/SSH tunnel for remote access
   - Add authentication in production

3. **Monitor Activity**
   - Review trade_history.json regularly
   - Set up alerts for large losses
   - Keep backups of logs

## Production Deployment

### Run as Background Service (Linux/macOS)
```bash
# Create systemd service
sudo nano /etc/systemd/system/kalshi-bot.service
```

```ini
[Unit]
Description=Kalshi Trading Bot
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/kalshi-bot
ExecStart=/usr/bin/python3 /path/to/kalshi-bot/main.py
Restart=on-failure
RestartSec=60

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable kalshi-bot
sudo systemctl start kalshi-bot
sudo systemctl status kalshi-bot
```

### View Logs
```bash
sudo journalctl -u kalshi-bot -f
```

### Using Docker
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY . .
RUN pip install -r requirements.txt

ENV FLASK_PORT=5000
EXPOSE 5000

CMD ["python", "main.py"]
```

```bash
docker build -t kalshi-bot .
docker run -it -p 5000:5000 -v $(pwd)/.kalshi-config.json:/app/.kalshi-config.json kalshi-bot
```

## Support & Resources

- **Kalshi API Docs**: https://docs.kalshi.com/
- **GitHub Issues**: Report bugs and feature requests
- **Discord/Community**: Connect with other traders

## Disclaimer

This bot is for educational and research purposes only. 

⚠️ **Warning:**
- Past performance does not guarantee future results
- Trading involves risk of financial loss
- Start with paper trading before going live
- Do not risk money you cannot afford to lose
- Mirroring trades does not guarantee profits

## License

MIT License - See LICENSE file for details
