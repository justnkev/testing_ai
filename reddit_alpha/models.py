"""Pydantic models for Reddit Alpha Engine.

Provides strict typing for all data flowing through the application.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


class Action(str, Enum):
    """Trading action recommendations."""
    STRONG_BUY = "STRONG BUY"
    BUY = "BUY"
    HOLD = "HOLD/OBSERVE"
    SELL = "SELL"
    STRONG_SELL = "STRONG SELL"


class SentimentResult(BaseModel):
    """Structured output from Gemini sentiment analysis.
    
    This schema is enforced via Gemini's response_schema feature.
    """
    sentiment_score: float = Field(
        ..., 
        ge=-1.0, 
        le=1.0,
        description="Directional sentiment from -1 (very bearish) to +1 (very bullish)"
    )
    certainty: float = Field(
        ..., 
        ge=0.0, 
        le=1.0,
        description="Confidence in the sentiment assessment from 0 (uncertain) to 1 (certain)"
    )
    trend_summary: str = Field(
        ...,
        max_length=200,
        description="One sentence summary of the sentiment trend"
    )


class RedditPost(BaseModel):
    """A Reddit post with metadata and comments."""
    id: str
    title: str
    subreddit: str
    score: int
    upvote_ratio: float
    created_utc: datetime
    url: str
    selftext: Optional[str] = None
    comments: List[str] = Field(default_factory=list)
    
    @field_validator("created_utc", mode="before")
    @classmethod
    def ensure_utc(cls, v):
        """Ensure timestamp is UTC-aware."""
        if isinstance(v, (int, float)):
            return datetime.fromtimestamp(v, tz=timezone.utc)
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class MarketSource(str, Enum):
    """Prediction market data sources."""
    POLYMARKET = "polymarket"
    KALSHI = "kalshi"


class MarketData(BaseModel):
    """Market data from a prediction market."""
    id: str
    question: str
    price: float = Field(..., ge=0.0, le=1.0, description="Yes price from 0 to 1")
    source: MarketSource
    updated_at: datetime
    closed: bool = False
    category: Optional[str] = None
    volume: Optional[float] = None
    
    @field_validator("updated_at", mode="before")
    @classmethod
    def ensure_utc(cls, v):
        """Ensure timestamp is UTC-aware."""
        if isinstance(v, str):
            dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
            return dt
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v
    
    def is_stale(self, max_age_seconds: int = 900) -> bool:
        """Check if market data is older than max_age_seconds (default 15 min)."""
        age = datetime.now(timezone.utc) - self.updated_at
        return age.total_seconds() > max_age_seconds


class Recommendation(BaseModel):
    """Investment recommendation combining market and sentiment data."""
    market: MarketData
    sentiment: SentimentResult
    action: Action
    alpha_score: float = Field(
        ...,
        description="Difference between sentiment and implied market probability"
    )
    reasoning: Optional[str] = None
    
    @classmethod
    def calculate_action(cls, alpha_score: float, sentiment_score: float) -> Action:
        """Determine action based on alpha score and sentiment."""
        # Handle neutral sentiment specially
        if abs(sentiment_score) < 0.05:
            return Action.HOLD
        
        if alpha_score > 0.3:
            return Action.STRONG_BUY
        elif alpha_score > 0.1:
            return Action.BUY
        elif alpha_score < -0.3:
            return Action.STRONG_SELL
        elif alpha_score < -0.1:
            return Action.SELL
        else:
            return Action.HOLD


class AnalysisResult(BaseModel):
    """Complete analysis result for a subreddit/topic."""
    topic: str
    subreddit: str
    posts_analyzed: int
    sentiment: SentimentResult
    matched_markets: List[MarketData] = Field(default_factory=list)
    recommendations: List[Recommendation] = Field(default_factory=list)
    analyzed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
