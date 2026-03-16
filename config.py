"""Configuration management for Kalshi Trading Bot."""

import json
import os
from pathlib import Path
from typing import Optional, Dict, Any


class Config:
    """Load and manage bot configuration."""

    def __init__(self, config_path: str = ".kalshi-config.json"):
        self.config_path = Path(config_path)
        self.config: Dict[str, Any] = {}
        self.load()

    def load(self) -> None:
        """Load configuration from file."""
        if not self.config_path.exists():
            self._create_default_config()
        
        try:
            with open(self.config_path, 'r') as f:
                self.config = json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            raise ValueError(f"Failed to load config from {self.config_path}: {e}")

    def _create_default_config(self) -> None:
        """Create default configuration file."""
        default_config = {
            "api_url": "https://demo-api.kalshi.co/trade-api/v2",
            "api_key_id": "YOUR_API_KEY_ID",
            "private_key_pem": "-----BEGIN RSA PRIVATE KEY-----\nPASTE_YOUR_PRIVATE_KEY_HERE\n-----END RSA PRIVATE KEY-----",
            "paper_trading": True,
            "initial_balance": 100.00,
            "leaderboard_check_interval": 300,
            "trade_mirror_interval": 300,
            "max_position_size_percent": 10.0,
            "min_balance_before_trade": 10.0,
            "top_traders_count": 3,
            "timezone": "UTC"
        }
        
        with open(self.config_path, 'w') as f:
            json.dump(default_config, f, indent=2)
        
        print(f"✓ Created default config at {self.config_path}")
        print("⚠️  Please configure your API credentials in .kalshi-config.json")

    def get(self, key: str, default: Optional[Any] = None) -> Any:
        """Get configuration value."""
        return self.config.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """Set configuration value and save."""
        self.config[key] = value
        self.save()

    def save(self) -> None:
        """Save configuration to file."""
        with open(self.config_path, 'w') as f:
            json.dump(self.config, f, indent=2)

    def validate(self) -> bool:
        """Validate configuration."""
        required_keys = ['api_url', 'api_key_id', 'private_key_pem']
        
        for key in required_keys:
            if not self.get(key) or self.get(key).startswith('YOUR_'):
                print(f"✗ Missing or invalid config: {key}")
                return False
        
        return True

    def __repr__(self) -> str:
        """String representation (hide sensitive data)."""
        safe_config = self.config.copy()
        safe_config['private_key_pem'] = '***REDACTED***'
        safe_config['api_key_id'] = '***REDACTED***'
        return f"Config({safe_config})"
