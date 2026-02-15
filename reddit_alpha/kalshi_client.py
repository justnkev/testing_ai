"""Kalshi client for fetching prediction market data.

Implements RSA-PSS signing for API authentication.

API KEYS REQUIRED:
- KALSHI_API_KEY: From your Kalshi account settings
- KALSHI_PRIVATE_KEY_PATH: Path to your RSA private key (PEM format)

The private key is generated when you create an API key in Kalshi.
You must save it immediately as it cannot be retrieved again.
"""

import asyncio
import base64
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import aiohttp

from .config import KalshiConfig
from .models import MarketData, MarketSource

logger = logging.getLogger(__name__)

# Kalshi API endpoints
KALSHI_API_BASE = "https://trading-api.kalshi.com/trade-api/v2"


class KalshiClientError(Exception):
    """Raised when Kalshi API operations fail."""
    pass


class KalshiClient:
    """Async client for Kalshi API with RSA-PSS signing.
    
    API KEYS REQUIRED:
        Set these in your .env file:
        - KALSHI_API_KEY
        - KALSHI_PRIVATE_KEY_PATH
        
    The private key must be in PEM format and was provided when
    you generated the API key in your Kalshi account settings.
    """
    
    def __init__(self, config: KalshiConfig, timeout: int = 30):
        """Initialize Kalshi client.
        
        Args:
            config: Kalshi API configuration with credentials.
            timeout: HTTP request timeout in seconds.
        """
        self.config = config
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self._session: Optional[aiohttp.ClientSession] = None
        self._private_key = None
        
        if not config.is_valid:
            logger.warning(
                "Kalshi credentials not configured. "
                "Add KALSHI_API_KEY and KALSHI_PRIVATE_KEY_PATH to .env. "
                "Generate keys in your Kalshi account settings."
            )
    
    def _load_private_key(self):
        """Load RSA private key from PEM file."""
        if self._private_key is not None:
            return self._private_key
        
        if not self.config.private_key_path:
            raise KalshiClientError(
                "KALSHI_PRIVATE_KEY_PATH not set. "
                "Please add the path to your RSA private key PEM file in .env"
            )
        
        if not self.config.private_key_path.exists():
            raise KalshiClientError(
                f"Private key file not found: {self.config.private_key_path}"
            )
        
        try:
            from cryptography.hazmat.primitives import serialization
            
            key_data = self.config.private_key_path.read_bytes()
            self._private_key = serialization.load_pem_private_key(
                key_data,
                password=None,
            )
            logger.info("Loaded Kalshi RSA private key")
            return self._private_key
            
        except Exception as e:
            raise KalshiClientError(f"Failed to load private key: {e}")
    
    def _sign_request(self, method: str, path: str, timestamp: int) -> str:
        """Generate RSA-PSS signature for API request.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            path: Request path (without query params)
            timestamp: Current timestamp in milliseconds
            
        Returns:
            Base64-encoded signature string.
        """
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding
        
        private_key = self._load_private_key()
        
        # Build the message to sign: timestamp + method + path
        message = f"{timestamp}{method}{path}"
        
        # Sign with RSA-PSS + SHA256
        signature = private_key.sign(
            message.encode("utf-8"),
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()),
                salt_length=padding.PSS.AUTO,
            ),
            hashes.SHA256(),
        )
        
        return base64.b64encode(signature).decode("utf-8")
    
    def _get_auth_headers(self, method: str, path: str) -> dict:
        """Generate authentication headers for Kalshi API.
        
        Args:
            method: HTTP method
            path: Request path
            
        Returns:
            Dict of auth headers.
        """
        if not self.config.is_valid:
            raise KalshiClientError(
                "Cannot authenticate without valid Kalshi credentials. "
                "Please add KALSHI_API_KEY and KALSHI_PRIVATE_KEY_PATH to .env"
            )
        
        timestamp = int(time.time() * 1000)  # Milliseconds
        signature = self._sign_request(method, path, timestamp)
        
        return {
            "KALSHI-ACCESS-KEY": self.config.api_key,
            "KALSHI-ACCESS-TIMESTAMP": str(timestamp),
            "KALSHI-ACCESS-SIGNATURE": signature,
            "Content-Type": "application/json",
        }
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=self.timeout)
        return self._session
    
    async def close(self) -> None:
        """Close the HTTP session."""
        if self._session and not self._session.closed:
            await self._session.close()
    
    async def fetch_markets(
        self,
        limit: int = 100,
        status: str = "open",
    ) -> List[MarketData]:
        """Fetch markets from Kalshi.
        
        Args:
            limit: Maximum number of markets to fetch.
            status: Market status filter ("open", "closed", "settled").
            
        Returns:
            List of MarketData objects.
        """
        if not self.config.is_valid:
            logger.warning("Kalshi not configured, returning empty list")
            return []
        
        session = await self._get_session()
        path = "/markets"
        
        headers = self._get_auth_headers("GET", path)
        params = {
            "limit": str(limit),
            "status": status,
        }
        
        logger.info(f"Fetching up to {limit} markets from Kalshi")
        
        try:
            url = f"{KALSHI_API_BASE}{path}"
            async with session.get(url, headers=headers, params=params) as response:
                if response.status == 401:
                    raise KalshiClientError(
                        "Authentication failed. Check your KALSHI_API_KEY and private key."
                    )
                if response.status != 200:
                    error_text = await response.text()
                    raise KalshiClientError(
                        f"Kalshi API returned {response.status}: {error_text}"
                    )
                
                data = await response.json()
                
        except aiohttp.ClientError as e:
            raise KalshiClientError(f"HTTP error fetching markets: {e}")
        
        markets: List[MarketData] = []
        
        for item in data.get("markets", []):
            try:
                # Kalshi uses yes_ask price
                yes_price = item.get("yes_ask", 0) / 100.0  # Convert cents to decimal
                
                market = MarketData(
                    id=str(item.get("ticker", "")),
                    question=item.get("title", "Unknown"),
                    price=yes_price,
                    source=MarketSource.KALSHI,
                    updated_at=datetime.now(timezone.utc),  # Kalshi doesn't provide update time
                    closed=item.get("status") != "open",
                    category=item.get("category", ""),
                    volume=item.get("volume", 0),
                )
                
                markets.append(market)
                
            except Exception as e:
                logger.debug(f"Skipping malformed Kalshi market: {e}")
                continue
        
        logger.info(f"Fetched {len(markets)} markets from Kalshi")
        return markets


# Mock function for testing
def create_mock_kalshi_markets(count: int = 3) -> List[MarketData]:
    """Create mock Kalshi markets for testing without API access.
    
    Returns:
        List of mock MarketData objects.
    """
    mock_data = [
        ("BTCHIGH-24", "Will Bitcoin reach $100k by end of 2024?", 0.42),
        ("FEDRATE-24Q1", "Will the Fed cut rates in Q1 2024?", 0.35),
        ("SHUTDOWN-24", "Will there be a government shutdown?", 0.28),
    ]
    
    return [
        MarketData(
            id=ticker,
            question=question,
            price=price,
            source=MarketSource.KALSHI,
            updated_at=datetime.now(timezone.utc),
            closed=False,
            category="",
            volume=5000.0,
        )
        for ticker, question, price in mock_data[:count]
    ]
