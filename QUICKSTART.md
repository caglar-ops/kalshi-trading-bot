# Quick Start Guide - 5 Minutes to Trading

## TL;DR - Get Started in 5 Steps

### 1. Install Dependencies (1 min)
```bash
cd kalshi-bot
pip install -r requirements.txt
```

### 2. Get Kalshi Demo Account (2 min)
- Visit: https://demo.kalshi.co/
- Sign up for free
- Go to Settings → API
- Download API Key ID and Private Key

### 3. Configure Bot (1 min)
```bash
python main.py
# This creates .kalshi-config.json
```

Edit `.kalshi-config.json`:
```json
{
  "api_url": "https://demo-api.kalshi.co/trade-api/v2",
  "api_key_id": "paste_your_key_id_here",
  "private_key_pem": "paste_your_private_key_pem_here",
  "paper_trading": true,
  "initial_balance": 100.00
}
```

### 4. Verify Setup (30 sec)
```bash
python main.py --stats
```

Expected output:
```
✓ Configuration valid
✓ API connection successful
✓ Account balance: $100.00
✓ Found 3 top traders
```

### 5. Run the Bot! (1 min)
```bash
python main.py
```

Open browser: **http://localhost:5000** 🚀

## Dashboard in Action

Your dashboard will show:
- 💰 Current balance: $100.00
- 📈 P&L tracking (daily & total)
- 🎯 Win rate & Sharpe ratio
- 📊 Top traders being mirrored
- 📋 Recent trade executions

## How It Works

```
┌─────────────────────┐
│  Kalshi Bot Running │
├─────────────────────┤
│                     │
│ Every 5 minutes:    │
│ 1. Check leaderboard│
│ 2. Find top 3       │
│ 3. Mirror their     │
│    trades           │
│ 4. Update P&L       │
│ 5. Refresh dashboard│
│                     │
└─────────────────────┘
         ↓
    Dashboard Live
         ↓
  http://localhost:5000
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Cannot connect to API` | Check api_url in config |
| `API key invalid` | Verify credentials in .kalshi-config.json |
| `Port 5000 in use` | Kill existing process: `lsof -i :5000` |
| `No top traders` | Leaderboard may be down, will retry |
| `Insufficient balance` | Start with more funds or reduce position size |

## Next Steps

### View Live Statistics
```bash
python main.py --stats
```

### Custom Settings
```bash
# Check every 10 minutes
python main.py --leaderboard-interval 600

# Faster trading (every 2 min)
python main.py --trade-interval 120

# No dashboard (headless)
python main.py --no-dashboard
```

### Switch to Live Trading (⚠️ RISKY)
Once comfortable with paper trading:

1. Create live account at https://kalshi.com/
2. Deposit real funds (start small!)
3. Update .kalshi-config.json:
   ```json
   {
     "api_url": "https://api.elections.kalshi.com/trade-api/v2",
     "api_key_id": "your_live_key",
     "api_key_pem": "your_live_key_pem"
   }
   ```
4. Run: `python main.py --live`
5. Type `YES` when prompted

## Files Explained

```
kalshi-bot/
├── main.py              ← Run this! 
├── .kalshi-config.json  ← Put your API key here
├── dashboard.py         ← Web interface
├── kalshi_api.py        ← API wrapper
├── leaderboard_scraper.py ← Find top traders
├── trade_mirror.py      ← Mirror their trades
└── pnl_tracker.py       ← Track performance
```

## Key Metrics

**On the Dashboard:**
- **Account Balance**: Your total equity
- **P&L**: Profit/Loss (daily & total)
- **Win Rate**: % of winning trades
- **Sharpe Ratio**: Risk-adjusted returns
- **Open Positions**: Active trades
- **Top Traders**: Who you're copying

## FAQs

**Q: Is this real trading?**
A: No, paper trading uses fake $100. No real money. It's safe to test.

**Q: Will I make money?**
A: Depends on top traders' performance. Past results don't guarantee future returns.

**Q: Can I lose money?**
A: Not in paper trading. In live trading, yes - always start small.

**Q: How often are trades mirrored?**
A: Every 5 minutes by default. Configurable.

**Q: What if top traders lose?**
A: You lose too (mirror their trades). That's the risk.

## Support

- **Issues?** Check DEPLOYMENT.md for troubleshooting
- **How does it work?** See ARCHITECTURE.md
- **API docs?** https://docs.kalshi.com/
- **Trade ideas?** https://kalshi.com/

## Remember

⚠️ **Start with paper trading**
⚠️ **Test thoroughly before going live**
⚠️ **Never risk more than you can afford to lose**
✅ **Monitor the dashboard regularly**
✅ **Keep your API keys secret**

---

**Happy trading!** 🚀

Questions? Stuck? See README.md and DEPLOYMENT.md for more help.
