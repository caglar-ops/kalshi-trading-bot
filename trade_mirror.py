"""Trade mirroring engine - mirrors top trader positions."""

import json
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path
from kalshi_api import KalshiAPI
from leaderboard_scraper import LeaderboardScraper
from pnl_tracker import PnLTracker


class TradeMirror:
    """Mirrors trades from top traders."""

    def __init__(self, api: KalshiAPI, scraper: LeaderboardScraper, 
                 pnl_tracker: PnLTracker, position_size_percent: float = 10.0):
        self.api = api
        self.scraper = scraper
        self.pnl_tracker = pnl_tracker
        self.position_size_percent = position_size_percent
        self.mirrored_trades: List[Dict] = []
        self.trader_trades_cache: Dict[str, List[Dict]] = {}
        self.load_mirrored_trades()

    def load_mirrored_trades(self) -> None:
        """Load previously mirrored trades."""
        filepath = Path("mirrored_trades.json")
        if filepath.exists():
            try:
                with open(filepath, 'r') as f:
                    data = json.load(f)
                    self.mirrored_trades = data.get("mirrored_trades", [])
            except json.JSONDecodeError:
                self.mirrored_trades = []

    def save_mirrored_trades(self) -> None:
        """Save mirrored trades log."""
        with open("mirrored_trades.json", 'w') as f:
            json.dump({
                "saved_at": datetime.utcnow().isoformat(),
                "mirrored_trades": self.mirrored_trades
            }, f, indent=2)

    def _get_trader_recent_trades(self, user_id: str) -> List[Dict]:
        """Fetch recent trades from a trader."""
        if user_id in self.trader_trades_cache:
            return self.trader_trades_cache[user_id]
        
        try:
            trades = self.api.get_user_trades(user_id, limit=10)
            self.trader_trades_cache[user_id] = trades
            return trades
        except Exception as e:
            print(f"✗ Failed to fetch trades for {user_id}: {e}")
            return []

    def _calculate_position_size(self, trader_size: float, 
                                 trader_balance: Optional[float] = None) -> float:
        """Calculate appropriate position size for our account."""
        account_balance = self.api.get_account_balance()
        max_position = account_balance * (self.position_size_percent / 100)
        
        # Scale trader's position to our account size
        scaled_position = trader_size * (account_balance / (trader_balance or 10000))
        
        # Use minimum of scaled position or max allowed
        return min(scaled_position, max_position)

    def _has_executed_trade(self, trader_id: str, trader_ticker: str, 
                           trader_timestamp: str) -> bool:
        """Check if we've already mirrored this trade."""
        for mirrored in self.mirrored_trades:
            if (mirrored.get("source_trader_id") == trader_id and
                mirrored.get("ticker") == trader_ticker and
                mirrored.get("source_timestamp") == trader_timestamp):
                return True
        return False

    def mirror_top_traders(self) -> int:
        """Mirror recent trades from top 3 traders."""
        traders = self.scraper.get_top_traders()
        
        if not traders:
            print("⚠️  No top traders loaded")
            return 0
        
        total_mirrored = 0
        balance = self.api.get_account_balance()
        min_balance = 5.0  # Keep minimum balance
        
        for trader in traders:
            user_id = trader.get("user_id")
            username = trader.get("username")
            
            print(f"\n🔍 Checking trades from #{trader.get('rank')} {username}")
            
            trades = self._get_trader_recent_trades(user_id)
            
            if not trades:
                print(f"   No recent trades found")
                continue
            
            for trade in trades:
                ticker = trade.get("ticker")
                side = trade.get("side", "BUY").upper()
                size = trade.get("size", 1.0)
                price = trade.get("price", 0.0)
                timestamp = trade.get("timestamp")
                
                # Skip if already mirrored
                if self._has_executed_trade(user_id, ticker, timestamp):
                    continue
                
                # Check balance
                required_balance = size * price
                if balance - required_balance < min_balance:
                    print(f"   ⚠️  Insufficient balance for {ticker}")
                    continue
                
                # Mirror the trade
                position_size = self._calculate_position_size(size)
                
                if position_size < 0.1:  # Minimum order size
                    print(f"   ⚠️  Position size too small for {ticker}")
                    continue
                
                print(f"   📌 Mirroring: {side} {position_size:.2f} of {ticker}")
                
                # Execute order
                order = self.api.create_order(ticker, side, position_size, price)
                
                if order and "error" not in order:
                    # Log mirrored trade
                    mirrored = {
                        "mirrored_at": datetime.utcnow().isoformat(),
                        "source_trader_id": user_id,
                        "source_trader_name": username,
                        "source_timestamp": timestamp,
                        "ticker": ticker,
                        "side": side,
                        "mirrored_size": position_size,
                        "source_size": size,
                        "price": price,
                        "order_id": order.get("id"),
                        "status": "executed"
                    }
                    self.mirrored_trades.append(mirrored)
                    self.pnl_tracker.record_trade(
                        ticker=ticker,
                        side=side,
                        size=position_size,
                        price=price,
                        trader_username=username,
                        mirror_of=username
                    )
                    
                    balance -= required_balance
                    total_mirrored += 1
                else:
                    print(f"   ✗ Failed to execute order")
        
        self.save_mirrored_trades()
        return total_mirrored

    def get_mirrored_trades(self, trader_name: Optional[str] = None) -> List[Dict]:
        """Get mirrored trades, optionally filtered by trader."""
        if trader_name:
            return [t for t in self.mirrored_trades 
                   if t.get("source_trader_name") == trader_name]
        return self.mirrored_trades

    def get_trader_strategies(self) -> Dict[str, Dict]:
        """Get strategies from mirrored top traders."""
        strategies = {}
        
        for trader in self.scraper.get_top_traders():
            username = trader.get("username")
            trades = self.get_mirrored_trades(username)
            
            if trades:
                ticker_counts = {}
                for trade in trades:
                    ticker = trade.get("ticker")
                    ticker_counts[ticker] = ticker_counts.get(ticker, 0) + 1
                
                strategies[username] = {
                    "rank": trader.get("rank"),
                    "profit": trader.get("profit"),
                    "win_rate": trader.get("win_rate"),
                    "total_mirrored": len(trades),
                    "favorite_tickers": sorted(
                        ticker_counts.items(),
                        key=lambda x: x[1],
                        reverse=True
                    )[:5]
                }
        
        return strategies

    def print_mirrored_summary(self) -> None:
        """Print summary of mirroring activity."""
        print("\n" + "="*80)
        print("TRADE MIRRORING SUMMARY".center(80))
        print("="*80)
        
        strategies = self.get_trader_strategies()
        
        if not strategies:
            print("\nNo mirrored trades yet")
            return
        
        for trader_name, strategy in strategies.items():
            print(f"\n🎯 {trader_name}")
            print(f"   Rank: #{strategy['rank']}")
            print(f"   Mirrored Trades: {strategy['total_mirrored']}")
            print(f"   Win Rate: {strategy['win_rate']:.1f}%")
            print(f"   Top Tickers: {', '.join([f'{t[0]}({t[1]})' for t in strategy['favorite_tickers']])}")
