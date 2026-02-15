"""
PR Review Agent — Automated Code Reviewer.

Fetches a PR diff from GitHub, sends it to Gemini for analysis,
and posts a structured review comment back on the PR.

Can be run:
  1. Locally:       python -m pr_agent.reviewer --repo owner/repo --pr 42
  2. GitHub Action: triggered on pull_request events (see .github/workflows/pr_review.yml)
"""

import argparse
import json
import logging
import os
import sys
from typing import Optional

from google import genai
from google.genai import types

from .github_client import GitHubClient, PRInfo

logger = logging.getLogger(__name__)


# ── Prompt engineering ──────────────────────────────────────────────────

REVIEW_SYSTEM_PROMPT = """\
You are a senior software engineer conducting a thorough code review.
You will be given the diff of a Pull Request.  Analyze it and produce a
structured review.

Your review MUST cover:
1. **Bugs & Logic Errors** — Off-by-one errors, null/undefined access,
   race conditions, incorrect conditionals.
2. **Security Vulnerabilities** — SQL injection, XSS, hardcoded secrets,
   insecure deserialization, missing auth checks.
3. **Performance Issues** — N+1 queries, unnecessary re-renders,
   missing indexes, memory leaks, blocking I/O on main thread.
4. **Code Quality** — Dead code, poor naming, missing error handling,
   overly complex functions, violations of DRY/SOLID.
5. **Best Practices** — Missing tests for new logic, undocumented public
   APIs, inconsistent patterns with the rest of the codebase.

For each issue found, respond with:
- **File**: the filename
- **Line**: approximate line number in the diff
- **Severity**: 🔴 Critical, 🟡 Warning, 🔵 Info
- **Description**: Clear explanation and suggested fix.

If the code looks good, say so briefly and note any minor improvements.
Be constructive, specific, and concise.  Do NOT invent issues.
"""


def _build_review_prompt(pr: PRInfo) -> str:
    """Build the user prompt containing the PR context."""
    file_summary = "\n".join(
        f"  - {f['filename']} (+{f['additions']}/-{f['deletions']})"
        for f in pr.changed_files
    )
    return f"""\
## Pull Request #{pr.number}: {pr.title}
**Author**: {pr.author}
**Branch**: {pr.head_branch} → {pr.base_branch}

### Changed Files
{file_summary}

### Diff
```diff
{pr.diff_text[:60000]}
```
"""
    # Truncate massive diffs to stay within context window limits


# ── Core review logic ───────────────────────────────────────────────────

def review_pr(
    repo: str,
    pr_number: int,
    api_key: str | None = None,
    model_name: str = "gemini-2.0-flash",
    dry_run: bool = False,
) -> str:
    """
    Fetch a PR, analyze it with Gemini, and post the review.

    Args:
        repo: "owner/repo" format.
        pr_number: The PR number.
        api_key: Gemini API key (reads env if None).
        model_name: Gemini model identifier.
        dry_run: If True, print the review instead of posting it.

    Returns:
        The review text.
    """
    # ── 1. Resolve API key ──────────────────────────────────────────────
    api_key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("Gemini API key required — set GEMINI_API_KEY env var.")

    # ── 2. Fetch PR diff ────────────────────────────────────────────────
    logger.info("Fetching PR #%d from %s", pr_number, repo)
    gh = GitHubClient()
    pr = gh.get_pr_diff(repo, pr_number)
    logger.info("PR #%d: %s (%d files changed)", pr.number, pr.title, len(pr.changed_files))

    # ── 3. Call Gemini ──────────────────────────────────────────────────
    logger.info("Sending diff to Gemini (%s)…", model_name)
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model_name,
        contents=[
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=_build_review_prompt(pr))],
            ),
        ],
        config=types.GenerateContentConfig(
            system_instruction=REVIEW_SYSTEM_PROMPT,
        ),
    )

    review_text = response.text or "(No review generated)"

    # ── 4. Post review ──────────────────────────────────────────────────
    # Prefix with a bot header so reviewers know it's automated
    formatted_review = (
        "## 🤖 Automated Code Review\n\n"
        f"*Model: `{model_name}` · PR #{pr.number}*\n\n"
        "---\n\n"
        f"{review_text}"
    )

    if dry_run:
        print("\n" + "=" * 60)
        print("DRY RUN — Review would be posted:")
        print("=" * 60)
        print(formatted_review)
    else:
        logger.info("Posting review comment on PR #%d", pr.number)
        gh.post_issue_comment(repo, pr.number, formatted_review)
        logger.info("Review posted successfully.")

    return formatted_review


# ── CLI entry point ─────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Automated PR Review Agent powered by Gemini"
    )
    parser.add_argument("--repo", required=True, help="GitHub repo in owner/repo format")
    parser.add_argument("--pr", type=int, required=True, help="PR number to review")
    parser.add_argument("--model", default="gemini-2.0-flash", help="Gemini model name")
    parser.add_argument("--dry-run", action="store_true", help="Print review without posting")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    try:
        review_pr(
            repo=args.repo,
            pr_number=args.pr,
            model_name=args.model,
            dry_run=args.dry_run,
        )
    except Exception as e:
        logger.error("Review failed: %s", e, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
