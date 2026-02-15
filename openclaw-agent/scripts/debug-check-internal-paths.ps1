$ErrorActionPreference = "Stop"

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Checking Internal Paths & Mounts..."
Write-Host "Target: $VPS_USER@$VPS_HOST"

# 1. Check Paths
Write-Host "`n[1/3] Checking internal paths..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "docker exec openclaw-openclaw-gateway-1 ls -d /home/node/.openclaw/subagents /home/node/.openclaw/workspace/subagents /home/node/.openclaw/agents 2>/dev/null || echo 'Path check completed'"

# 2. List Workspace Content
Write-Host "`n[2/3] Listing Workspace Config..."
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "docker exec openclaw-openclaw-gateway-1 ls -la /home/node/.openclaw/workspace"

# 3. Inspect Mounts
Write-Host "`n[3/3] Inspecting Mounts..."
# We want to see the Mounts section nicely formatted
ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_HOST} "docker inspect openclaw-openclaw-gateway-1 --format '{{json .Mounts}}'"
