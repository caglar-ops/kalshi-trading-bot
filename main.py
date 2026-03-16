#!/usr/bin/env python3
"""
Kalshi Trading Bot - Main orchestrator
Mirrors top trader positions and tracks live P&L
"""

import argparse
import time
import threading
import sys
from datetime import datetime
from pathlib import Path

from config import Config
from kalshi_api import KalshiAPI
from leaderboard_scraper import LeaderboardScraper
from trade_mirror import TradeMirror
from pnl_tracker import PnLTracker
from dashboard import Dashboard


class KalshiBot:
    """Main bot orchestrator."""

    def __init__(self, config: Config):
        self.config = config
        self.api = KalshiAPI(config)
        self.scraper = LeaderboardScraper(self.api, top_n=3)
        self.pnl_tracker = PnLTracker()
        self.mirror = TradeMirror(self.api, self.scraper, self.pnl_tracker)
        self.dashboard = Dashboard(self.api, self.scraper, self.mirror, self.pnl_tracker)
        self.running = False

    def initialize(self) -> bool:
        """Initialize and validate bot setup."""
        print("\n" + "="*80)
        print("🤖 KALSHI TRADING BOT - INITIALIZATION".center(80))
        print("="*80)
        
        # Validate config
        print("\n📋 Checking configuration...")
        if not self.config.validate():
            print("✗ Configuration invalid. Please set up .kalshi-config.json")
            return False
        print("✓ Configuration valid")
        
        # Test API connection
        print("\n🔗 Testing API connection...")
        if not self.api.health_check():
            print("✗ Cannot connect to Kalshi API")
            print(f"  URL: {self.config.get('api_url')}")
            return False
        print("✓ API connection successful")
        
        # Check account
        print("\n💳 Checking account...")
        try:
            balance = self.api.get_account_balance()
            print(f"✓ Account balance: ${balance:.2f}")
        except Exception as e:
            print(f"✗ Cannot retrieve account info: {e}")
            return False
        
        # Fetch top traders
        print("\n🏆 Fetching top traders...")
        traders = self.scraper.fetch_top_traders()
        if traders:
            print(f"✓ Found {len(traders)} top traders")
            self.scraper.print_leaderboard()
        else:
            print("⚠️  Could not fetch top traders (will retry)")
        
        print("\n" + "="*80)
        return True

    def run_leaderboard_monitor(self, interval: int = 300) -> None:
        """Monitor leaderboard periodically."""
        print("\n📊 Starting leaderboard monitor (every {} seconds)".format(interval))
        
        while self.running:
            try:
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Checking leaderboard...")
                traders = self.scraper.fetch_top_traders()
                
                if traders:
                    print(f"✓ Updated {len(traders)} top traders")
                else:
                    print("⚠️  Could not update leaderboard")
                    
            except Exception as e:
                print(f"✗ Leaderboard monitor error: {e}")
            
            # Sleep in small intervals to allow graceful shutdown
            for _ in range(interval // 5):
                if not self.running:
                    break
                time.sleep(5)

    def run_trade_mirror(self, interval: int = 300) -> None:
        """Monitor and mirror trades periodically."""
        print("\n🔄 Starting trade mirror (every {} seconds)".format(interval))
        
        while self.running:
            try:
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Checking for trades to mirror...")
                count = self.mirror.mirror_top_traders()
                
                if count > 0:
                    print(f"✓ Mirrored {count} new trades")
                    self.mirror.print_mirrored_summary()
                else:
                    print("ℹ️  No new trades to mirror")
                    
            except Exception as e:
                print(f"✗ Trade mirror error: {e}")
            
            # Sleep in small intervals to allow graceful shutdown
            for _ in range(interval // 5):
                if not self.running:
                    break
                time.sleep(5)

    def run(self, paper_trading: bool = True, dashboard: bool = True, 
            leaderboard_interval: int = 300, trade_interval: int = 300) -> None:
        """Run the bot."""
        
        # Initialize
        if not self.initialize():
            print("\n✗ Initialization failed")
            return
        
        print("\n" + "="*80)
        if paper_trading:
            print("📝 PAPER TRADING MODE - No real money".center(80))
        else:
            print("🔴 LIVE TRADING MODE - Use with caution!".center(80))
        print("="*80)
        
        self.running = True
        threads = []
        
        # Start background threads
        if paper_trading or True:  # Always run these monitors
            leaderboard_thread = threading.Thread(
                target=self.run_leaderboard_monitor,
                args=(leaderboard_interval,),
                daemon=True
            )
            leaderboard_thread.start()
            threads.append(leaderboard_thread)
            
            mirror_thread = threading.Thread(
                target=self.run_trade_mirror,
                args=(trade_interval,),
                daemon=True
            )
            mirror_thread.start()
            threads.append(mirror_thread)
        
        # Start dashboard
        if dashboard:
            print("\n🌐 Starting web dashboard at http://localhost:5000")
            print("   Open browser and navigate to http://localhost:5000")
            try:
                self.dashboard.run(host="0.0.0.0", port=5000, debug=False)
            except KeyboardInterrupt:
                print("\n\n⚠️  Dashboard interrupted")
        
        # Keep main thread alive
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\n⏹️  Shutting down...")
            self.running = False
            for thread in threads:
                thread.join(timeout=5)
            print("✓ Bot stopped")

    def stats(self) -> None:
        """Print current statistics."""
        print("\n" + "="*80)
        print("📊 KALSHI TRADING BOT STATISTICS".center(80))
        print("="*80)
        
        self.pnl_tracker.print_summary()
        
        print("\n" + "="*80)
        print("TOP TRADERS".center(80))
        print("="*80)
        self.scraper.print_leaderboard()
        
        print("\n" + "="*80)
        print("MIRRORED TRADES".center(80))
        print("="*80)
        self.mirror.print_mirrored_summary()


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Kalshi Trading Bot - Mirror top traders and track P&L",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run with dashboard and paper trading
  python main.py
  
  # Show statistics only
  python main.py --stats
  
  # Run without dashboard (headless)
  python main.py --no-dashboard
  
  # Custom intervals
  python main.py --leaderboard-interval 600 --trade-interval 300
        """
    )
    
    parser.add_argument(
        "--config",
        default=".kalshi-config.json",
        help="Path to config file (default: .kalshi-config.json)"
    )
    parser.add_argument(
        "--paper",
        action="store_true",
        default=True,
        help="Run in paper trading mode (default: True)"
    )
    parser.add_argument(
        "--live",
        action="store_true",
        help="Run in live trading mode (use with caution!)"
    )
    parser.add_argument(
        "--dashboard",
        action="store_true",
        default=True,
        help="Show web dashboard (default: True)"
    )
    parser.add_argument(
        "--no-dashboard",
        action="store_true",
        help="Disable web dashboard"
    )
    parser.add_argument(
        "--stats",
        action="store_true",
        help="Show statistics and exit"
    )
    parser.add_argument(
        "--leaderboard-interval",
        type=int,
        default=300,
        help="Leaderboard check interval in seconds (default: 300)"
    )
    parser.add_argument(
        "--trade-interval",
        type=int,
        default=300,
        help="Trade mirror interval in seconds (default: 300)"
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run in test mode (dry-run, no actual orders)"
    )
    
    args = parser.parse_args()
    
    # Validate live mode
    if args.live and not args.paper:
        response = input("\n⚠️  LIVE TRADING MODE - This will use real money!\nType 'YES' to confirm: ")
        if response != "YES":
            print("Cancelled")
            return
    
    # Load config
    config = Config(args.config)
    
    # Create bot
    bot = KalshiBot(config)
    
    # Execute command
    if args.stats:
        bot.stats()
    else:
        paper_mode = args.live is False
        use_dashboard = not args.no_dashboard and args.dashboard
        bot.run(
            paper_trading=paper_mode,
            dashboard=use_dashboard,
            leaderboard_interval=args.leaderboard_interval,
            trade_interval=args.trade_interval
        )


if __name__ == "__main__":
    main()
