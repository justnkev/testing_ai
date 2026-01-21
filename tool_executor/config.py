"""
Configuration module for Containerized Tool Executor.

Uses Pydantic Settings to load environment variables from .env file.
"""

from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    Attributes:
        google_api_key: API key for Gemini model access.
        workspace_path: Local directory to mount into container.
        docker_image: Docker image to use for the sandbox.
        container_user: Non-root user to run commands as.
        gemini_model: Gemini model identifier.
        max_retries: Maximum retries for rate-limited requests.
        base_backoff_seconds: Initial backoff time for retries.
    """
    
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),  # Check current dir and parent
        env_file_encoding="utf-8",
        extra="ignore",
    )
    
    # Required - accepts either GOOGLE_API_KEY or GEMINI_API_KEY
    google_api_key: str = Field(
        default="",
        alias="GOOGLE_API_KEY",
        description="Google API key for Gemini access",
    )
    gemini_api_key: str = Field(
        default="",
        alias="GEMINI_API_KEY",
        description="Alternative name for Google API key",
    )
    
    @property
    def api_key(self) -> str:
        """Get the API key from either source."""
        return self.google_api_key or self.gemini_api_key
    
    # Workspace configuration
    workspace_path: Path = Field(
        default=Path("./workspace"),
        description="Local directory to mount as /workspace in container",
    )
    
    # Docker configuration
    docker_image: str = Field(
        default="python:3.11-slim",
        description="Docker image for the sandbox container",
    )
    container_user: str = Field(
        default="appuser",
        description="Non-root user inside the container",
    )
    container_uid: int = Field(
        default=1000,
        description="UID for the container user",
    )
    container_gid: int = Field(
        default=1000,
        description="GID for the container user",
    )
    
    # Gemini configuration
    gemini_model: str = Field(
        default="gemini-2.0-flash",
        description="Gemini model to use",
    )
    
    # Retry configuration
    max_retries: int = Field(
        default=3,
        description="Maximum retry attempts for rate-limited requests",
    )
    base_backoff_seconds: float = Field(
        default=1.0,
        description="Base backoff time in seconds (doubles each retry)",
    )
    
    # Logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO",
        description="Logging level",
    )
    
    @field_validator("workspace_path", mode="after")
    @classmethod
    def ensure_workspace_exists(cls, v: Path) -> Path:
        """Create workspace directory if it doesn't exist."""
        v.mkdir(parents=True, exist_ok=True)
        return v.resolve()
    
    @field_validator("google_api_key", "gemini_api_key", mode="after")
    @classmethod
    def validate_api_key(cls, v: str) -> str:
        """Ensure API key is not a placeholder."""
        if v == "your-api-key-here":
            raise ValueError(
                "API key placeholder detected. "
                "Set GOOGLE_API_KEY or GEMINI_API_KEY in .env file."
            )
        return v
    
    def model_post_init(self, __context) -> None:
        """Validate that at least one API key is set."""
        if not self.api_key:
            raise ValueError(
                "GOOGLE_API_KEY or GEMINI_API_KEY must be set in .env file. "
                "See .env.example for template."
            )
