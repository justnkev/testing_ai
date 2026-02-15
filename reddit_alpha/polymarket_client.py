"""Polymarket client for fetching prediction market data.

Uses the public Gamma API - no authentication required.
Endpoint: https://gamma-api.polymarket.com/markets
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional

import aiohttp

from .models import MarketData, MarketSource

logger = logging.getLogger(__name__)

# Polymarket Gamma API endpoint
GAMMA_API_URL = "https://gamma-api.polymarket.com/markets"


class PolymarketClientError(Exception):
    """Raised when Polymarket API operations fail."""
    pass


class PolymarketClient:
    """Async client for Polymarket Gamma API.
    
    No API key required - this uses the public Gamma API.
    """
    
    def __init__(self, timeout: int = 30):
        """Initialize Polymarket client.
        
        Args:
            timeout: HTTP request timeout in seconds.
        """
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self._session: Optional[aiohttp.ClientSession] = None
    
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
        active_only: bool = True,
        category: Optional[str] = None,
    ) -> List[MarketData]:
        """Fetch markets from Polymarket.
        
        Args:
            limit: Maximum number of markets to fetch.
            active_only: If True, only return non-closed markets.
            category: Optional category filter (e.g., "Crypto", "US-current-affairs").
            
        Returns:
            List of MarketData objects.
        """
        session = await self._get_session()
        
        params = {"_limit": str(limit)}
        if active_only:
            params["closed"] = "false"
            params["active"] = "true"
        
        logger.info(f"Fetching up to {limit} markets from Polymarket")
        
        try:
            async with session.get(GAMMA_API_URL, params=params) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise PolymarketClientError(
                        f"Polymarket API returned {response.status}: {error_text}"
                    )
                
                data = await response.json()
                
        except aiohttp.ClientError as e:
            raise PolymarketClientError(f"HTTP error fetching markets: {e}")
        
        markets: List[MarketData] = []
        
        for item in data:
            try:
                # Parse outcome prices - "Yes" price is first element
                outcome_prices = item.get("outcomePrices", '["0", "0"]')
                if isinstance(outcome_prices, str):
                    import json
                    prices = json.loads(outcome_prices)
                else:
                    prices = outcome_prices
                
                yes_price = float(prices[0]) if prices else 0.0
                
                # Parse updated timestamp
                updated_at = item.get("updatedAt", datetime.now(timezone.utc).isoformat())
                
                # Filter by category if specified
                item_category = item.get("category", "")
                if category and category.lower() not in item_category.lower():
                    continue
                
                market = MarketData(
                    id=str(item.get("id", "")),
                    question=item.get("question", "Unknown"),
                    price=yes_price,
                    source=MarketSource.POLYMARKET,
                    updated_at=updated_at,
                    closed=item.get("closed", False),
                    category=item_category,
                    volume=item.get("volumeNum", 0.0),
                )
                
                # Skip closed markets
                if active_only and market.closed:
                    continue
                    
                markets.append(market)
                
            except Exception as e:
                logger.debug(f"Skipping malformed market: {e}")
                continue
        
        logger.info(f"Fetched {len(markets)} active markets from Polymarket")
        return markets
    
    async def search_markets(
        self,
        keywords: List[str],
        limit: int = 50,
    ) -> List[MarketData]:
        """Search for markets matching keywords.
        
        Args:
            keywords: List of keywords to search for in market questions.
            limit: Maximum markets to return.
            
        Returns:
            Markets whose questions contain any of the keywords.
        """
        all_markets = await self.fetch_markets(limit=200, active_only=True)
        
        matching: List[MarketData] = []
        keywords_lower = [k.lower() for k in keywords]
        
        for market in all_markets:
            question_lower = market.question.lower()
            if any(kw in question_lower for kw in keywords_lower):
                matching.append(market)
                if len(matching) >= limit:
                    break
        
        logger.info(f"Found {len(matching)} markets matching keywords: {keywords}")
        return matching


# Mock function for testing
def create_mock_markets(count: int = 5) -> List[MarketData]:
    """Create mock markets for testing without API access.
    
    Returns:
        List of mock MarketData objects.
    """
    mock_data = [
        ("pm_1", "Will Bitcoin reach $100k in 2024?", 0.45, "Crypto"),
        ("pm_2", "Will Trump win the 2024 election?", 0.52, "US-current-affairs"),
        ("pm_3", "Will the Fed cut rates in Q1 2024?", 0.38, "Economics"),
        ("pm_4", "Will there be a government shutdown?", 0.25, "US-current-affairs"),
        ("pm_5", "Will Ethereum flip Bitcoin?", 0.12, "Crypto"),
    ]
    
    return [
        MarketData(
            id=id_,
            question=question,
            price=price,
            source=MarketSource.POLYMARKET,
            updated_at=datetime.now(timezone.utc),
            closed=False,
            category=category,
            volume=10000.0,
        )
        for id_, question, price, category in mock_data[:count]
    ]
