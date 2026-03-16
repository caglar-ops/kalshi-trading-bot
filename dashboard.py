"""Flask dashboard for live P&L tracking."""

import json
from datetime import datetime
from flask import Flask, render_template, jsonify
from flask_cors import CORS
from kalshi_api import KalshiAPI
from leaderboard_scraper import LeaderboardScraper
from trade_mirror import TradeMirror
from pnl_tracker import PnLTracker
from config import Config


class Dashboard:
    """Web dashboard for bot metrics."""

    def __init__(self, api: KalshiAPI, scraper: LeaderboardScraper,
                 mirror: TradeMirror, pnl_tracker: PnLTracker):
        self.app = Flask(__name__, template_folder='templates')
        CORS(self.app)
        
        self.api = api
        self.scraper = scraper
        self.mirror = mirror
        self.pnl_tracker = pnl_tracker
        
        self._register_routes()

    def _register_routes(self):
        """Register Flask routes."""
        
        @self.app.route('/')
        def index():
            return render_template('dashboard.html')
        
        @self.app.route('/api/stats')
        def get_stats():
            stats = self.pnl_tracker.get_stats_summary()
            account = self.api.get_account_stats()
            
            return jsonify({
                "timestamp": datetime.utcnow().isoformat(),
                "account": {
                    "balance": account.get("balance", 0),
                    "equity": account.get("equity", 0),
                    "buying_power": account.get("buying_power", 0)
                },
                "pnl": {
                    "total_dollars": stats.get("total_pnl_dollars"),
                    "total_percent": stats.get("total_pnl_percent"),
                    "daily_dollars": stats.get("daily_pnl_dollars"),
                    "daily_percent": stats.get("daily_pnl_percent")
                },
                "performance": {
                    "win_rate": stats.get("win_rate_percent"),
                    "sharpe_ratio": stats.get("sharpe_ratio"),
                    "total_trades": stats.get("total_trades"),
                    "winning_trades": stats.get("winning_trades"),
                    "losing_trades": stats.get("losing_trades")
                }
            })
        
        @self.app.route('/api/positions')
        def get_positions():
            positions = self.pnl_tracker.get_open_positions()
            return jsonify({"positions": positions})
        
        @self.app.route('/api/top-traders')
        def get_top_traders():
            traders = self.scraper.get_top_traders()
            return jsonify({"traders": traders})
        
        @self.app.route('/api/strategies')
        def get_strategies():
            strategies = self.mirror.get_trader_strategies()
            return jsonify({"strategies": strategies})
        
        @self.app.route('/api/recent-trades')
        def get_recent_trades():
            trades = self.pnl_tracker.trades[-20:]  # Last 20 trades
            return jsonify({"trades": trades})

    def run(self, host: str = "localhost", port: int = 5000, debug: bool = False):
        """Start the dashboard server."""
        print(f"\n🚀 Dashboard running at http://{host}:{port}")
        self.app.run(host=host, port=port, debug=debug, use_reloader=False)
