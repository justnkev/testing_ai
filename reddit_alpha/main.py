"""Reddit Alpha Engine - Main CLI Entry Point.

Orchestrates the full pipeline: Reddit → Sentiment → Markets → Recommendations.

Usage:
    python -m reddit_alpha.main --subreddit wallstreetbets --limit 10
    python -m reddit_alpha.main --demo  # Run with mock data (no API keys needed)
"""

import argparse
import asyncio
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from rich.console import Console
from rich.logging import RichHandler
from rich.table import Table
from rich.panel import Panel
from rich import box

from .config import load_config, Config
from .models import (
    Action,
    AnalysisResult,
    MarketData,
    Recommendation,
    SentimentResult,
)


# Initialize Rich console
console = Console()


def setup_logging(verbose: bool = False) -> None:
    """Configure logging with Rich handler."""
    level = logging.DEBUG if verbose else logging.INFO
    
    logging.basicConfig(
        level=level,
        format="%(message)s",
        datefmt="[%X]",
        handlers=[RichHandler(console=console, rich_tracebacks=True)],
    )


def print_header() -> None:
    """Print application header."""
    console.print(Panel.fit(
        "[bold blue]Reddit Alpha Engine[/bold blue]\n"
        "[dim]Sentiment-driven prediction market analysis[/dim]",
        border_style="blue",
    ))


def print_config_status(config: Config) -> None:
    """Print configuration status."""
    table = Table(title="API Configuration", box=box.SIMPLE)
    table.add_column("Service", style="cyan")
    table.add_column("Status", style="green")
    table.add_column("Notes", style="dim")
    
    # Reddit
    if config.reddit.is_valid:
        table.add_row("Reddit", "✓ Ready", "")
    else:
        table.add_row("Reddit", "[yellow]Placeholder[/yellow]", "Add keys to .env")
    
    # Gemini
    if config.gemini.is_valid:
        table.add_row("Gemini", "✓ Ready", "")
    else:
        table.add_row("Gemini", "[yellow]Placeholder[/yellow]", "Add GEMINI_API_KEY")
    
    # Kalshi
    if config.kalshi.is_valid:
        table.add_row("Kalshi", "✓ Ready", "")
    else:
        table.add_row("Kalshi", "[dim]Not configured[/dim]", "Optional")
    
    # Polymarket - no auth needed
    table.add_row("Polymarket", "✓ Ready", "No auth required")
    
    console.print(table)
    console.print()


def print_recommendations(analysis: AnalysisResult) -> None:
    """Print recommendations table."""
    # Sentiment summary
    sentiment = analysis.sentiment
    sentiment_color = "green" if sentiment.sentiment_score > 0 else "red"
    if abs(sentiment.sentiment_score) < 0.1:
        sentiment_color = "yellow"
    
    console.print(Panel(
        f"[bold]Subreddit:[/bold] r/{analysis.subreddit}\n"
        f"[bold]Posts Analyzed:[/bold] {analysis.posts_analyzed}\n"
        f"[bold]Sentiment:[/bold] [{sentiment_color}]{sentiment.sentiment_score:+.2f}[/{sentiment_color}] "
        f"(certainty: {sentiment.certainty:.0%})\n"
        f"[bold]Summary:[/bold] {sentiment.trend_summary}",
        title="Analysis Results",
        border_style="cyan",
    ))
    
    # Recommendations table
    if not analysis.recommendations:
        console.print("[dim]No matching markets found.[/dim]")
        return
    
    table = Table(
        title="Recommended Bets",
        box=box.ROUNDED,
        show_header=True,
        header_style="bold magenta",
    )
    table.add_column("Market", style="white", max_width=40)
    table.add_column("Price", justify="center", style="cyan")
    table.add_column("Sentiment", justify="center")
    table.add_column("Alpha", justify="center")
    table.add_column("Action", justify="center")
    
    for rec in analysis.recommendations[:10]:  # Top 10
        # Color action based on type
        action_style = {
            Action.STRONG_BUY: "[bold green]",
            Action.BUY: "[green]",
            Action.HOLD: "[yellow]",
            Action.SELL: "[red]",
            Action.STRONG_SELL: "[bold red]",
        }.get(rec.action, "")
        
        # Color sentiment
        sent_color = "green" if rec.sentiment.sentiment_score > 0 else "red"
        if abs(rec.sentiment.sentiment_score) < 0.1:
            sent_color = "yellow"
        
        # Color alpha
        alpha_color = "green" if rec.alpha_score > 0 else "red"
        
        table.add_row(
            rec.market.question[:38] + "..." if len(rec.market.question) > 40 else rec.market.question,
            f"${rec.market.price:.2f}",
            f"[{sent_color}]{rec.sentiment.sentiment_score:+.2f}[/{sent_color}]",
            f"[{alpha_color}]{rec.alpha_score:+.2f}[/{alpha_color}]",
            f"{action_style}{rec.action.value}[/]",
        )
    
    console.print(table)


