import asyncio
import json
import logging
import os
from typing import Any, Optional, List

import httpx

# Configure module logger
logger = logging.getLogger(__name__)


class VercelClientError(Exception):
    """Base exception for Vercel client errors."""
    pass


class AuthenticationError(VercelClientError):
    """Raised when authentication fails."""
    pass


class VercelClient:
    """
    Client for interacting with Vercel REST API.
    
    Handles authentication and provides methods for fetching deployment logs
    and managing Vercel resources.
    """
    
    BASE_URL = "https://api.vercel.com"
    
    def __init__(self, token: Optional[str] = None):
        """
        Initialize Vercel client with authentication.
        
        Args:
            token: Vercel access token. If None, reads from
                   VERCEL_TOKEN environment variable.
        """
        self.token = token or os.getenv("VERCEL_TOKEN")
        self.team_id = os.getenv("VERCEL_TEAM_ID")
        
        # We don't raise error here to allow module import without env var,
        # but methods will check for token.
        if not self.token:
            logger.warning("VERCEL_TOKEN not found in environment")
            
    def _get_headers(self) -> dict[str, str]:
        """Get headers for API requests."""
        if not self.token:
            raise AuthenticationError(
                "Error: VERCEL_TOKEN environment variable is not set."
            )
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def _get_params(self, params: dict[str, Any], team_id: Optional[str] = None) -> dict[str, Any]:
        """Inject teamId into parameters if present."""
        tid = team_id or self.team_id
        if tid:
            params["teamId"] = tid
        return params

    async def _request_json(
        self, 
        method: str, 
        path: str, 
        params: Optional[dict[str, Any]] = None,
        json_data: Optional[dict[str, Any]] = None
    ) -> Any:
        """
        Execute request and return JSON response. 
        Handles 429 rate limits and common errors.
        """
        url = f"{self.BASE_URL}{path}"
        headers = self._get_headers()
        params = params or {}
        
        async with httpx.AsyncClient() as client:
            retries = 3
            for attempt in range(retries):
                try:
                    response = await client.request(
                        method, 
                        url, 
                        headers=headers, 
                        params=params, 
                        json=json_data,
                        timeout=30.0
                    )
                    
                    if response.status_code == 429:
                        retry_after = int(response.headers.get("Retry-After", 2))
                        logger.warning(f"Rate limited. Retrying in {retry_after}s...")
                        await asyncio.sleep(retry_after)
                        continue
                        
                    if response.status_code == 401:
                        raise AuthenticationError("Unauthorized: Invalid VERCEL_TOKEN")
                        
                    if response.status_code >= 400:
                        try:
                            err_data = response.json()
                            err_msg = err_data.get("error", {}).get("message", response.text)
                        except:
                            err_msg = response.text
                        raise VercelClientError(f"Vercel API Error ({response.status_code}): {err_msg}")
                        
                    return response.json()
                    
                except httpx.RequestError as e:
                    if attempt == retries - 1:
                        raise VercelClientError(f"Network error: {str(e)}")
                    # Retry on network errors
                    await asyncio.sleep(1)
            
            raise VercelClientError("Max retries exceeded")

    async def list_deployments(
        self, 
        project_id_or_name: str, 
        limit: int = 5,
        team_id: Optional[str] = None
    ) -> List[dict[str, Any]]:
        """
        List recent deployments for a project.
        
        Args:
            project_id_or_name: Project ID or Name (slug).
            limit: Number of deployments to return.
            team_id: Optional Team ID.
            
        Returns:
            List of deployment summaries (uid, name, state, url).
        """
        params = {"projectId": project_id_or_name, "limit": limit}
        params = self._get_params(params, team_id)
        
        data = await self._request_json("GET", "/v6/deployments", params=params)
        deployments = data.get("deployments", [])
        
        return [
            {
                "uid": d.get("uid"),
                "name": d.get("name"),
                "state": d.get("state"),
                "url": f"https://{d.get('url')}" if d.get('url') else None,
                "created": d.get("created")
            }
            for d in deployments
        ]

    async def get_deployment_details(
        self, 
        deployment_id: str,
        team_id: Optional[str] = None
    ) -> dict[str, Any]:
        """
        Get details for a specific deployment.
        
        Args:
            deployment_id: Deployment ID.
            team_id: Optional Team ID.
            
        Returns:
            Deployment metadata object.
        """
        # Clean ID
        clean_id = deployment_id.replace("https://", "").replace(".vercel.app", "")
        params = self._get_params({}, team_id)
        
        return await self._request_json("GET", f"/v13/deployments/{clean_id}", params=params)

    async def set_env_var(
        self,
        project_id: str,
        key: str,
        value: str,
        target: List[str],
        team_id: Optional[str] = None
    ) -> dict[str, Any]:
        """
        Set or update an environment variable.
        
        Args:
            project_id: Project ID.
            key: Env var name.
            value: Env var value.
            target: List of targets ["production", "preview", "development"].
            team_id: Optional Team ID.
            
        Returns:
            Created/Updated env var object.
        """
        valid_targets = {"production", "preview", "development"}
        if not all(t in valid_targets for t in target):
            raise VercelClientError(f"Invalid target. Must be subset of {valid_targets}")
            
        params = {"upsert": "true"}
        params = self._get_params(params, team_id)
        
        # Determine type (simple heuristic: if "SECRET" or "KEY" or "TOKEN" in name, assume sensitive? 
        # API requires 'encrypted' or 'plain'. Safer to default to encrypted for API keys/Tokens)
        env_type = "encrypted"
        
        body = {
            "key": key,
            "value": value,
            "target": target,
            "type": env_type
        }
        
        return await self._request_json(
            "POST", 
            f"/v10/projects/{project_id}/env", 
            params=params, 
            json_data=body
        )

    async def get_build_logs(
        self, 
        deployment_id: str, 
        team_id: Optional[str] = None
    ) -> str:
        """
        Fetch and format build logs for a deployment.
        
        Args:
            deployment_id: The ID or URL of the deployment.
            team_id: Optional Team ID to include in the request.
            
        Returns:
            Formatted string of build logs.
        """
        headers = self._get_headers()
        
        # Clean deployment ID (remove https:// or .vercel.app if present, though ID is preferred)
        clean_id = deployment_id.replace("https://", "").replace(".vercel.app", "")
        
        url = f"{self.BASE_URL}/v13/deployments/{clean_id}/events"
        params = {}
        # Inject team ID logic manually here since this method uses raw httpx.get for streaming-like response
        # (Though current impl is not streaming, it consumes response.text for parsing JSON lines)
        tid = team_id or self.team_id
        if tid:
            params["teamId"] = tid
            
        logger.info(f"Fetching build logs for {clean_id}")
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=headers, params=params, timeout=30.0)
                
                if response.status_code == 401:
                    raise AuthenticationError("Unauthorized: Invalid VERCEL_TOKEN")
                
                if response.status_code == 404:
                    return (
                        f"Deployment '{deployment_id}' not found. "
                        "Ensure the ID is correct and the token has access to this project."
                    )
                    
                if response.status_code != 200:
                    response.raise_for_status()
                    
                # Process the stream of JSON objects
                logs = []
                lines = response.text.strip().split("\n")
                
                if not lines or (len(lines) == 1 and not lines[0].strip()):
                     return "Build is currently initializing. Please wait 10 seconds and try again."

                for line in lines:
                    if not line.strip():
                        continue
                    try:
                        event = json.loads(line)
                        event_type = event.get("type")
                        
                        # Keep only relevant build output
                        if event_type in ("stdout", "stderr"):
                            text = event.get("text", "").strip()
                            if text:
                                logs.append(text)
                                
                    except json.JSONDecodeError:
                        continue
                        
                if not logs:
                    return "No build logs found. The build might be queued or initializing."
                
                # Keep last 150 lines
                truncated_logs = logs[-150:]
                
                result = "\n".join(truncated_logs)
                
                if len(logs) > 150:
                    result = f"... [Truncated {len(logs) - 150} earlier lines] ...\n" + result
                    
                return result

            except httpx.RequestError as e:
                logger.error(f"Network error fetching Vercel logs: {e}")
                return f"Error connecting to Vercel API: {str(e)}"
            except Exception as e:
                logger.exception("Unexpected error fetching Vercel logs")
                return f"Unexpected error: {str(e)}"
