"""Reddit client for fetching posts and comments using PRAW.

API KEY REQUIRED:
- REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET from https://www.reddit.com/prefs/apps
- Create a "script" type application to get these credentials
"""

import logging
import time
from typing import List, Optional

import praw
from praw.models import Submission

from .config import RedditConfig
from .models import RedditPost

logger = logging.getLogger(__name__)


class RedditClientError(Exception):
    """Raised when Reddit API operations fail."""
    pass


class RedditClient:
    """Client for fetching Reddit posts and comments.
    
    Handles rate limiting automatically with sleep/retry mechanism.
    
    API KEYS REQUIRED:
        Set these in your .env file:
        - REDDIT_CLIENT_ID
        - REDDIT_CLIENT_SECRET
        - REDDIT_USER_AGENT
    """
    
    # Minimum remaining requests before proactive sleep
    RATE_LIMIT_THRESHOLD = 5
    
    def __init__(self, config: RedditConfig):
        """Initialize Reddit client.
        
        Args:
            config: Reddit API configuration with credentials.
        """
        self.config = config
        self._reddit: Optional[praw.Reddit] = None
        
        if not config.is_valid:
            logger.warning(
                "Reddit credentials are placeholders. "
                "Add real credentials to .env to enable Reddit fetching. "
                "Get keys at: https://www.reddit.com/prefs/apps"
            )
    
    @property
    def reddit(self) -> praw.Reddit:
        """Lazy initialization of PRAW Reddit instance."""
        if self._reddit is None:
            if not self.config.is_valid:
                raise RedditClientError(
                    "Cannot connect to Reddit API with placeholder credentials. "
                    "Please add valid REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to .env"
                )
            
            self._reddit = praw.Reddit(
                client_id=self.config.client_id,
                client_secret=self.config.client_secret,
                user_agent=self.config.user_agent,
            )
            logger.info("Reddit client initialized successfully")
        
        return self._reddit
    
    def _handle_rate_limit(self) -> None:
        """Check rate limits and sleep if necessary."""
        try:
            limits = self.reddit.auth.limits
            remaining = limits.get("remaining", 100)
            reset_timestamp = limits.get("reset_timestamp")
            
            if remaining < self.RATE_LIMIT_THRESHOLD and reset_timestamp:
                sleep_time = reset_timestamp - time.time()
                if sleep_time > 0:
                    logger.warning(
                        f"Rate limit approaching ({remaining} remaining). "
                        f"Sleeping for {sleep_time:.1f}s"
                    )
                    time.sleep(sleep_time + 1)  # Add 1s buffer
        except Exception as e:
            logger.debug(f"Could not check rate limits: {e}")
    
    def _submission_to_post(
        self, 
        submission: Submission, 
        max_comments: int = 5
    ) -> RedditPost:
        """Convert a PRAW Submission to our RedditPost model.
        
        Args:
            submission: PRAW Submission object.
            max_comments: Maximum number of top-level comments to extract.
            
        Returns:
            RedditPost with extracted data.
        """
        # Extract top-level comments
        comments: List[str] = []
        try:
            submission.comments.replace_more(limit=0)  # Remove "load more" stubs
            for comment in submission.comments[:max_comments]:
                if hasattr(comment, "body") and comment.body:
                    # Truncate very long comments
                    comment_text = comment.body[:500]
                    comments.append(comment_text)
        except Exception as e:
            logger.debug(f"Could not fetch comments for {submission.id}: {e}")
        
        return RedditPost(
            id=submission.id,
            title=submission.title,
            subreddit=str(submission.subreddit),
            score=submission.score,
            upvote_ratio=submission.upvote_ratio,
            created_utc=submission.created_utc,
            url=submission.url,
            selftext=submission.selftext[:1000] if submission.selftext else None,
            comments=comments,
        )
    
    def fetch_hot_posts(
        self, 
        subreddit: str, 
        limit: int = 10,
        include_comments: bool = True,
    ) -> List[RedditPost]:
        """Fetch hot posts from a subreddit.
        
        Args:
            subreddit: Name of the subreddit (without r/).
            limit: Maximum number of posts to fetch.
            include_comments: Whether to fetch top comments for each post.
            
        Returns:
            List of RedditPost objects.
        """
        self._handle_rate_limit()
        
        logger.info(f"Fetching {limit} hot posts from r/{subreddit}")
        posts: List[RedditPost] = []
        
        try:
            for submission in self.reddit.subreddit(subreddit).hot(limit=limit):
                max_comments = 5 if include_comments else 0
                post = self._submission_to_post(submission, max_comments)
                posts.append(post)
                
            logger.info(f"Fetched {len(posts)} posts from r/{subreddit}")
            
        except Exception as e:
            logger.error(f"Error fetching from r/{subreddit}: {e}")
            raise RedditClientError(f"Failed to fetch from r/{subreddit}: {e}")
        
        return posts
    
    def fetch_rising_posts(
        self, 
        subreddit: str, 
        limit: int = 10,
        include_comments: bool = True,
    ) -> List[RedditPost]:
        """Fetch rising posts from a subreddit.
        
        Rising posts are those gaining momentum - useful for trend detection.
        
        Args:
            subreddit: Name of the subreddit (without r/).
            limit: Maximum number of posts to fetch.
            include_comments: Whether to fetch top comments for each post.
            
        Returns:
            List of RedditPost objects.
        """
        self._handle_rate_limit()
        
        logger.info(f"Fetching {limit} rising posts from r/{subreddit}")
        posts: List[RedditPost] = []
        
        try:
            for submission in self.reddit.subreddit(subreddit).rising(limit=limit):
                max_comments = 5 if include_comments else 0
                post = self._submission_to_post(submission, max_comments)
                posts.append(post)
                
            logger.info(f"Fetched {len(posts)} rising posts from r/{subreddit}")
            
        except Exception as e:
            logger.error(f"Error fetching rising from r/{subreddit}: {e}")
            raise RedditClientError(f"Failed to fetch rising from r/{subreddit}: {e}")
        
        return posts
    
    def fetch_posts(
        self,
        subreddit: str,
        limit: int = 10,
        include_rising: bool = True,
    ) -> List[RedditPost]:
        """Fetch both hot and rising posts from a subreddit.
        
        Args:
            subreddit: Name of the subreddit.
            limit: Number of posts per category (hot and rising).
            include_rising: Whether to also fetch rising posts.
            
        Returns:
            Combined list of unique posts (deduplicated by ID).
        """
        posts_by_id: dict[str, RedditPost] = {}
        
        # Fetch hot posts
        hot_posts = self.fetch_hot_posts(subreddit, limit=limit)
        for post in hot_posts:
            posts_by_id[post.id] = post
        
        # Fetch rising posts
        if include_rising:
            rising_posts = self.fetch_rising_posts(subreddit, limit=limit)
            for post in rising_posts:
                if post.id not in posts_by_id:
                    posts_by_id[post.id] = post
        
        logger.info(f"Total unique posts from r/{subreddit}: {len(posts_by_id)}")
        return list(posts_by_id.values())


# Placeholder function for testing without credentials
def create_mock_posts(subreddit: str, count: int = 5) -> List[RedditPost]:
    """Create mock posts for testing without Reddit credentials.
    
    Use this to test the pipeline when you don't have API keys configured.
    """
    from datetime import datetime, timezone
    
    mock_titles = [
        "Bitcoin is mooning! New ATH incoming?",
        "Everyone's bullish on the election outcome",
        "Market sentiment seems mixed today",
        "Bearish signals in crypto markets",
        "Big news expected this week",
    ]
    
    return [
        RedditPost(
            id=f"mock_{i}",
            title=mock_titles[i % len(mock_titles)],
            subreddit=subreddit,
            score=100 * (i + 1),
            upvote_ratio=0.85,
            created_utc=datetime.now(timezone.utc),
            url=f"https://reddit.com/r/{subreddit}/mock_{i}",
            comments=[f"Mock comment {j}" for j in range(3)],
        )
        for i in range(count)
    ]