async def run_demo_mode() -> AnalysisResult:
    """Run with mock data - no API keys required."""
    from .reddit_client import create_mock_posts
    from .sentiment_analyzer import create_mock_sentiment
    from .polymarket_client import create_mock_markets
    from .recommendation import RecommendationEngine
    
    console.print("[yellow]Running in DEMO mode with mock data[/yellow]\n")
    
    # Mock data
    posts = create_mock_posts("wallstreetbets", count=5)
    sentiment = create_mock_sentiment(positive=True)
    markets = create_mock_markets(count=5)
    
    # Generate recommendations
    engine = RecommendationEngine()
    analysis = engine.create_analysis_result(
        subreddit="wallstreetbets (demo)",
        posts_analyzed=len(posts),
        sentiment=sentiment,
        markets=markets,
    )
    
    return analysis


async def run_full_analysis(
    config: Config,
    subreddit: str,
    limit: int = 10,
) -> Optional[AnalysisResult]:
    """Run full analysis pipeline.
    
    Requires valid API keys in .env file.
    """
    from .reddit_client import RedditClient
    from .sentiment_analyzer import SentimentAnalyzer
    from .polymarket_client import PolymarketClient
    from .kalshi_client import KalshiClient
    from .recommendation import RecommendationEngine
    
    logger = logging.getLogger(__name__)
    
    # Check for required credentials
    if not config.reddit.is_valid:
        console.print("[red]Error: Reddit credentials not configured.[/red]")
        console.print("Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to .env")
        console.print("Get credentials at: https://www.reddit.com/prefs/apps")
        return None
    
    if not config.gemini.is_valid:
        console.print("[red]Error: Gemini API key not configured.[/red]")
        console.print("Add GEMINI_API_KEY to .env")
        console.print("Get a key at: https://aistudio.google.com/app/apikey")
        return None
    
    # Initialize clients
    reddit = RedditClient(config.reddit)
    analyzer = SentimentAnalyzer(config.gemini)
    polymarket = PolymarketClient()
    kalshi = KalshiClient(config.kalshi)
    engine = RecommendationEngine(config.max_market_age_seconds)
    
    try:
        # Fetch Reddit posts
        with console.status(f"[bold blue]Fetching posts from r/{subreddit}..."):
            posts = reddit.fetch_posts(subreddit, limit=limit)
        
        if not posts:
            console.print(f"[yellow]No posts found in r/{subreddit}[/yellow]")
            return None
        
        console.print(f"[green]Fetched {len(posts)} posts from r/{subreddit}[/green]")
        
        # Analyze sentiment
        with console.status("[bold blue]Analyzing sentiment with Gemini..."):
            sentiment = analyzer.analyze(posts)
        
        console.print(f"[green]Sentiment: {sentiment.sentiment_score:+.2f}[/green]")
        
        # Fetch market data (async)
        with console.status("[bold blue]Fetching market data..."):
            markets: List[MarketData] = []
            
            # Polymarket (always works, no auth)
            poly_markets = await polymarket.fetch_markets(limit=100)
            markets.extend(poly_markets)
            
            # Kalshi (optional)
            if config.kalshi.is_valid:
                try:
                    kalshi_markets = await kalshi.fetch_markets(limit=50)
                    markets.extend(kalshi_markets)
                except Exception as e:
                    logger.warning(f"Kalshi fetch failed: {e}")
        
        console.print(f"[green]Fetched {len(markets)} markets[/green]")
        
        # Generate recommendations
        with console.status("[bold blue]Generating recommendations..."):
            analysis = engine.create_analysis_result(
                subreddit=subreddit,
                posts_analyzed=len(posts),
                sentiment=sentiment,
                markets=markets,
            )
        
        return analysis
        
    finally:
        # Cleanup
        await polymarket.close()
        await kalshi.close()


async def main_async(args: argparse.Namespace) -> int:
    """Async main entry point."""
    setup_logging(args.verbose)
    print_header()
    
    # Load config
    config = load_config()
    print_config_status(config)
    
    if args.demo:
        # Demo mode - no API keys needed
        analysis = await run_demo_mode()
    else:
        # Full analysis
        analysis = await run_full_analysis(
            config=config,
            subreddit=args.subreddit,
            limit=args.limit,
        )
    
    if analysis:
        print_recommendations(analysis)
        return 0
    
    return 1


def main() -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Reddit Alpha Engine - Sentiment-driven prediction market analysis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m reddit_alpha.main --demo              # Run with mock data
  python -m reddit_alpha.main -s wallstreetbets   # Analyze r/wallstreetbets
  python -m reddit_alpha.main -s politics -l 20   # Analyze 20 posts from r/politics

API Keys Required (add to .env):
  - REDDIT_CLIENT_ID & REDDIT_CLIENT_SECRET (https://reddit.com/prefs/apps)
  - GEMINI_API_KEY (https://aistudio.google.com/app/apikey)
  - KALSHI_API_KEY & KALSHI_PRIVATE_KEY_PATH (optional, for Kalshi markets)
        """,
    )
    
    parser.add_argument(
        "-s", "--subreddit",
        default="wallstreetbets",
        help="Subreddit to analyze (default: wallstreetbets)",
    )
    parser.add_argument(
        "-l", "--limit",
        type=int,
        default=10,
        help="Number of posts to fetch (default: 10)",
    )
    parser.add_argument(
        "--demo",
        action="store_true",
        help="Run in demo mode with mock data (no API keys required)",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )
    
    args = parser.parse_args()
    
    return asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main())
