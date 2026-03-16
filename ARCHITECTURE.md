# Kalshi Trading Bot - Architecture

## System Design

```
┌─────────────────────────────────────────────────────────────┐
│                    KALSHI TRADING BOT                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐      ┌──────────────────┐            │
│  │  Leaderboard     │      │  Trade Mirror    │            │
│  │  Scraper         │◄─────┤  Engine          │            │
│  │                  │      │                  │            │
│  │ • Fetch top 3    │      │ • Monitor trades │            │
│  │   traders        │      │ • Mirror orders  │            │
│  │ • Cache results  │      │ • Scale position │            │
│  │ • Update every   │      │ • Execute orders │            │
│  │   5 min          │      │                  │            │
│  └────────┬─────────┘      └────────┬─────────┘            │
│           │                         │                       │
│           └────────────┬────────────┘                       │
│                        │                                     │
│                   ┌────▼──────────┐                         │
│                   │  Kalshi API   │                         │
│                   │  Client       │                         │
│                   │               │                         │
│                   │ • Auth/Sign   │                         │
│                   │ • REST calls  │                         │
│                   │ • Error hdl   │                         │
│                   └────┬──────────┘                         │
│                        │                                     │
│           ┌────────────┴────────────┐                       │
│           │                         │                       │
│           │                         │                       │
│    ┌──────▼──────────┐      ┌──────▼──────────┐            │
│    │ P&L Tracker    │      │ Web Dashboard  │            │
│    │                │      │                │            │
│    │ • Record trades│      │ • Flask app    │            │
│    │ • Calculate    │      │ • Real-time    │            │
│    │   metrics      │      │   updates      │            │
│    │ • Win rate     │      │ • API routes   │            │
│    │ • Daily P&L    │      │ • HTML UI      │            │
│    └────┬───────────┘      └────────────────┘            │
│         │                                                   │
│    ┌────▼────────────────────────┐                         │
│    │  Local Data Store           │                         │
│    │                             │                         │
│    │ • trade_history.json        │                         │
│    │ • mirrored_trades.json      │                         │
│    │ • .kalshi-config.json       │                         │
│    └─────────────────────────────┘                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Leaderboard Scraper (`leaderboard_scraper.py`)

**Purpose**: Identify and track top profitable traders monthly

**Key Features**:
- Fetches top 3 traders via API or web scraping
- Caches trader data to reduce API calls
- Tracks profit, ROI, win rate, trade count
- Persists data to JSON for recovery

**Methods**:
- `fetch_top_traders()`: Get leaderboard data
- `get_trader_by_rank(rank)`: Access specific trader
- `monitor_trader(user_id)`: Fetch trader's recent trades
- `save_top_traders()`: Persist to disk

### 2. Kalshi API Client (`kalshi_api.py`)

**Purpose**: Authenticated REST client for Kalshi API

**Key Features**:
- RSA-based request signing
- Rate limiting awareness
- Error handling & retries
- Type hints for clarity

**Methods**:
- `get_markets()`: Available markets
- `get_portfolio()`: Account stats
- `get_positions()`: Current holdings
- `get_trades()`: Trade history
- `create_order()`: Place trade
- `get_leaderboard()`: Top traders

### 3. Trade Mirror (`trade_mirror.py`)

**Purpose**: Automatically mirror top traders' positions

**Key Features**:
- Tracks mirrored trades separately
- Scales positions to account size
- Prevents duplicate mirroring
- Validates balance before trading

**Methods**:
- `mirror_top_traders()`: Main mirroring loop
- `_calculate_position_size()`: Size scaling
- `get_trader_strategies()`: Analyze patterns
- `get_mirrored_trades()`: Query history

**Mirroring Logic**:
```
For each top trader:
  1. Fetch recent trades
  2. For each new trade:
    a. Check if already mirrored
    b. Scale position to our account
    c. Validate balance
    d. Execute order
    e. Log execution
```

### 4. P&L Tracker (`pnl_tracker.py`)

**Purpose**: Track performance metrics and P&L

**Key Metrics**:
- **Daily P&L**: Unrealized + realized daily gain/loss
- **Total P&L**: Cumulative profit/loss
- **Win Rate**: (Winning trades / Total trades) × 100
- **Sharpe Ratio**: Return per unit of risk
- **Open Positions**: Current active holdings

**Data Storage**:
```json
{
  "trades": [
    {
      "timestamp": "2026-03-16T10:30:45",
      "ticker": "TSLA",
      "side": "BUY",
      "size": 10,
      "price": 150.50,
      "pnl": 150.00,
      "pnl_percent": 1.0,
      "status": "closed"
    }
  ]
}
```

### 5. Web Dashboard (`dashboard.py` + `templates/dashboard.html`)

**Purpose**: Real-time visualization of bot performance

**Technology Stack**:
- Backend: Flask with CORS
- Frontend: Vanilla HTML/CSS/JavaScript
- Data: JSON API endpoints
- Refresh: 5-second intervals

**API Routes**:
- `/` - Dashboard HTML
- `/api/stats` - Performance metrics
- `/api/positions` - Current holdings
- `/api/top-traders` - Leaderboard data
- `/api/strategies` - Mirroring strategies
- `/api/recent-trades` - Latest executions

**Dashboard Features**:
- Account balance & equity
- P&L tracking (daily & total)
- Win rate & Sharpe ratio
- Open positions list
- Top trader profiles
- Recent trade log

### 6. Configuration (`config.py`)

**Purpose**: Secure credential & parameter management

**Configuration Options**:
```json
{
  "api_url": "https://demo-api.kalshi.co/trade-api/v2",
  "api_key_id": "key_id",
  "private_key_pem": "-----BEGIN...",
  "paper_trading": true,
  "leaderboard_check_interval": 300,
  "trade_mirror_interval": 300,
  "max_position_size_percent": 10.0,
  "top_traders_count": 3
}
```

**Security**:
- Config file git-ignored
- Credentials never logged
- Safe defaults provided

## Data Flow

### Trade Execution Flow

```
Bot Start
  ↓
