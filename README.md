# Kalshi Trading Bot

A sophisticated trading bot for Kalshi prediction markets that:
1. **Scrapes the leaderboard** to find the top 3 most profitable traders this month
2. **Mirrors their trades** automatically on your account
3. **Displays live P&L dashboard** with real-time performance metrics
4. **Uses secure credential storage** with `.kalshi-config.json`
5. **Supports paper trading** with $100 test account (via Kalshi demo environment)

## Features

- 📊 **Leaderboard Scraper**: Identifies top 3 profitable traders monthly
- 🔄 **Trade Mirroring**: Automatically executes top traders' recent trades
- 📈 **Live P&L Dashboard**: Real-time performance tracking with:
  - Current open positions
  - Daily P&L (dollars + percentage)
  - Win rate (trades won / total trades)
  - List of top trader strategies being mirrored
- 🔒 **Secure Config**: API credentials stored in `.kalshi-config.json` (git-ignored)
- 📋 **Trade History**: Local JSON storage of all executed trades
- 🧪 **Paper Trading Mode**: Test with virtual $100 using Kalshi demo environment

## Architecture

```
kalshi-bot/
├── main.py                 # Entry point & orchestrator
├── config.py              # Configuration management
├── leaderboard_scraper.py # Top traders identification
├── trade_mirror.py        # Trade execution & mirroring
├── kalshi_api.py          # API wrapper & authentication
├── dashboard.py           # Flask web dashboard
├── pnl_tracker.py         # P&L calculation & history
├── .kalshi-config.json    # API credentials (git-ignored)
├── trade_history.json     # Trade execution log
└── templates/
    └── dashboard.html     # Web UI
```

## Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Create Kalshi Demo Account
Visit https://demo.kalshi.co/ and create an account for testing.

### 3. Configure API Credentials
Create `.kalshi-config.json`:
```json
{
  "api_url": "https://demo-api.kalshi.co/trade-api/v2",
  "api_key_id": "YOUR_API_KEY_ID",
  "private_key_pem": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----",
  "paper_trading": true,
  "initial_balance": 100.00
}
```

### 4. Run the Bot
```bash
# Paper trading mode (safe testing)
python main.py --paper

# Monitor live P&L dashboard
python main.py --dashboard

# View trade history
python main.py --stats
```

## Usage

### Start the Bot
```bash
python main.py
```

This will:
1. Fetch top 3 traders from Kalshi leaderboard
2. Monitor their trade history every 5-10 minutes
3. Mirror new trades on your account
4. Start the live dashboard on http://localhost:5000

### Dashboard
Open http://localhost:5000 to see:
- **Current Positions**: Active trades and positions
- **Daily P&L**: Real-time profit/loss tracking
- **Win Rate**: Percentage of winning trades
- **Top Strategies**: List of traders being mirrored and their strategies

### Trade History
View detailed trade logs:
```bash
python main.py --stats
```

## Demo Environment

- API Root: `https://demo-api.kalshi.co/trade-api/v2`
- Test Balance: $100
- No real money involved
- Perfect for testing and validation

## API Authentication

The bot uses RSA key authentication with Kalshi's API:
1. Generate API key and private key from Kalshi Settings → API
2. Store credentials in `.kalshi-config.json` (keep private!)
3. Bot automatically signs API requests with RSA private key

## Trade Mirroring Logic

1. Fetches top 3 traders' recent trades every 5-10 minutes
2. For each new trade not yet executed:
   - Mirrors the position size (adjusted to $100 account)
   - Executes trade at market price or better
   - Logs trade execution with timestamp and metadata
3. Tracks position correlation with top traders

## P&L Tracking

**Daily P&L** = Current positions mark-to-market value + Realized P&L

**Win Rate** = (Trades Won) / (Total Closed Trades)

**Sharpe Ratio** = (Mean Daily Return - Risk Free Rate) / Std Dev of Returns

**Trade Correlation** = How closely your trades match top traders' performance

## Error Handling

- Automatic retry on API failures (exponential backoff)
- Position size validation to prevent over-leverage
- Balance checks before executing trades
- Graceful degradation if leaderboard unavailable

## Testing

```bash
# Test paper trading with mock $100
python main.py --paper --test

# Run with debug logging
python main.py --debug

# Simulate trade mirroring (no execution)
python main.py --dry-run
```

## Important Notes

⚠️ **Paper Trading Only**: This bot is configured for Kalshi's demo environment only. Do not use with real money without proper testing and risk management.

🔒 **Secure Your Credentials**: Keep `.kalshi-config.json` private. It contains your API key.

📊 **Monitor Regularly**: Check the dashboard for any unusual activity or errors.

## License

Educational/Research purposes only. Use at your own risk.

## Support

For issues or questions about Kalshi API, visit: https://docs.kalshi.com/
