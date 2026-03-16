"""Leaderboard scraper to identify top traders."""

import json
from typing import List, Dict, Optional
from datetime import datetime
import requests
from bs4 import BeautifulSoup
from kalshi_api import KalshiAPI


class LeaderboardScraper:
    """Scrapes and tracks top traders from Kalshi leaderboard."""

    def __init__(self, api: KalshiAPI, top_n: int = 3):
        self.api = api
        self.top_n = top_n
        self.top_traders: List[Dict] = []
        self.last_update: Optional[datetime] = None

    def fetch_top_traders(self, period: str = "monthly") -> List[Dict]:
        """Fetch top traders from leaderboard."""
        try:
            # Try API first
            leaderboard = self.api.get_leaderboard(period=period, limit=self.top_n)
            
            if leaderboard:
                self.top_traders = self._format_traders(leaderboard[:self.top_n])
                self.last_update = datetime.utcnow()
                return self.top_traders
            else:
                # Fallback to web scraping
                return self._scrape_web_leaderboard(period)
        except Exception as e:
            print(f"✗ Failed to fetch leaderboard: {e}")
            return self.top_traders

    def _format_traders(self, traders: List[Dict]) -> List[Dict]:
        """Format trader data."""
        formatted = []
        for rank, trader in enumerate(traders, 1):
            formatted.append({
                "rank": rank,
                "username": trader.get("username", f"trader_{rank}"),
                "user_id": trader.get("user_id", trader.get("id")),
                "profit": trader.get("profit", 0.0),
                "roi": trader.get("roi", 0.0),
                "win_rate": trader.get("win_rate", 0.0),
                "trades_count": trader.get("trades_count", 0),
                "followers": trader.get("followers", 0),
                "last_trade": trader.get("last_trade_timestamp"),
                "tracked_since": datetime.utcnow().isoformat()
            })
        return formatted

    def _scrape_web_leaderboard(self, period: str = "monthly") -> List[Dict]:
        """Fallback: Scrape leaderboard from web UI."""
        try:
            url = "https://kalshi.com/social/leaderboard"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Parse leaderboard table (structure may vary)
            traders = []
            leaderboard_rows = soup.find_all('tr')[1:self.top_n + 1]  # Skip header
            
            for idx, row in enumerate(leaderboard_rows, 1):
                cols = row.find_all('td')
                if len(cols) >= 4:
                    trader = {
                        "rank": idx,
                        "username": cols[0].text.strip(),
                        "profit": float(cols[1].text.replace('$', '').replace(',', '')),
                        "roi": float(cols[2].text.replace('%', '')),
                        "trades_count": int(cols[3].text),
                        "win_rate": 0.0,  # May need adjustment based on actual HTML
                        "tracked_since": datetime.utcnow().isoformat()
                    }
                    traders.append(trader)
            
            self.top_traders = traders
            self.last_update = datetime.utcnow()
            return traders
            
        except Exception as e:
            print(f"✗ Web scraping failed: {e}")
            return []

    def get_top_traders(self) -> List[Dict]:
        """Get current top traders."""
        return self.top_traders

    def get_trader_by_rank(self, rank: int) -> Optional[Dict]:
        """Get specific trader by rank."""
        for trader in self.top_traders:
            if trader.get("rank") == rank:
                return trader
        return None

    def monitor_trader(self, user_id: str) -> List[Dict]:
        """Get recent trades from a specific trader."""
        try:
            trades = self.api.get_user_trades(user_id, limit=10)
            return trades
        except Exception as e:
            print(f"✗ Failed to fetch trades for user {user_id}: {e}")
            return []

    def save_top_traders(self, filepath: str = "top_traders.json") -> None:
        """Save top traders to file."""
        with open(filepath, 'w') as f:
            json.dump({
                "updated_at": datetime.utcnow().isoformat(),
                "traders": self.top_traders
            }, f, indent=2)

    def load_top_traders(self, filepath: str = "top_traders.json") -> bool:
        """Load top traders from file."""
        try:
            with open(filepath, 'r') as f:
                data = json.load(f)
                self.top_traders = data.get("traders", [])
                return bool(self.top_traders)
        except FileNotFoundError:
            return False

    def print_leaderboard(self) -> None:
        """Print formatted leaderboard."""
        print("\n" + "="*80)
        print("TOP TRADERS (This Month)".center(80))
        print("="*80)
        
        if not self.top_traders:
            print("No traders loaded")
            return
        
        for trader in self.top_traders:
            rank = trader.get("rank", "?")
            username = trader.get("username", "Unknown")
            profit = trader.get("profit", 0)
            roi = trader.get("roi", 0)
            trades = trader.get("trades_count", 0)
            win_rate = trader.get("win_rate", 0)
            
            print(f"\n#{rank} {username}")
            print(f"   Profit: ${profit:,.2f} | ROI: {roi:.1f}% | Win Rate: {win_rate:.1f}%")
            print(f"   Trades: {trades} | Followers: {trader.get('followers', 0)}")
