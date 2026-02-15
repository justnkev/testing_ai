"""Sentiment analysis using Google Gemini.

Analyzes Reddit posts to determine directional sentiment with structured JSON output.

API KEY REQUIRED:
- GEMINI_API_KEY from https://aistudio.google.com/app/apikey
"""

import json
import logging
from typing import List, Optional

from .config import GeminiConfig
from .models import RedditPost, SentimentResult

logger = logging.getLogger(__name__)

# System prompt for the Financial Sentiment Analyst persona
FINANCIAL_ANALYST_PROMPT = """You are a Financial Sentiment Analyst specializing in prediction markets and social media sentiment analysis.

Your task is to analyze Reddit posts and comments to determine the directional sentiment regarding potential market-moving topics.

Guidelines:
1. Focus on extracting ACTIONABLE sentiment that could predict market movements
2. Consider both the post content and community reaction (upvotes, comment sentiment)
3. Be skeptical of hype - look for substantive reasoning vs pure speculation
4. Identify if the sentiment is about a specific event, asset, or broader market trend

Output:
- sentiment_score: -1 (extremely bearish/negative) to +1 (extremely bullish/positive), 0 is neutral
- certainty: 0 (very uncertain/mixed signals) to 1 (very confident in assessment)
- trend_summary: One clear sentence describing the sentiment trend"""


class SentimentAnalyzerError(Exception):
    """Raised when sentiment analysis fails."""
    pass


class SentimentAnalyzer:
    """Gemini-powered sentiment analyzer with structured JSON output.
    
    API KEY REQUIRED:
        Set GEMINI_API_KEY in your .env file.
        Get a key at: https://aistudio.google.com/app/apikey
    """
    
    MODEL_NAME = "gemini-2.5-flash"
    
    def __init__(self, config: GeminiConfig):
        """Initialize the sentiment analyzer.
        
        Args:
            config: Gemini API configuration with API key.
        """
        self.config = config
        self._client = None
        
        if not config.is_valid:
            logger.warning(
                "Gemini API key is a placeholder. "
                "Add real GEMINI_API_KEY to .env to enable sentiment analysis. "
                "Get a key at: https://aistudio.google.com/app/apikey"
            )
    
    @property
    def client(self):
        """Lazy initialization of Gemini client."""
        if self._client is None:
            if not self.config.is_valid:
                raise SentimentAnalyzerError(
                    "Cannot use Gemini API with placeholder credentials. "
                    "Please add valid GEMINI_API_KEY to .env"
                )
            
            try:
                from google import genai
                self._client = genai.Client(api_key=self.config.api_key)
                logger.info("Gemini client initialized successfully")
            except ImportError:
                raise SentimentAnalyzerError(
                    "google-generativeai package not installed. "
                    "Run: pip install google-generativeai"
                )
        
        return self._client
    
    def _prepare_text(self, posts: List[RedditPost]) -> str:
        """Combine posts and comments into analysis text.
        
        Args:
            posts: List of Reddit posts to analyze.
            
        Returns:
            Combined text for sentiment analysis.
        """
        text_parts = []
        
        for post in posts:
            text_parts.append(f"## Post: {post.title}")
            text_parts.append(f"Score: {post.score} | Upvote Ratio: {post.upvote_ratio:.0%}")
            
            if post.selftext:
                text_parts.append(f"Content: {post.selftext[:500]}")
            
            if post.comments:
                text_parts.append("Top Comments:")
                for i, comment in enumerate(post.comments[:3], 1):
                    text_parts.append(f"  {i}. {comment[:200]}")
            
            text_parts.append("")  # Add spacing
        
        return "\n".join(text_parts)
    
    def analyze(self, posts: List[RedditPost]) -> SentimentResult:
        """Analyze sentiment of Reddit posts using Gemini.
        
        Args:
            posts: List of Reddit posts to analyze.
            
        Returns:
            SentimentResult with score, certainty, and summary.
            
        Raises:
            SentimentAnalyzerError: If analysis fails.
        """
        if not posts:
            logger.warning("No posts to analyze, returning neutral sentiment")
            return SentimentResult(
                sentiment_score=0.0,
                certainty=0.0,
                trend_summary="No posts available for analysis."
            )
        
        from google.genai import types
        
        # Prepare the input text
        combined_text = self._prepare_text(posts)
        subreddit = posts[0].subreddit if posts else "unknown"
        
        prompt = f"""Analyze the following Reddit posts from r/{subreddit} for market sentiment:

{combined_text}

Provide your analysis in the required JSON format."""
        
        logger.info(f"Analyzing sentiment for {len(posts)} posts from r/{subreddit}")
        
        try:
            response = self.client.models.generate_content(
                model=self.MODEL_NAME,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema={
                        "type": "OBJECT",
                        "properties": {
                            "sentiment_score": {
                                "type": "NUMBER",
                                "description": "Sentiment from -1 (bearish) to +1 (bullish)"
                            },
                            "certainty": {
                                "type": "NUMBER", 
                                "description": "Confidence from 0 to 1"
                            },
                            "trend_summary": {
                                "type": "STRING",
                                "description": "One sentence summary"
                            }
                        },
                        "required": ["sentiment_score", "certainty", "trend_summary"]
                    },
                    system_instruction=FINANCIAL_ANALYST_PROMPT,
                ),
            )
            
            # Parse the structured response
            result_data = json.loads(response.text)
            
            # Clamp values to valid ranges
            sentiment_score = max(-1.0, min(1.0, float(result_data["sentiment_score"])))
            certainty = max(0.0, min(1.0, float(result_data["certainty"])))
            
            result = SentimentResult(
                sentiment_score=sentiment_score,
                certainty=certainty,
                trend_summary=result_data["trend_summary"][:200]  # Ensure max length
            )
            
            logger.info(
                f"Sentiment analysis complete: score={result.sentiment_score:.2f}, "
                f"certainty={result.certainty:.2f}"
            )
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini response as JSON: {e}")
            raise SentimentAnalyzerError(f"Invalid JSON response from Gemini: {e}")
        except Exception as e:
            logger.error(f"Sentiment analysis failed: {e}")
            raise SentimentAnalyzerError(f"Gemini API error: {e}")
    
    def analyze_text(self, text: str) -> SentimentResult:
        """Analyze sentiment of raw text (for testing).
        
        Args:
            text: Raw text to analyze.
            
        Returns:
            SentimentResult with score, certainty, and summary.
        """
        # Create a mock post from raw text
        from datetime import datetime, timezone
        
        mock_post = RedditPost(
            id="manual_input",
            title=text[:100],
            subreddit="manual",
            score=1,
            upvote_ratio=1.0,
            created_utc=datetime.now(timezone.utc),
            url="",
            selftext=text,
            comments=[],
        )
        
        return self.analyze([mock_post])


# Mock function for testing without API credentials
def create_mock_sentiment(positive: bool = True) -> SentimentResult:
    """Create mock sentiment for testing without Gemini API.
    
    Args:
        positive: If True, return bullish sentiment; else bearish.
        
    Returns:
        Mock SentimentResult for testing.
    """
    if positive:
        return SentimentResult(
            sentiment_score=0.75,
            certainty=0.8,
            trend_summary="Strong bullish sentiment detected with high conviction."
        )
    else:
        return SentimentResult(
            sentiment_score=-0.6,
            certainty=0.65,
            trend_summary="Bearish outlook with moderate uncertainty."
        )