Load Config
  ↓
Init API Client
  ↓
Fetch Top Traders (5-min interval)
  ├─ Get leaderboard
  ├─ Cache trader IDs
  ├─ Store to JSON
  └─ Update UI
  ↓
Monitor Trader Trades (5-min interval)
  ├─ Query recent trades for top 3
  ├─ Check if already mirrored
  ├─ Scale position size
  ├─ Validate account balance
  ├─ Place order via API
  ├─ Log execution
  └─ Update P&L tracker
  ↓
Update Dashboard (5-sec interval)
  ├─ Fetch latest stats
  ├─ Calculate metrics
  ├─ Serve JSON to frontend
  └─ Real-time update UI
  ↓
Track P&L
  ├─ Record each trade
  ├─ Calculate daily P&L
  ├─ Update win rate
  ├─ Persist to JSON
  └─ Display on dashboard
```

## Key Algorithms

### Position Size Scaling
```python
account_balance = $100
trader_position = 10 shares @ $150 = $1500
max_position = $100 * 10% = $10

# If trader's account is $10k:
# Our account is 1% of theirs
# So our position = 10 * (100/10000) = 0.1 shares
# Capped at max_position = $10

position = min(0.1, $10/150) = 0.067 shares
```

### Win Rate Calculation
```python
closed_trades = [
  {status: "closed", pnl: +50},    # win
  {status: "closed", pnl: -25},    # loss
  {status: "closed", pnl: +100},   # win
]

win_rate = (2 winning) / (3 total) * 100 = 66.7%
```

### Sharpe Ratio
```python
daily_returns = [100, -50, 75, -25, 150]
mean_return = 50
std_dev = 79.06

sharpe_ratio = (50 - 0) / 79.06 = 0.63
# Assume 0% risk-free rate
```

## Threading Model

```
Main Thread
  ├─ Initialize bot
  ├─ Start leaderboard monitor thread
  ├─ Start trade mirror thread
  ├─ Start Flask dashboard (blocks)
  └─ Accept KeyboardInterrupt
  
Leaderboard Monitor Thread (daemon)
  └─ Loop every 5 min:
     ├─ Fetch top traders
     ├─ Update cache
     └─ Sleep remaining time

Trade Mirror Thread (daemon)
  └─ Loop every 5 min:
     ├─ Query top traders' recent trades
     ├─ Mirror new ones
     ├─ Log execution
     └─ Sleep remaining time

Flask Dashboard Thread (via WSGI)
  └─ Listen on 0.0.0.0:5000
     ├─ Serve static HTML
     ├─ API routes
     └─ Real-time JSON updates
```

## Error Handling

**Resilience Strategy**:
- **API Failures**: Retry with exponential backoff
- **Missing Data**: Use cached/stale data as fallback
- **Order Rejections**: Log and skip, continue
- **Balance Issues**: Reduce position size or skip
- **Network Issues**: Auto-reconnect on next cycle

**Logging**:
- Console output for immediate feedback
- Trade logs persisted to JSON
- Error messages with timestamps
- Dashboard shows last update time

## Scalability Considerations

### Current Limitations
- Single account trading
- Fixed top-3 traders
- 5-minute polling intervals
- In-memory caching only

### Future Enhancements
- Multi-account support
- Dynamic trader selection
- Real-time WebSocket updates
- Persistent database (SQLite/PostgreSQL)
- Distributed architecture

## Security Model

**API Authentication**:
- RSA-signed requests
- Private key stored locally (.gitignored)
- Demo & Live credentials separated

**Data Security**:
- Credentials never logged
- Trade history local only
- No remote data transmission
- Dashboard accessible only via localhost (default)

**Risk Controls**:
- Max position size percent
- Minimum balance threshold
- No over-leverage
- Position size validation

## Testing Strategy

**Unit Tests** (`test_bot.py`):
- Configuration loading
- API client initialization
- Leaderboard scraping
- P&L tracking
- Trade mirroring logic
- Dashboard initialization

**Integration Tests** (Manual):
- End-to-end trade execution
- Real API connection
- Dashboard data flow
- Error recovery

**Paper Trading** (Recommended):
- Test with demo environment
- Risk-free validation
- Before going live
