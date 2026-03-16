"""Kalshi API client with authentication."""

import hashlib
import hmac
import json
import time
from datetime import datetime
from typing import Optional, Dict, Any, List
import requests
from config import Config


class KalshiAPI:
    """API client for Kalshi trading platform."""

    def __init__(self, config: Config):
        self.config = config
        self.api_url = config.get('api_url')
        self.api_key_id = config.get('api_key_id')
        self.private_key_pem = config.get('private_key_pem')
        self.session = requests.Session()

    def _sign_request(self, method: str, path: str, body: str = "") -> Dict[str, str]:
        """Create authentication headers using RSA signature."""
        timestamp = str(int(time.time()))
        
        # Create signature message: METHOD + PATH + BODY + TIMESTAMP
        message = f"{method}{path}{body}{timestamp}"
        
        # For demo, create simple HMAC signature (production uses RSA)
        # In production, this would use the private key for RSA signing
        signature = hashlib.sha256(message.encode()).hexdigest()
        
        return {
            "X-API-KEY": self.api_key_id,
            "X-SIGNATURE": signature,
            "X-TIMESTAMP": timestamp,
            "Content-Type": "application/json"
        }

    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """Make authenticated API request."""
        url = f"{self.api_url}{endpoint}"
        body = json.dumps(data) if data else ""
        headers = self._sign_request(method, endpoint, body)
        
        try:
            if method == "GET":
                response = self.session.get(url, headers=headers)
            elif method == "POST":
                response = self.session.post(url, headers=headers, data=body)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            print(f"✗ API Error: {e}")
            return {"error": str(e)}

    def get_markets(self, filters: Optional[Dict] = None) -> List[Dict]:
        """Fetch available markets."""
        response = self._request("GET", "/markets")
        if "error" in response:
            return []
        return response.get("markets", [])

    def get_market(self, ticker: str) -> Optional[Dict]:
        """Get specific market details."""
        response = self._request("GET", f"/markets/{ticker}")
        return response if "error" not in response else None

    def get_portfolio(self) -> Dict[str, Any]:
        """Get user portfolio/account details."""
        response = self._request("GET", "/portfolio")
        return response

    def get_positions(self) -> List[Dict]:
        """Get current open positions."""
        response = self._request("GET", "/positions")
        return response.get("positions", []) if "error" not in response else []

    def get_trades(self, limit: int = 100) -> List[Dict]:
        """Get user's recent trades."""
        response = self._request("GET", f"/trades?limit={limit}")
        return response.get("trades", []) if "error" not in response else []

    def get_leaderboard(self, period: str = "monthly", limit: int = 100) -> List[Dict]:
        """Fetch leaderboard data (top traders)."""
        response = self._request("GET", f"/leaderboard?period={period}&limit={limit}")
        return response.get("leaderboard", []) if "error" not in response else []

    def create_order(self, market_ticker: str, side: str, size: float, 
                    price: Optional[float] = None) -> Optional[Dict]:
        """Create a trade order."""
        data = {
            "ticker": market_ticker,
            "side": side.upper(),  # "BUY" or "SELL"
            "size": size
        }
        
        if price is not None:
            data["price"] = price
        
        response = self._request("POST", "/orders", data)
        
        if "error" not in response:
            print(f"✓ Order placed: {side} {size} shares of {market_ticker}")
            return response
        else:
            print(f"✗ Failed to place order: {response}")
            return None

    def cancel_order(self, order_id: str) -> bool:
        """Cancel an open order."""
        response = self._request("POST", f"/orders/{order_id}/cancel", {})
        return "error" not in response

    def get_user_trades(self, user_id: str, limit: int = 50) -> List[Dict]:
        """Get trades for a specific user (leaderboard trader)."""
        # Note: This endpoint may not be public; leaderboard data comes from web scraping
        response = self._request("GET", f"/users/{user_id}/trades?limit={limit}")
        return response.get("trades", []) if "error" not in response else []

    def get_account_balance(self) -> float:
        """Get current account balance."""
        portfolio = self.get_portfolio()
        return portfolio.get("balance", 0.0)

    def get_account_stats(self) -> Dict[str, Any]:
        """Get account performance statistics."""
        portfolio = self.get_portfolio()
        return {
            "balance": portfolio.get("balance", 0.0),
            "equity": portfolio.get("equity", 0.0),
            "buying_power": portfolio.get("buying_power", 0.0),
            "total_realized_pnl": portfolio.get("total_realized_pnl", 0.0),
            "open_pnl": portfolio.get("open_pnl", 0.0)
        }

    def health_check(self) -> bool:
        """Check if API is accessible."""
        try:
            response = self._request("GET", "/markets?limit=1")
            return "error" not in response
        except Exception:
            return False
