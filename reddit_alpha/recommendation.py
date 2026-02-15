"""Recommendation engine for comparing sentiment vs market prices.

Generates actionable trading recommendations based on alpha (sentiment - market price).
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from .models import (
    Action,
    AnalysisResult,
    MarketData,
    Recommendation,
    SentimentResult,
)

logger = logging.getLogger(__name__)


class RecommendationEngine:
    """Generates trading recommendations from sentiment and market data.
    
    Compares Reddit sentiment against prediction market prices to identify
    potential alpha opportunities where social consensus differs from market pricing.
    """
    
    # Alpha thresholds for action determination
    STRONG_BUY_THRESHOLD = 0.30
    BUY_THRESHOLD = 0.10
    SELL_THRESHOLD = -0.10
    STRONG_SELL_THRESHOLD = -0.30
    
    # Minimum certainty for non-HOLD recommendations
    MIN_CERTAINTY = 0.3
    
    def __init__(self, max_market_age_seconds: int = 900):
        """Initialize recommendation engine.
        
        Args:
            max_market_age_seconds: Maximum age of market data (default 15 min).
        """
        self.max_market_age = max_market_age_seconds
    
    def calculate_alpha(
        self, 
        sentiment_score: float, 
        market_price: float
    ) -> float:
        """Calculate alpha: difference between sentiment and market implied probability.
        
        Alpha > 0 means sentiment is more bullish than the market price implies.
        Alpha < 0 means sentiment is more bearish than the market price implies.
        
        Args:
            sentiment_score: Sentiment from -1 to +1
            market_price: Market price from 0 to 1 (probability)
            
        Returns:
            Alpha score from -2 to +2 (typically -1 to +1)
        """
        # Convert market price to comparable scale (-1 to +1)
        # Price of 0.5 = neutral, 0 = bearish, 1 = bullish
        market_sentiment = (2 * market_price) - 1
        
        # Alpha is the difference
        return sentiment_score - market_sentiment
    
    def determine_action(
        self,
        alpha: float,
        sentiment: SentimentResult,
    ) -> Action:
        """Determine trading action based on alpha and certainty.
        
        Args:
            alpha: Alpha score
            sentiment: Full sentiment result with certainty
            
        Returns:
            Recommended Action
        """
        # Handle neutral sentiment specially
        if abs(sentiment.sentiment_score) < 0.05:
            return Action.HOLD
        
        # Require minimum certainty for directional calls
        if sentiment.certainty < self.MIN_CERTAINTY:
            return Action.HOLD
        
        # Determine action based on alpha
        if alpha > self.STRONG_BUY_THRESHOLD:
            return Action.STRONG_BUY
        elif alpha > self.BUY_THRESHOLD:
            return Action.BUY
        elif alpha < self.STRONG_SELL_THRESHOLD:
            return Action.STRONG_SELL
        elif alpha < self.SELL_THRESHOLD:
            return Action.SELL
        else:
            return Action.HOLD
    
    def filter_markets(
        self,
        markets: List[MarketData],
        keywords: Optional[List[str]] = None,
    ) -> List[MarketData]:
        """Filter markets by freshness and optional keywords.
        
        Args:
            markets: List of markets to filter
            keywords: Optional keywords to match in questions
            
        Returns:
            Filtered list of valid markets
        """
        filtered = []
        
        for market in markets:
            # Skip closed/resolved markets
            if market.closed:
                logger.debug(f"Skipping closed market: {market.id}")
                continue
            
            # Skip stale data
            if market.is_stale(self.max_market_age):
                logger.debug(f"Skipping stale market: {market.id}")
                continue
            
            # If keywords provided, filter by them
            if keywords:
                question_lower = market.question.lower()
                if not any(kw.lower() in question_lower for kw in keywords):
                    continue
            
            filtered.append(market)
        
        logger.info(f"Filtered to {len(filtered)} valid markets from {len(markets)}")
        return filtered
    
    def generate_recommendation(
        self,
        market: MarketData,
        sentiment: SentimentResult,
    ) -> Recommendation:
        """Generate a recommendation for a single market.
        
        Args:
            market: Market data
            sentiment: Sentiment analysis result
            
        Returns:
            Recommendation with action and reasoning
        """
        alpha = self.calculate_alpha(sentiment.sentiment_score, market.price)
        action = self.determine_action(alpha, sentiment)
        
        # Build reasoning
        direction = "bullish" if sentiment.sentiment_score > 0 else "bearish"
        if abs(sentiment.sentiment_score) < 0.1:
            direction = "neutral"
        
        reasoning = (
            f"Sentiment is {direction} ({sentiment.sentiment_score:+.2f}) while "
            f"market implies {market.price:.0%} probability. "
            f"Alpha: {alpha:+.2f}"
        )
        
        return Recommendation(
            market=market,
            sentiment=sentiment,
            action=action,
            alpha_score=alpha,
            reasoning=reasoning,
        )
    
    def generate_recommendations(
        self,
        markets: List[MarketData],
        sentiment: SentimentResult,
    ) -> List[Recommendation]:
        """Generate recommendations for multiple markets.
        
        Args:
            markets: List of markets to evaluate
            sentiment: Sentiment to compare against
            
        Returns:
            List of recommendations, sorted by absolute alpha (highest first)
        """
        recommendations = []
        
        for market in markets:
            try:
                rec = self.generate_recommendation(market, sentiment)
                recommendations.append(rec)
            except Exception as e:
                logger.error(f"Error generating recommendation for {market.id}: {e}")
        
        # Sort by absolute alpha (strongest signals first)
        recommendations.sort(key=lambda r: abs(r.alpha_score), reverse=True)
        
        return recommendations
    
    def create_analysis_result(
        self,
        subreddit: str,
        posts_analyzed: int,
        sentiment: SentimentResult,
        markets: List[MarketData],
        keywords: Optional[List[str]] = None,
    ) -> AnalysisResult:
        """Create a complete analysis result.
        
        Args:
            subreddit: Source subreddit
            posts_analyzed: Number of posts analyzed
            sentiment: Sentiment analysis result
            markets: Available markets
            keywords: Optional keywords for market filtering
            
        Returns:
            Complete AnalysisResult with recommendations
        """
        # Filter markets
        valid_markets = self.filter_markets(markets, keywords)
        
        # Generate recommendations
        recommendations = self.generate_recommendations(valid_markets, sentiment)
        
        return AnalysisResult(
            topic=subreddit,  # Could be enhanced with topic extraction
            subreddit=subreddit,
            posts_analyzed=posts_analyzed,
            sentiment=sentiment,
            matched_markets=valid_markets,
            recommendations=recommendations,
        )
