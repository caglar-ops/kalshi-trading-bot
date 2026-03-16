"""P&L tracking and performance metrics calculation."""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from pathlib import Path
import statistics


class PnLTracker:
    """Track P&L, win rate, and performance metrics."""

    def __init__(self, history_file: str = "trade_history.json"):
        self.history_file = Path(history_file)
        self.trades: List[Dict] = []
        self.daily_pnl: Dict[str, float] = {}
        self.load_history()

    def load_history(self) -> None:
        """Load trade history from file."""
        if self.history_file.exists():
            try:
                with open(self.history_file, 'r') as f:
                    data = json.load(f)
                    self.trades = data.get("trades", [])
            except (json.JSONDecodeError, IOError):
                self.trades = []

    def save_history(self) -> None:
        """Save trade history to file."""
        with open(self.history_file, 'w') as f:
            json.dump({
                "saved_at": datetime.utcnow().isoformat(),
                "trades": self.trades
            }, f, indent=2)

    def record_trade(self, ticker: str, side: str, size: float, price: float,
                    trader_username: str, mirror_of: Optional[str] = None) -> None:
        """Record a new trade execution."""
        trade = {
            "timestamp": datetime.utcnow().isoformat(),
            "ticker": ticker,
            "side": side,
            "size": size,
            "price": price,
            "value": size * price,
            "mirrored_from": mirror_of or trader_username,
            "status": "open"
        }
        self.trades.append(trade)
        self.save_history()

    def close_trade(self, trade_index: int, close_price: float, 
                   pnl: Optional[float] = None) -> None:
        """Mark a trade as closed."""
        if 0 <= trade_index < len(self.trades):
            trade = self.trades[trade_index]
            trade["close_price"] = close_price
            trade["closed_at"] = datetime.utcnow().isoformat()
            
            if pnl is None:
                entry_value = trade["size"] * trade["price"]
                exit_value = trade["size"] * close_price
                pnl = exit_value - entry_value if trade["side"].upper() == "BUY" else entry_value - exit_value
            
            trade["pnl"] = pnl
            trade["pnl_percent"] = (pnl / (trade["size"] * trade["price"])) * 100
            trade["status"] = "closed"
            self.save_history()

    def get_daily_pnl(self, date: Optional[datetime] = None) -> Tuple[float, float]:
        """Get P&L for a specific day.
        
        Returns: (pnl_dollars, pnl_percent)
        """
        if date is None:
            date = datetime.utcnow()
        
        date_str = date.strftime("%Y-%m-%d")
        closed_today = [
            t for t in self.trades
            if t.get("status") == "closed" and 
            t.get("closed_at", "").startswith(date_str)
        ]
        
        if not closed_today:
            return 0.0, 0.0
        
        total_pnl = sum(t.get("pnl", 0) for t in closed_today)
        total_value = sum(abs(t["size"] * t["price"]) for t in closed_today)
        pnl_percent = (total_pnl / total_value * 100) if total_value > 0 else 0.0
        
        return total_pnl, pnl_percent

    def get_cumulative_pnl(self) -> Tuple[float, float]:
        """Get total cumulative P&L.
        
        Returns: (pnl_dollars, pnl_percent)
        """
        closed_trades = [t for t in self.trades if t.get("status") == "closed"]
        
        if not closed_trades:
            return 0.0, 0.0
        
        total_pnl = sum(t.get("pnl", 0) for t in closed_trades)
        total_cost = sum(abs(t["size"] * t["price"]) for t in closed_trades)
        pnl_percent = (total_pnl / total_cost * 100) if total_cost > 0 else 0.0
        
        return total_pnl, pnl_percent

    def get_win_rate(self) -> float:
        """Calculate win rate percentage."""
        closed_trades = [t for t in self.trades if t.get("status") == "closed"]
        
        if not closed_trades:
            return 0.0
        
        winning_trades = sum(1 for t in closed_trades if t.get("pnl", 0) > 0)
        return (winning_trades / len(closed_trades)) * 100

    def get_open_positions(self) -> List[Dict]:
        """Get current open positions."""
        open_trades = [t for t in self.trades if t.get("status") == "open"]
        
        positions = {}
        for trade in open_trades:
            ticker = trade["ticker"]
            if ticker not in positions:
                positions[ticker] = {
                    "ticker": ticker,
                    "total_size": 0,
                    "avg_price": 0,
                    "entry_value": 0,
                    "trades": []
                }
            
            positions[ticker]["total_size"] += trade["size"]
            positions[ticker]["entry_value"] += trade["value"]
            positions[ticker]["trades"].append(trade)
        
        # Calculate average prices
        for ticker in positions:
            pos = positions[ticker]
            if pos["total_size"] > 0:
                pos["avg_price"] = pos["entry_value"] / pos["total_size"]
        
        return list(positions.values())

    def get_stats_summary(self) -> Dict:
        """Get comprehensive statistics summary."""
        closed_trades = [t for t in self.trades if t.get("status") == "closed"]
        open_trades = [t for t in self.trades if t.get("status") == "open"]
        
        # Calculate metrics
        total_pnl, total_pnl_percent = self.get_cumulative_pnl()
        daily_pnl, daily_pnl_percent = self.get_daily_pnl()
        win_rate = self.get_win_rate()
        
        # Sharpe ratio (simplified, assuming daily returns)
        if closed_trades:
            daily_returns = []
            for date_offset in range(30):  # Last 30 days
                day = datetime.utcnow() - timedelta(days=date_offset)
                day_pnl, _ = self.get_daily_pnl(day)
                daily_returns.append(day_pnl)
            
            if daily_returns and len(daily_returns) > 1:
                mean_return = statistics.mean(daily_returns)
                std_dev = statistics.stdev(daily_returns)
                sharpe_ratio = (mean_return / std_dev) if std_dev > 0 else 0.0
            else:
                sharpe_ratio = 0.0
        else:
            sharpe_ratio = 0.0
        
        return {
            "total_trades": len(self.trades),
            "closed_trades": len(closed_trades),
            "open_trades": len(open_trades),
            "winning_trades": sum(1 for t in closed_trades if t.get("pnl", 0) > 0),
            "losing_trades": sum(1 for t in closed_trades if t.get("pnl", 0) < 0),
            "total_pnl_dollars": round(total_pnl, 2),
            "total_pnl_percent": round(total_pnl_percent, 2),
            "daily_pnl_dollars": round(daily_pnl, 2),
            "daily_pnl_percent": round(daily_pnl_percent, 2),
            "win_rate_percent": round(win_rate, 2),
            "sharpe_ratio": round(sharpe_ratio, 2),
            "avg_win": round(
                statistics.mean([t.get("pnl", 0) for t in closed_trades if t.get("pnl", 0) > 0]) 
                if any(t.get("pnl", 0) > 0 for t in closed_trades) else 0, 2
            ),
            "avg_loss": round(
                statistics.mean([t.get("pnl", 0) for t in closed_trades if t.get("pnl", 0) < 0])
                if any(t.get("pnl", 0) < 0 for t in closed_trades) else 0, 2
            ),
            "largest_win": round(
                max([t.get("pnl", 0) for t in closed_trades]) if closed_trades else 0, 2
            ),
            "largest_loss": round(
                min([t.get("pnl", 0) for t in closed_trades]) if closed_trades else 0, 2
            )
        }

    def print_summary(self) -> None:
        """Print formatted summary."""
        stats = self.get_stats_summary()
        
        print("\n" + "="*80)
        print("PERFORMANCE SUMMARY".center(80))
        print("="*80)
        
        print(f"\n📊 Overview")
        print(f"   Total Trades: {stats['total_trades']}")
        print(f"   Closed: {stats['closed_trades']} | Open: {stats['open_trades']}")
        print(f"   Won: {stats['winning_trades']} | Lost: {stats['losing_trades']}")
        
        print(f"\n💰 P&L")
        pnl_str = f"${stats['total_pnl_dollars']:+.2f}"
        pnl_pct_str = f"{stats['total_pnl_percent']:+.2f}%"
        print(f"   Total: {pnl_str} ({pnl_pct_str})")
        pnl_daily = f"${stats['daily_pnl_dollars']:+.2f}"
        pnl_daily_pct = f"{stats['daily_pnl_percent']:+.2f}%"
        print(f"   Daily: {pnl_daily} ({pnl_daily_pct})")
        
        print(f"\n📈 Metrics")
        print(f"   Win Rate: {stats['win_rate_percent']:.1f}%")
        print(f"   Sharpe Ratio: {stats['sharpe_ratio']:.2f}")
        print(f"   Avg Win: ${stats['avg_win']:.2f} | Avg Loss: ${stats['avg_loss']:.2f}")
        print(f"   Best: ${stats['largest_win']:.2f} | Worst: ${stats['largest_loss']:.2f}")
        
        print("\n" + "="*80)
