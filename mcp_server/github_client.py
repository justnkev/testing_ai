"""
GitHub API Client Module

Provides a modular interface for GitHub REST API operations focused on
Pull Request management, code review, and CI/CD status checking.
"""

import logging
import os
from datetime import datetime
from typing import Any, Optional

from github import Auth, Github, GithubException
from github.GithubException import RateLimitExceededException

# Configure module logger
logger = logging.getLogger(__name__)


class GitHubClientError(Exception):
    """Base exception for GitHub client errors."""
    pass


class RateLimitError(GitHubClientError):
    """Raised when GitHub API rate limit is exceeded."""
    def __init__(self, reset_time: datetime):
        self.reset_time = reset_time
        super().__init__(
            f"Rate limit exceeded. Resets at {reset_time.isoformat()}"
        )


class MergeConflictError(GitHubClientError):
    """Raised when a PR has merge conflicts."""
    pass


class AuthenticationError(GitHubClientError):
    """Raised when authentication fails."""
    pass


class GitHubClient:
    """
    Client for interacting with GitHub REST API.
    
    Handles authentication, rate limiting, and provides methods for
    PR diff retrieval, review submission, CI status checking, and merging.
    """
    
    def __init__(self, token: Optional[str] = None):
        """
        Initialize GitHub client with authentication.
        
        Args:
            token: GitHub personal access token. If None, reads from
                   GITHUB_PERSONAL_ACCESS_TOKEN environment variable.
        
        Raises:
            AuthenticationError: If no token is provided or found.
        """
        self.token = token or os.getenv("GITHUB_PERSONAL_ACCESS_TOKEN")
        
        if not self.token:
            raise AuthenticationError(
                "GitHub token not found. Set GITHUB_PERSONAL_ACCESS_TOKEN "
                "environment variable or pass token directly."
            )
        
        auth = Auth.Token(self.token)
        self._github = Github(auth=auth)
        logger.info("GitHub client initialized successfully")
    
    def _handle_rate_limit(self, exc: RateLimitExceededException) -> None:
        """
        Extract rate limit reset time and raise appropriate error.
        
        Args:
            exc: The rate limit exception from PyGitHub.
        
        Raises:
            RateLimitError: Always raised with reset time information.
        """
        reset_timestamp = self._github.rate_limiting_resettime
        reset_time = datetime.fromtimestamp(reset_timestamp)
        logger.warning(f"Rate limit exceeded. Resets at {reset_time}")
        raise RateLimitError(reset_time)
    
    def get_pr_diff(self, repo_name: str, pr_number: int) -> dict[str, Any]:
        """
        Fetch the raw diff of a Pull Request.
        
        Args:
            repo_name: Full repository name (e.g., "owner/repo").
            pr_number: Pull Request number.
        
        Returns:
            Dictionary containing:
                - status: "success" or "error"
                - diff: Raw diff text (if successful)
                - files_changed: Number of files changed
                - additions: Lines added
                - deletions: Lines deleted
                - message: Error message (if failed)
        
        Raises:
            RateLimitError: If API rate limit is exceeded.
        """
        logger.info(f"Fetching diff for PR #{pr_number} in {repo_name}")
        
        try:
            repo = self._github.get_repo(repo_name)
            pr = repo.get_pull(pr_number)
            
            # Get diff via files
            files = pr.get_files()
            diff_parts = []
            total_additions = 0
            total_deletions = 0
            
            for file in files:
                if file.patch:
                    diff_parts.append(f"--- a/{file.filename}\n+++ b/{file.filename}\n{file.patch}")
                total_additions += file.additions
                total_deletions += file.deletions
            
            if not diff_parts:
                return {
                    "status": "success",
                    "diff": "",
                    "files_changed": 0,
                    "additions": 0,
                    "deletions": 0,
                    "message": "No changes in this PR (empty diff)"
                }
            
            combined_diff = "\n\n".join(diff_parts)
            
            # Check if diff is too large (> 1MB)
            if len(combined_diff) > 1_000_000:
                return {
                    "status": "success",
                    "diff": combined_diff[:100_000] + "\n\n... [TRUNCATED - diff too large] ...",
                    "files_changed": pr.changed_files,
                    "additions": total_additions,
                    "deletions": total_deletions,
                    "message": "Diff truncated due to size (>1MB)"
                }
            
            return {
                "status": "success",
                "diff": combined_diff,
                "files_changed": pr.changed_files,
                "additions": total_additions,
                "deletions": total_deletions
            }
            
        except RateLimitExceededException as e:
            self._handle_rate_limit(e)
        except GithubException as e:
            logger.error(f"GitHub API error: {e}")
            return {
                "status": "error",
                "message": f"GitHub API error: {e.data.get('message', str(e))}"
            }
    
    def submit_pr_review(
        self,
        repo_name: str,
        pr_number: int,
        event: str,
        body: str,
        comments: Optional[list[dict[str, Any]]] = None
    ) -> dict[str, Any]:
        """
        Submit a formal review on a Pull Request.
        
        Args:
            repo_name: Full repository name (e.g., "owner/repo").
            pr_number: Pull Request number.
            event: Review event type - "APPROVE", "REQUEST_CHANGES", or "COMMENT".
            body: Main review body text.
            comments: Optional list of inline comments, each with:
                      {"path": str, "line": int, "body": str}
        
        Returns:
            Dictionary containing:
                - status: "success" or "error"
                - review_id: ID of submitted review (if successful)
                - html_url: URL to view review (if successful)
                - message: Error message (if failed)
        
        Raises:
            RateLimitError: If API rate limit is exceeded.
        """
        valid_events = {"APPROVE", "REQUEST_CHANGES", "COMMENT"}
        if event.upper() not in valid_events:
            return {
                "status": "error",
                "message": f"Invalid event type '{event}'. Must be one of: {valid_events}"
            }
        
        logger.info(f"Submitting {event} review for PR #{pr_number} in {repo_name}")
        
        try:
            repo = self._github.get_repo(repo_name)
            pr = repo.get_pull(pr_number)
            
            # Get latest commit for inline comments
            commit = pr.get_commits().reversed[0]
            
            # Create review
            review = pr.create_review(
                commit=commit,
                body=body,
                event=event.upper(),
                comments=comments or []
            )
            
            return {
                "status": "success",
                "review_id": review.id,
                "html_url": review.html_url,
                "state": review.state
            }
            
        except RateLimitExceededException as e:
            self._handle_rate_limit(e)
        except GithubException as e:
            logger.error(f"GitHub API error: {e}")
            return {
                "status": "error",
                "message": f"GitHub API error: {e.data.get('message', str(e))}"
            }
    
    def get_ci_status(self, repo_name: str, branch_name: str) -> dict[str, Any]:
        """
        Check GitHub Actions/Check Runs status for a branch.
        
        Args:
            repo_name: Full repository name (e.g., "owner/repo").
            branch_name: Branch name to check CI status for.
        
        Returns:
            Dictionary containing:
                - status: "success" or "error"
                - overall_status: "success", "failure", "pending", "neutral", or "no_checks"
                - check_runs: List of individual check run results
                - retry_after_seconds: Suggested retry interval (if pending)
                - message: Additional context or error message
        
        Raises:
            RateLimitError: If API rate limit is exceeded.
        """
        logger.info(f"Checking CI status for branch '{branch_name}' in {repo_name}")
        
        try:
            repo = self._github.get_repo(repo_name)
            
            # Get the latest commit on the branch
            branch = repo.get_branch(branch_name)
            commit_sha = branch.commit.sha
            
            # Get check runs for the commit
            check_runs = repo.get_commit(commit_sha).get_check_runs()
            
            runs_data = []
            has_pending = False
            has_failure = False
            has_success = False
            
            for run in check_runs:
                run_info = {
                    "name": run.name,
                    "status": run.status,  # queued, in_progress, completed
                    "conclusion": run.conclusion,  # success, failure, neutral, etc.
                    "started_at": run.started_at.isoformat() if run.started_at else None,
                    "completed_at": run.completed_at.isoformat() if run.completed_at else None,
                    "html_url": run.html_url
                }
                runs_data.append(run_info)
                
                if run.status != "completed":
                    has_pending = True
                elif run.conclusion == "failure":
                    has_failure = True
                elif run.conclusion == "success":
                    has_success = True
            
            if not runs_data:
                return {
                    "status": "success",
                    "overall_status": "no_checks",
                    "check_runs": [],
                    "message": "No CI checks configured for this branch"
                }
            
            if has_pending:
                return {
                    "status": "success",
                    "overall_status": "pending",
                    "check_runs": runs_data,
                    "retry_after_seconds": 30,
                    "message": "CI checks are still running. Retry in 30 seconds."
                }
            
            if has_failure:
                overall = "failure"
                message = "One or more CI checks failed"
            elif has_success:
                overall = "success"
                message = "All CI checks passed"
            else:
                overall = "neutral"
                message = "CI checks completed with neutral status"
            
            return {
                "status": "success",
                "overall_status": overall,
                "check_runs": runs_data,
                "message": message
            }
            
        except RateLimitExceededException as e:
            self._handle_rate_limit(e)
        except GithubException as e:
            logger.error(f"GitHub API error: {e}")
            return {
                "status": "error",
                "message": f"GitHub API error: {e.data.get('message', str(e))}"
            }
    
    def merge_pr(
        self,
        repo_name: str,
        pr_number: int,
        merge_method: str = "merge"
    ) -> dict[str, Any]:
        """
        Merge a Pull Request if criteria are met.
        
        Args:
            repo_name: Full repository name (e.g., "owner/repo").
            pr_number: Pull Request number.
            merge_method: Merge method - "merge", "squash", or "rebase".
        
        Returns:
            Dictionary containing:
                - status: "success" or "error"
                - merged: Boolean indicating if merge was successful
                - sha: Merge commit SHA (if successful)
                - message: Success message or error details
        
        Raises:
            RateLimitError: If API rate limit is exceeded.
        """
        valid_methods = {"merge", "squash", "rebase"}
        if merge_method.lower() not in valid_methods:
            return {
                "status": "error",
                "message": f"Invalid merge method '{merge_method}'. Must be one of: {valid_methods}"
            }
        
        logger.info(f"Attempting to merge PR #{pr_number} in {repo_name} via {merge_method}")
        
        try:
            repo = self._github.get_repo(repo_name)
            pr = repo.get_pull(pr_number)
            
            # Check if already merged
            if pr.merged:
                return {
                    "status": "success",
                    "merged": True,
                    "sha": pr.merge_commit_sha,
                    "message": "PR was already merged"
                }
            
            # Check mergeable state
            if pr.mergeable is False:
                return {
                    "status": "error",
                    "merged": False,
                    "mergeable_state": pr.mergeable_state,
                    "message": f"PR cannot be merged. State: {pr.mergeable_state}. "
                              "This usually indicates merge conflicts that must be resolved."
                }
            
            if pr.mergeable is None:
                return {
                    "status": "error",
                    "merged": False,
                    "message": "Mergeable state is being computed. Please retry in a few seconds."
                }
            
            # Check if PR is open
            if pr.state != "open":
                return {
                    "status": "error",
                    "merged": False,
                    "message": f"PR is not open (current state: {pr.state})"
                }
            
            # Attempt merge
            result = pr.merge(
                commit_message=f"Merge PR #{pr_number}: {pr.title}",
                merge_method=merge_method.lower()
            )
            
            if result.merged:
                logger.info(f"Successfully merged PR #{pr_number}")
                return {
                    "status": "success",
                    "merged": True,
                    "sha": result.sha,
                    "message": f"PR #{pr_number} merged successfully via {merge_method}"
                }
            else:
                return {
                    "status": "error",
                    "merged": False,
                    "message": result.message or "Merge failed for unknown reason"
                }
            
        except RateLimitExceededException as e:
            self._handle_rate_limit(e)
        except GithubException as e:
            logger.error(f"GitHub API error: {e}")
            error_msg = e.data.get('message', str(e)) if hasattr(e, 'data') else str(e)
            return {
                "status": "error",
                "merged": False,
                "message": f"GitHub API error: {error_msg}"
            }
    
    def close(self) -> None:
        """Close the GitHub client connection."""
        self._github.close()
        logger.info("GitHub client connection closed")
