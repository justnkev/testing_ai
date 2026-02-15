"""Configuration management for Reddit Alpha Engine.

Loads environment variables and provides validated configuration objects.

API KEYS REQUIRED:
- REDDIT_CLIENT_ID: From https://www.reddit.com/prefs/apps
- REDDIT_CLIENT_SECRET: From https://www.reddit.com/prefs/apps  
- GEMINI_API_KEY: From https://aistudio.google.com/app/apikey
- KALSHI_API_KEY (optional): From Kalshi account settings
- KALSHI_PRIVATE_KEY_PATH (optional): Path to RSA private key
"""

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Default subreddits to scan for sentiment
DEFAULT_SUBREDDITS: List[str] = [
    "wallstreetbets",
    "polymarket", 
    "news",
    "politics",
]

# Maximum age of market data before it's considered stale (in seconds)
MAX_MARKET_DATA_AGE_SECONDS: int = 15 * 60  # 15 minutes


@dataclass
class RedditConfig:
    """Reddit API configuration."""
    client_id: str
    client_secret: str
    user_agent: str
    
    @property
    def is_valid(self) -> bool:
        """Check if config has real credentials (not placeholders)."""
        return (
            self.client_id and 
            not self.client_id.startswith("your_") and
            self.client_secret and
            not self.client_secret.startswith("your_")
        )


@dataclass
class GeminiConfig:
    """Google Gemini API configuration."""
    api_key: str
    
    @property
    def is_valid(self) -> bool:
        """Check if config has real credentials."""
        return self.api_key and not self.api_key.startswith("your_")


@dataclass
class KalshiConfig:
    """Kalshi API configuration with RSA key support."""
    api_key: str
    private_key_path: Optional[Path]
    
    @property
    def is_valid(self) -> bool:
        """Check if config has real credentials and key file exists."""
        has_key = self.api_key and not self.api_key.startswith("your_")
        has_pem = self.private_key_path and self.private_key_path.exists()
        return has_key and has_pem


@dataclass
class Config:
    """Main application configuration."""
    reddit: RedditConfig
    gemini: GeminiConfig
    kalshi: KalshiConfig
    subreddits: List[str]
    max_market_age_seconds: int
    
    def log_status(self) -> None:
        """Log the configuration status for debugging."""
        logger.info("=== Reddit Alpha Engine Configuration ===")
        logger.info(f"Reddit API: {'✓ Configured' if self.reddit.is_valid else '✗ PLACEHOLDER - Add keys to .env'}")
        logger.info(f"Gemini API: {'✓ Configured' if self.gemini.is_valid else '✗ PLACEHOLDER - Add keys to .env'}")
        logger.info(f"Kalshi API: {'✓ Configured' if self.kalshi.is_valid else '✗ Not configured (optional)'}")
        logger.info(f"Target subreddits: {self.subreddits}")


def load_config(env_path: Optional[Path] = None) -> Config:
    """Load configuration from environment variables.
    
    Args:
        env_path: Optional path to .env file. Defaults to looking in current directory.
        
    Returns:
        Validated Config object.
    """
    # Load .env file if it exists
    if env_path:
        load_dotenv(env_path)
    else:
        load_dotenv()
    
    # Reddit config
    reddit = RedditConfig(
        client_id=os.getenv("REDDIT_CLIENT_ID", "your_reddit_client_id_here"),
        client_secret=os.getenv("REDDIT_CLIENT_SECRET", "your_reddit_client_secret_here"),
        user_agent=os.getenv("REDDIT_USER_AGENT", "RedditAlphaEngine/1.0"),
    )
    
    # Gemini config
    gemini = GeminiConfig(
        api_key=os.getenv("GEMINI_API_KEY", "your_gemini_api_key_here"),
    )
    
    # Kalshi config (optional)
    kalshi_key_path = os.getenv("KALSHI_PRIVATE_KEY_PATH")
    kalshi = KalshiConfig(
        api_key=os.getenv("KALSHI_API_KEY", "your_kalshi_api_key_here"),
        private_key_path=Path(kalshi_key_path) if kalshi_key_path else None,
    )
    
    # Parse subreddits from env or use defaults
    subreddits_env = os.getenv("SUBREDDITS")
    if subreddits_env:
        subreddits = [s.strip() for s in subreddits_env.split(",")]
    else:
        subreddits = DEFAULT_SUBREDDITS
    
    return Config(
        reddit=reddit,
        gemini=gemini,
        kalshi=kalshi,
        subreddits=subreddits,
        max_market_age_seconds=MAX_MARKET_DATA_AGE_SECONDS,
    )
