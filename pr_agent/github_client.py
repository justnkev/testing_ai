"""
GitHub API client for the PR Review Agent.

Handles authentication, fetching PR diffs, and posting review comments.
Uses the `requests` library with the GitHub REST API v3.
"""

import logging
import os
from dataclasses import dataclass
from typing import Optional

import requests

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


@dataclass
class PRInfo:
    """Metadata about a Pull Request."""
    number: int
    title: str
    author: str
    base_branch: str
    head_branch: str
    diff_text: str
    changed_files: list[dict]


class GitHubClient:
    """
    Authenticated wrapper around the GitHub REST API.

    Usage:
        client = GitHubClient()                     # reads GITHUB_TOKEN from env
        pr = client.get_pr_diff("owner/repo", 42)
        client.post_review_comment("owner/repo", 42, "Looks good!", "COMMENT")
    """

    def __init__(self, token: str | None = None):
        self.token = token or os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN")
        if not self.token:
            raise ValueError(
                "GitHub token is required. Set GITHUB_TOKEN or "
                "GITHUB_PERSONAL_ACCESS_TOKEN environment variable."
            )
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
        })

    # ── Read operations ─────────────────────────────────────────────────

    def get_pr_diff(self, repo: str, pr_number: int) -> PRInfo:
        """
        Fetch a PR's diff and metadata.

        Args:
            repo: "owner/repo" format.
            pr_number: The PR number.

        Returns:
            PRInfo dataclass with diff text and metadata.
        """
        # Get PR metadata
        pr_url = f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}"
        pr_resp = self.session.get(pr_url)
        pr_resp.raise_for_status()
        pr_data = pr_resp.json()

        # Get diff
        # Use a fresh request to avoid session headers (like X-GitHub-Api-Version) causing 406
        diff_text = ""
        try:
            diff_resp = requests.get(
                pr_url,
                headers={
                    "Authorization": f"Bearer {self.token}",
                    "Accept": "application/vnd.github.v3.diff",
                    "User-Agent": "PR-Agent-v1"
                },
            )
            diff_resp.raise_for_status()
            diff_text = diff_resp.text
        except requests.exceptions.HTTPError as e:
            if diff_resp.status_code == 406 and "too_large" in diff_resp.text:
                logger.warning("PR diff is too large to fetch via API.")
                diff_text = "WARNING: The PR diff is too large to display (exceeds GitHub API limits). This usually happens with large migrations."
            else:
                logger.error(f"Failed to fetch diff. Status: {diff_resp.status_code}")
                logger.error(f"Response headers: {diff_resp.headers}")
                logger.error(f"Response body: {diff_resp.text}")
                raise e

        # Get changed files
        files_resp = self.session.get(f"{pr_url}/files")
        files_resp.raise_for_status()
        files_data = files_resp.json()

        changed_files = [
            {
                "filename": f["filename"],
                "status": f["status"],
                "additions": f["additions"],
                "deletions": f["deletions"],
                "patch": f.get("patch", ""),
            }
            for f in files_data
        ]

        return PRInfo(
            number=pr_number,
            title=pr_data["title"],
            author=pr_data["user"]["login"],
            base_branch=pr_data["base"]["ref"],
            head_branch=pr_data["head"]["ref"],
            diff_text=diff_resp.text,
            changed_files=changed_files,
        )

    # ── Write operations ────────────────────────────────────────────────

    def post_review_comment(
        self,
        repo: str,
        pr_number: int,
        body: str,
        event: str = "COMMENT",
        inline_comments: Optional[list[dict]] = None,
    ) -> dict:
        """
        Post a review on a PR.

        Args:
            repo: "owner/repo" format.
            pr_number: The PR number.
            body: The review body text.
            event: "COMMENT", "APPROVE", or "REQUEST_CHANGES".
            inline_comments: Optional list of inline comment dicts with
                             keys: path, line (or position), body.

        Returns:
            The API response JSON.
        """
        url = f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}/reviews"
        payload = {
            "body": body,
            "event": event,
        }
        if inline_comments:
            payload["comments"] = inline_comments

        resp = self.session.post(url, json=payload)
        resp.raise_for_status()
        return resp.json()

    def post_issue_comment(self, repo: str, pr_number: int, body: str) -> dict:
        """
        Post a simple comment on a PR (issue-level, not a review).

        Args:
            repo: "owner/repo" format.
            pr_number: The PR number.
            body: The comment body.

        Returns:
            The API response JSON.
        """
        url = f"{GITHUB_API}/repos/{repo}/issues/{pr_number}/comments"
        resp = self.session.post(url, json={"body": body})
        resp.raise_for_status()
        return resp.json()
