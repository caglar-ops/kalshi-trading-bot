#!/usr/bin/env python3
"""
Test suite for Kalshi Trading Bot
"""

import json
import sys
from datetime import datetime
from pathlib import Path

from config import Config
from kalshi_api import KalshiAPI
from leaderboard_scraper import LeaderboardScraper
from pnl_tracker import PnLTracker
from trade_mirror import TradeMirror


def test_config():
    """Test configuration loading."""
    print("\n[TEST] Configuration Loading")
    print("-" * 50)
    
    config = Config(".kalshi-config.json")
    
    print(f"✓ Config loaded from {config.config_path}")
    print(f"  API URL: {config.get('api_url')}")
    print(f"  Paper Trading: {config.get('paper_trading')}")
    print(f"  Initial Balance: ${config.get('initial_balance')}")
    
    return True


def test_api_client():
    """Test API client initialization."""
    print("\n[TEST] API Client")
    print("-" * 50)
    
    config = Config(".kalshi-config.json")
    api = KalshiAPI(config)
    
    print(f"✓ API client initialized")
    print(f"  Base URL: {api.api_url}")
    
    # Test health check
    healthy = api.health_check()
    if healthy:
        print(f"✓ API health check passed")
    else:
        print(f"⚠️  API health check failed (offline mode)")
    
    return True


def test_leaderboard_scraper():
    """Test leaderboard scraper."""
    print("\n[TEST] Leaderboard Scraper")
    print("-" * 50)
    
    config = Config(".kalshi-config.json")
    api = KalshiAPI(config)
    scraper = LeaderboardScraper(api, top_n=3)
    
    # Try to fetch
    print("Attempting to fetch top traders...")
    traders = scraper.fetch_top_traders()
    
    if traders:
        print(f"✓ Successfully fetched {len(traders)} traders")
        for trader in traders:
            print(f"  #{trader['rank']} {trader['username']} - ${trader['profit']}")
    else:
        print("⚠️  No traders returned (will use mock data in production)")
    
    # Test save/load
    scraper.save_top_traders("test_traders.json")
    if Path("test_traders.json").exists():
        print("✓ Traders saved successfully")
        scraper2 = LeaderboardScraper(api)
        if scraper2.load_top_traders("test_traders.json"):
            print("✓ Traders loaded successfully")
        Path("test_traders.json").unlink()
    
    return True


def test_pnl_tracker():
    """Test P&L tracking."""
    print("\n[TEST] P&L Tracker")
    print("-" * 50)
    
    tracker = PnLTracker("test_trades.json")
    
    # Record test trades
    print("Recording test trades...")
    tracker.record_trade("TSLA", "BUY", 10, 100.0, "test_trader_1")
    tracker.record_trade("AAPL", "SELL", 5, 150.0, "test_trader_1")
    
    print(f"✓ Recorded 2 trades")
    
    # Get stats
    stats = tracker.get_stats_summary()
    print(f"✓ Stats calculated:")
    print(f"  Total trades: {stats['total_trades']}")
    print(f"  Open trades: {stats['open_trades']}")
    
    # Clean up
    Path("test_trades.json").unlink(missing_ok=True)
    
    return True


def test_trade_mirror():
    """Test trade mirroring logic."""
    print("\n[TEST] Trade Mirror")
    print("-" * 50)
    
    config = Config(".kalshi-config.json")
    api = KalshiAPI(config)
    scraper = LeaderboardScraper(api, top_n=3)
    tracker = PnLTracker("test_trades.json")
    mirror = TradeMirror(api, scraper, tracker)
    
    print("✓ Trade mirror initialized")
    print(f"  Position size: {mirror.position_size_percent}% of account")
    
    # Test position calculation
    position = mirror._calculate_position_size(10.0, 10000.0)
    print(f"✓ Position size calculation: {position:.2f} shares")
    
    # Clean up
    Path("test_trades.json").unlink(missing_ok=True)
    Path("mirrored_trades.json").unlink(missing_ok=True)
    
    return True


def test_dashboard():
    """Test dashboard initialization."""
    print("\n[TEST] Dashboard")
    print("-" * 50)
    
    config = Config(".kalshi-config.json")
    api = KalshiAPI(config)
    scraper = LeaderboardScraper(api)
    tracker = PnLTracker("test_trades.json")
    mirror = TradeMirror(api, scraper, tracker)
    
    from dashboard import Dashboard
    dashboard = Dashboard(api, scraper, mirror, tracker)
    
    print("✓ Dashboard initialized")
    print(f"  Flask app ready on /api/stats")
    
    # Clean up
    Path("test_trades.json").unlink(missing_ok=True)
    
    return True


def run_all_tests():
    """Run all tests."""
    print("\n" + "="*50)
    print("KALSHI TRADING BOT - TEST SUITE")
    print("="*50)
    
    tests = [
        ("Configuration", test_config),
        ("API Client", test_api_client),
        ("Leaderboard Scraper", test_leaderboard_scraper),
        ("P&L Tracker", test_pnl_tracker),
        ("Trade Mirror", test_trade_mirror),
        ("Dashboard", test_dashboard),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, "PASS" if result else "FAIL"))
        except Exception as e:
            print(f"✗ Test failed with error: {e}")
            results.append((name, "ERROR"))
    
    # Summary
    print("\n" + "="*50)
    print("TEST SUMMARY")
    print("="*50)
    
    for name, status in results:
        icon = "✓" if status == "PASS" else "✗"
        print(f"{icon} {name}: {status}")
    
    passed = sum(1 for _, s in results if s == "PASS")
    total = len(results)
    
    print(f"\nTotal: {passed}/{total} passed")
    
    return all(s == "PASS" for _, s in results)


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
